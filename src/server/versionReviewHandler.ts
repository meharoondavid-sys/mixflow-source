import { createClient } from '@supabase/supabase-js';
import { createNotification } from './notificationsHandler.js';
import {
  ProjectFileVersionRecord,
  ProjectFeedbackRecord,
  RequestVersionUploadUrlInput,
  ConfirmVersionUploadInput,
  CreateFeedbackInput,
  UpdateFeedbackStatusInput,
} from '../types/versionFeedback.js';

interface VersionReviewHandlerContext {
  authHeader?: string;
  projectId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

// Helper to authenticate caller
async function authenticateUser(ctx: {
  authHeader?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  createClientFn: typeof createClient;
}): Promise<{ error: string; status: number } | { user: any }> {
  const { authHeader, supabaseUrl, supabaseAnonKey, createClientFn } = ctx;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Authentication required. Bearer token missing.', status: 401 };
  }
  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  if (!token) {
    return { error: 'Authentication required. Empty token provided.', status: 401 };
  }

  const userClient = createClientFn(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { error: 'Invalid or expired authentication session.', status: 401 };
  }

  return { user: userData.user };
}

/**
 * 1. List audio versions for a project
 * Allowed for organization members OR assigned client.
 */
export async function handleListProjectVersions(
  ctx: VersionReviewHandlerContext & { songId?: string }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, songId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify project exists
  const { data: project, error: projErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Check access: Caller is either org member OR assigned client
  let isAuthorized = false;

  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (membership) {
    isAuthorized = true;
  } else {
    // Check if caller is client
    const { data: client } = await adminClient
      .from('clients')
      .select('id')
      .eq('id', project.client_id)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (client) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return { status: 403, body: { error: 'Forbidden: You do not have access to this project.' } };
  }

  let query = adminClient
    .from('project_file_versions')
    .select('*')
    .eq('project_id', projectId);

  if (songId) {
    query = query.eq('song_id', songId);
  }

  const { data: versions, error: vErr } = await query.order('version_number', { ascending: true });

  if (vErr) {
    console.error('[MixFlow Versions] Query error:', vErr);
    return { status: 500, body: { error: 'Failed to retrieve audio versions.' } };
  }

  const versionRows: ProjectFileVersionRecord[] = versions || [];

  // Get feedback count breakdown (total, open, resolved) for each version
  const versionIds = versionRows.map((v) => v.id);
  const feedbackCounts: Record<string, { total: number; open: number; resolved: number }> = {};
  for (const id of versionIds) {
    feedbackCounts[id] = { total: 0, open: 0, resolved: 0 };
  }

  if (versionIds.length > 0) {
    const { data: fbData } = await adminClient
      .from('project_feedback')
      .select('version_id, status')
      .in('version_id', versionIds);

    if (fbData) {
      for (const item of fbData) {
        if (!feedbackCounts[item.version_id]) {
          feedbackCounts[item.version_id] = { total: 0, open: 0, resolved: 0 };
        }
        feedbackCounts[item.version_id].total += 1;
        if (item.status === 'resolved') {
          feedbackCounts[item.version_id].resolved += 1;
        } else {
          feedbackCounts[item.version_id].open += 1;
        }
      }
    }
  }

  // Fetch uploader profile names
  const uploaderIds = Array.from(new Set(versionRows.map((v) => v.uploaded_by).filter(Boolean))) as string[];
  const uploaderNames: Record<string, string> = {};
  if (uploaderIds.length > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .in('id', uploaderIds);

    if (profiles) {
      for (const p of profiles) {
        uploaderNames[p.id] = p.full_name || p.email || 'Studio Engineer';
      }
    }
  }

  // Determine highest version per song/project group to identify latest version
  const highestVersionPerSong: Record<string, number> = {};
  for (const v of versionRows) {
    const groupKey = v.song_id || 'project_general';
    if (!highestVersionPerSong[groupKey] || v.version_number > highestVersionPerSong[groupKey]) {
      highestVersionPerSong[groupKey] = v.version_number;
    }
  }

  const enriched: ProjectFileVersionRecord[] = versionRows.map((v) => {
    const groupKey = v.song_id || 'project_general';
    const isLatest = v.version_number === highestVersionPerSong[groupKey];
    const counts = feedbackCounts[v.id] || { total: 0, open: 0, resolved: 0 };
    return {
      ...v,
      feedback_count: counts.total,
      open_feedback_count: counts.open,
      resolved_feedback_count: counts.resolved,
      uploader_name: v.uploaded_by ? uploaderNames[v.uploaded_by] || v.uploader_name || 'Studio Engineer' : 'Studio Engineer',
      is_latest: isLatest,
    };
  });

  return { status: 200, body: { versions: enriched } };
}

/**
 * 2. Request signed upload URL for a new audio version
 * Upload allowed for: owner, admin, engineer, producer.
 */
export async function handleRequestVersionUploadUrl(
  ctx: VersionReviewHandlerContext & { body: RequestVersionUploadUrlInput }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, body, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  if (!body.fileName || !body.fileName.trim()) {
    return { status: 400, body: { error: 'File name is required.' } };
  }

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project, error: projErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Verify caller role
  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin', 'engineer', 'producer'].includes(membership.role)) {
    return { status: 403, body: { error: 'Forbidden: Insufficient permissions to upload versions.' } };
  }

  // If songId provided, verify it belongs to this project
  if (body.songId) {
    const { data: song } = await adminClient
      .from('project_songs')
      .select('id')
      .eq('id', body.songId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (!song) {
      return { status: 400, body: { error: 'Invalid song ID: Song does not belong to this project.' } };
    }
  }

  // If fileId provided, verify it belongs to this project
  if (body.fileId) {
    const { data: file } = await adminClient
      .from('project_files')
      .select('id')
      .eq('id', body.fileId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (!file) {
      return { status: 400, body: { error: 'Invalid file ID: Deliverable does not belong to this project.' } };
    }
  }

  // Generate versionId and sanitized storage path
  // Standard tenant-safe path: organization_id/project_id/versionId_sanitizedFilename
  const versionId = crypto.randomUUID();
  const sanitizedName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${project.organization_id}/${projectId}/${versionId}_${sanitizedName}`;

  const { data: uploadInfo, error: uErr } = await adminClient.storage
    .from('project-files')
    .createSignedUploadUrl(storagePath);

  if (uErr || !uploadInfo) {
    console.error('[MixFlow Storage] createSignedUploadUrl error:', uErr);
    return { status: 500, body: { error: uErr?.message || 'Failed to generate signed upload URL.' } };
  }

  return {
    status: 200,
    body: {
      versionId,
      storagePath,
      signedUrl: uploadInfo.signedUrl,
      token: uploadInfo.token,
    },
  };
}

/**
 * 3. Confirm Version Upload & Record Deterministic Version Number
 * Calculates next version number (v1, v2, v3) per project & song.
 * Inserts immutable record into public.project_file_versions.
 */
export async function handleConfirmVersionUpload(
  ctx: VersionReviewHandlerContext & { body: ConfirmVersionUploadInput }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, body, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project, error: projErr } = await adminClient
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin', 'engineer', 'producer'].includes(membership.role)) {
    return { status: 403, body: { error: 'Forbidden: Insufficient permissions to confirm versions.' } };
  }

  // Security check: storage path must be scoped to this project and version.
  const expectedPrefix = `${project.organization_id}/${projectId}/`;
  if (!body.storagePath.startsWith(expectedPrefix)) {
    return { status: 400, body: { error: 'Security violation: Storage path does not match project scope.' } };
  }

  const expectedVersionPrefix = expectedPrefix + body.versionId + '_';
  if (!body.storagePath.startsWith(expectedVersionPrefix)) {
    return { status: 400, body: { error: 'Security violation: Storage path does not match the version ID.' } };
  }

  // If songId provided, verify it belongs to this project
  if (body.songId) {
    const { data: song } = await adminClient
      .from('project_songs')
      .select('id')
      .eq('id', body.songId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (!song) {
      return { status: 400, body: { error: 'Invalid song ID: Song does not belong to this project.' } };
    }
  }

  // If fileId provided, verify it belongs to this project
  if (body.fileId) {
    const { data: file } = await adminClient
      .from('project_files')
      .select('id')
      .eq('id', body.fileId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (!file) {
      return { status: 400, body: { error: 'Invalid file ID: Deliverable does not belong to this project.' } };
    }
  }

  // Calculate deterministic next version number
  let versionQuery = adminClient
    .from('project_file_versions')
    .select('version_number')
    .eq('project_id', projectId);

  if (body.songId) {
    versionQuery = versionQuery.eq('song_id', body.songId);
  }

  const { data: existingVersions } = await versionQuery.order('version_number', { ascending: false }).limit(1);
  const highestVersion = existingVersions?.[0]?.version_number || 0;
  const nextVersionNumber = highestVersion + 1;

  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name, email')
    .eq('id', callerUser.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const versionRecord: ProjectFileVersionRecord = {
    id: body.versionId,
    organization_id: project.organization_id,
    project_id: projectId,
    song_id: body.songId || null,
    file_id: body.fileId || null,
    version_number: nextVersionNumber,
    name: body.fileName.trim(),
    storage_path: body.storagePath,
    file_type: body.fileType || 'audio/wav',
    file_size: Math.max(0, Number(body.fileSize) || 0),
    duration_seconds: body.durationSeconds ? Math.max(0, Number(body.durationSeconds)) : null,
    notes: body.notes?.trim() || null,
    uploaded_by: callerUser.id,
    uploader_name: profile?.full_name || callerUser.email || 'Engineer',
    created_at: now,
  };

  const { data: inserted, error: insErr } = await adminClient
    .from('project_file_versions')
    .insert({
      id: versionRecord.id,
      organization_id: versionRecord.organization_id,
      project_id: versionRecord.project_id,
      song_id: versionRecord.song_id,
      file_id: versionRecord.file_id,
      version_number: versionRecord.version_number,
      name: versionRecord.name,
      storage_path: versionRecord.storage_path,
      file_type: versionRecord.file_type,
      file_size: versionRecord.file_size,
      duration_seconds: versionRecord.duration_seconds,
      notes: versionRecord.notes,
      uploaded_by: versionRecord.uploaded_by,
      created_at: versionRecord.created_at,
    })
    .select()
    .single();

  if (insErr) {
    console.error('[MixFlow Versions] Insert error:', insErr);
    return { status: 500, body: { error: 'Failed to record version in database.' } };
  }

  // Revision loop: when a project is awaiting revision, the newly uploaded version becomes the active review version and the project returns to client review.
  const { data: currentProject } = await adminClient
    .from('projects')
    .select('status')
    .eq('id', projectId)
    .maybeSingle();

  if (currentProject?.status === 'needs_revision') {
    await adminClient.from('project_file_versions').update({ status: 'in_review' }).eq('id', versionRecord.id);
    await adminClient.from('projects').update({ status: 'in_review', updated_at: new Date().toISOString() }).eq('id', projectId);
    await adminClient.from('project_status_history').insert({
      organization_id: project.organization_id,
      project_id: projectId,
      version_id: versionRecord.id,
      from_status: 'needs_revision',
      to_status: 'in_review',
      action: 'status_changed',
      actor_user_id: callerUser.id,
      actor_role: membership.role,
      note: 'New version uploaded for client review.',
    });
  }

  // Step 15 Notification: Notify client of new mix version
  if (project.client_id) {
    try {
      const { data: clientData } = await adminClient
        .from('clients')
        .select('user_id')
        .eq('id', project.client_id)
        .maybeSingle();

      if (clientData?.user_id) {
        await createNotification(
          { supabaseUrl, supabaseServiceRoleKey, createClientFn },
          {
            organization_id: project.organization_id,
            project_id: projectId,
            recipient_user_id: clientData.user_id,
            actor_user_id: callerUser.id,
            type: 'version_uploaded',
            title: 'New Mix Available',
            message: `Version ${versionRecord.version_number} (${versionRecord.name}) is ready for your review.`,
            link_url: `#/client/project/${projectId}`,
          }
        );
      }
    } catch (_e) {
      // Non-blocking notification
    }
  }

  return { status: 201, body: { version: inserted || versionRecord } };
}

/**
 * 4. Get secure signed playback URL for an audio version
 * Generates short-lived signed URL (300 seconds).
 * Allowed for organization members OR assigned client.
 */
export async function handleGetVersionPlaybackUrl(
  ctx: VersionReviewHandlerContext & { versionId: string }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, versionId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Authorization: org member OR assigned client
  let isAuthorized = false;
  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (membership) {
    isAuthorized = true;
  } else {
    const { data: client } = await adminClient
      .from('clients')
      .select('id')
      .eq('id', project.client_id)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (client) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return { status: 403, body: { error: 'Forbidden: Access denied to this project audio.' } };
  }

  // Fetch version
  const { data: version } = await adminClient
    .from('project_file_versions')
    .select('*')
    .eq('id', versionId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (!version) {
    return { status: 404, body: { error: 'Audio version not found.' } };
  }

  // Create temporary signed URL (300 seconds)
  const { data: signedData, error: signErr } = await adminClient.storage
    .from('project-files')
    .createSignedUrl(version.storage_path, 300);

  if (signErr || !signedData?.signedUrl) {
    console.error('[MixFlow Storage] Signed playback URL error:', signErr);
    return { status: 500, body: { error: 'Failed to generate secure audio playback link.' } };
  }

  return {
    status: 200,
    body: {
      signedUrl: signedData.signedUrl,
      versionNumber: version.version_number,
      name: version.name,
      durationSeconds: version.duration_seconds,
    },
  };
}

/**
 * 5. List feedback for a project or specific audio version
 * Allowed for organization members OR assigned client.
 */
export async function handleListProjectFeedback(
  ctx: VersionReviewHandlerContext & { versionId?: string }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, versionId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  let isAuthorized = false;
  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (membership) {
    isAuthorized = true;
  } else {
    const { data: client } = await adminClient
      .from('clients')
      .select('id')
      .eq('id', project.client_id)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (client) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return { status: 403, body: { error: 'Forbidden: Access denied to feedback.' } };
  }

  let query = adminClient
    .from('project_feedback')
    .select('*')
    .eq('project_id', projectId);

  if (versionId) {
    query = query.eq('version_id', versionId);
  }

  const { data: feedback, error: fErr } = await query.order('timestamp_seconds', { ascending: true });

  if (fErr) {
    console.error('[MixFlow Feedback] List error:', fErr);
    return { status: 500, body: { error: 'Failed to retrieve feedback.' } };
  }

  return { status: 200, body: { feedback: feedback || [] } };
}

/**
 * 6. Create timestamped feedback (Client or Engineer)
 * Client identity is authoritatively resolved from database.
 * Validates numeric timestamp >= 0 and non-empty comment.
 */
export async function handleCreateProjectFeedback(
  ctx: VersionReviewHandlerContext & { body: CreateFeedbackInput }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, body, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  if (body.timestampSeconds === undefined || body.timestampSeconds === null || isNaN(Number(body.timestampSeconds))) {
    return { status: 400, body: { error: 'Timestamp in seconds is required.' } };
  }
  const timestamp = Number(body.timestampSeconds);
  if (timestamp < 0) {
    return { status: 400, body: { error: 'Timestamp must be a positive number of seconds.' } };
  }

  if (!body.comment || !body.comment.trim()) {
    return { status: 400, body: { error: 'Feedback comment cannot be empty.' } };
  }

  if (!body.versionId) {
    return { status: 400, body: { error: 'Version ID is required to anchor feedback.' } };
  }

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Verify version exists and belongs to this project
  const { data: version } = await adminClient
    .from('project_file_versions')
    .select('id, song_id')
    .eq('id', body.versionId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (!version) {
    return { status: 404, body: { error: 'Audio version not found on this project.' } };
  }

  // Verify song relationship matches if songId supplied
  if (body.songId && version.song_id && body.songId !== version.song_id) {
    return { status: 400, body: { error: 'Invalid song ID: Song does not match the audio version.' } };
  }

  // Determine author role and client association
  let authorRole: 'client' | 'engineer' = 'client';
  let clientId: string | null = null;
  let authorName = 'Client';

  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (membership) {
    authorRole = 'engineer';
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', callerUser.id)
      .maybeSingle();
    authorName = profile?.full_name || callerUser.email || 'Studio Engineer';
  } else {
    // Caller must be assigned client
    const { data: client } = await adminClient
      .from('clients')
      .select('id, full_name')
      .eq('id', project.client_id)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (!client) {
      return { status: 403, body: { error: 'Forbidden: You do not have permission to leave feedback on this project.' } };
    }

    authorRole = 'client';
    clientId = client.id;
    authorName = client.full_name || callerUser.email || 'Client';
  }

  const newFeedback: ProjectFeedbackRecord = {
    id: crypto.randomUUID(),
    organization_id: project.organization_id,
    project_id: projectId,
    song_id: version.song_id,
    version_id: version.id,
    client_id: clientId,
    author_id: callerUser.id,
    author_name: authorName,
    author_role: authorRole,
    timestamp_seconds: Math.round(timestamp * 100) / 100, // round to 2 decimals
    comment: body.comment.trim(),
    status: 'open',
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
  };

  const { data: inserted, error: insErr } = await adminClient
    .from('project_feedback')
    .insert(newFeedback)
    .select()
    .single();

  if (insErr) {
    console.error('[MixFlow Feedback] Insert error:', insErr);
    return { status: 500, body: { error: 'Failed to record feedback.' } };
  }

  // Step 15 Notification: Notify engineer when client submits feedback
  if (authorRole === 'client') {
    try {
      let targetEngineerId = version.uploaded_by;
      if (!targetEngineerId) {
        const { data: orgOwner } = await adminClient
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', project.organization_id)
          .in('role', ['owner', 'admin', 'engineer'])
          .limit(1)
          .maybeSingle();
        targetEngineerId = orgOwner?.user_id;
      }

      if (targetEngineerId && targetEngineerId !== callerUser.id) {
        await createNotification(
          { supabaseUrl, supabaseServiceRoleKey, createClientFn },
          {
            organization_id: project.organization_id,
            project_id: projectId,
            recipient_user_id: targetEngineerId,
            actor_user_id: callerUser.id,
            type: 'feedback_added',
            title: 'New Client Feedback',
            message: `${authorName} left a feedback note on Version ${version.version_number}.`,
            link_url: `#/project/${projectId}`,
          }
        );
      }
    } catch (_e) {
      // Non-blocking notification
    }
  }

  return { status: 201, body: { feedback: inserted || newFeedback } };
}

/**
 * 7. Update Feedback Status (e.g. resolve / reopen)
 * Restricted to organization members (engineers/producers/owners/admins).
 */
export async function handleUpdateFeedbackStatus(
  ctx: VersionReviewHandlerContext & {
    feedbackId: string;
    body: UpdateFeedbackStatusInput;
  }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, feedbackId, body, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  if (!body.status || !['open', 'resolved'].includes(body.status)) {
    return { status: 400, body: { error: "Status must be either 'open' or 'resolved'." } };
  }

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project } = await adminClient
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Only studio members can resolve/reopen feedback
  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin', 'engineer', 'producer'].includes(membership.role)) {
    return { status: 403, body: { error: 'Forbidden: Your role cannot update feedback status.' } };
  }

  const isResolved = body.status === 'resolved';
  const now = isResolved ? new Date().toISOString() : null;
  const resolvedBy = isResolved ? callerUser.id : null;

  const { data: updated, error: updErr } = await adminClient
    .from('project_feedback')
    .update({
      status: body.status,
      resolved_at: now,
      resolved_by: resolvedBy,
    })
    .eq('id', feedbackId)
    .eq('project_id', projectId)
    .select()
    .single();

  if (updErr) {
    console.error('[MixFlow Feedback] Update status error:', updErr);
    return { status: 500, body: { error: 'Failed to update feedback status.' } };
  }

  // Step 15 Notification: Notify client when feedback is resolved
  if (isResolved) {
    try {
      const { data: projData } = await adminClient
        .from('projects')
        .select('client_id, name')
        .eq('id', projectId)
        .maybeSingle();

      if (projData?.client_id) {
        const { data: clientData } = await adminClient
          .from('clients')
          .select('user_id')
          .eq('id', projData.client_id)
          .maybeSingle();

        if (clientData?.user_id) {
          await createNotification(
            { supabaseUrl, supabaseServiceRoleKey, createClientFn },
            {
              organization_id: project.organization_id,
              project_id: projectId,
              recipient_user_id: clientData.user_id,
              actor_user_id: callerUser.id,
              type: 'feedback_resolved',
              title: 'Feedback Resolved',
              message: `A feedback note on ${projData.name || 'your project'} has been marked resolved.`,
              link_url: `#/client/project/${projectId}`,
            }
          );
        }
      }
    } catch (_e) {
      // Non-blocking notification
    }
  }

  return { status: 200, body: { feedback: updated } };
}
