import { createClient } from '@supabase/supabase-js';
import { ProjectFileRecord, RequestUploadUrlInput, ConfirmUploadInput } from '../types/file.js';

interface ProjectFilesHandlerContext {
  authHeader?: string;
  projectId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

/**
 * 1. List Files for a Project
 * Authoritatively reads from public.project_files table.
 */
export async function handleListProjectFiles(
  ctx: ProjectFilesHandlerContext
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, body: { error: 'Authentication required. Bearer token missing.' } };
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  if (!token) {
    return { status: 401, body: { error: 'Authentication required. Empty token provided.' } };
  }

  const userClient = createClientFn(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { status: 401, body: { error: 'Invalid or expired authentication session.' } };
  }
  const callerUser = userData.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify project exists
  const { data: project, error: projErr } = await adminClient
    .from('projects')
    .select('id, organization_id, name')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Verify caller belongs to the project organization
  const { data: membership, error: memErr } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (memErr || !membership) {
    return {
      status: 403,
      body: { error: 'Forbidden: You do not have access to files for this organization.' },
    };
  }

  // Fetch files from public.project_files
  const { data: dbFiles, error: dbErr } = await adminClient
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (dbErr) {
    console.error('[MixFlow Files] Error querying project_files:', dbErr);
    return { status: 500, body: { error: 'Failed to retrieve project files.' } };
  }

  const fileRows = dbFiles || [];

  // Enrich with profile names
  const uploaderIds = Array.from(new Set(fileRows.map((f: any) => f.uploaded_by).filter(Boolean)));
  let profileMap: Record<string, { full_name?: string; email?: string }> = {};
  if (uploaderIds.length > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .in('id', uploaderIds);
    if (profiles) {
      profileMap = profiles.reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});
    }
  }

  const files: ProjectFileRecord[] = fileRows.map((f: any) => ({
    ...f,
    uploader_name: profileMap[f.uploaded_by]?.full_name || null,
    uploader_email: profileMap[f.uploaded_by]?.email || null,
  }));

  return { status: 200, body: { files } };
}

/**
 * 2. Request Signed Upload URL
 * Enforces role authorization, path scoping, and optional song membership.
 */
export async function handleCreateSignedUploadUrl(
  ctx: ProjectFilesHandlerContext & { body: RequestUploadUrlInput }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, body, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, body: { error: 'Authentication required. Bearer token missing.' } };
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const userClient = createClientFn(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { status: 401, body: { error: 'Invalid or expired authentication session.' } };
  }
  const callerUser = userData.user;

  if (!body.fileName || !body.fileName.trim()) {
    return { status: 400, body: { error: 'File name is required.' } };
  }

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify project exists
  const { data: project, error: projErr } = await adminClient
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Verify caller membership & role (upload allowed for owner, admin, engineer, producer)
  const { data: membership, error: memErr } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (memErr || !membership) {
    return {
      status: 403,
      body: { error: 'Forbidden: You do not have permission to upload files to this project.' },
    };
  }

  const allowedRoles = ['owner', 'admin', 'engineer', 'producer'];
  if (!allowedRoles.includes(membership.role)) {
    return {
      status: 403,
      body: { error: `Forbidden: Role '${membership.role}' is not authorized to upload project files.` },
    };
  }

  // If songId provided, verify it belongs to this project
  if (body.songId) {
    const { data: song, error: songErr } = await adminClient
      .from('project_songs')
      .select('id')
      .eq('id', body.songId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (songErr || !song) {
      return { status: 400, body: { error: 'Invalid song ID: Song does not belong to this project.' } };
    }
  }

  // Generate fileId and sanitized storage path
  // Standard Step 9A convention: organization_id/project_id/<file_id>_<sanitized_filename>
  const fileId = crypto.randomUUID();
  const sanitizedName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${project.organization_id}/${projectId}/${fileId}_${sanitizedName}`;

  // Create signed upload URL from Supabase Storage
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
      fileId,
      storagePath,
      signedUrl: uploadInfo.signedUrl,
      token: uploadInfo.token,
    },
  };
}

/**
 * 3. Confirm File Upload & Record Metadata
 * Enforces path validation, song association, and inserts into public.project_files.
 */
export async function handleConfirmFileUpload(
  ctx: ProjectFilesHandlerContext & { body: ConfirmUploadInput }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, body, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, body: { error: 'Authentication required. Bearer token missing.' } };
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const userClient = createClientFn(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { status: 401, body: { error: 'Invalid or expired authentication session.' } };
  }
  const callerUser = userData.user;

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

  // Verify caller membership
  const { data: membership, error: memErr } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (memErr || !membership) {
    return { status: 403, body: { error: 'Forbidden: Organization membership required.' } };
  }

  // Security: Storage path MUST be strictly scoped to organization_id/projectId/
  const expectedPrefix = `${project.organization_id}/${projectId}/`;
  if (!body.storagePath.startsWith(expectedPrefix)) {
    return {
      status: 400,
      body: { error: 'Security violation: Storage path does not match project organization scope.' },
    };
  }

  // Verify songId if supplied belongs to this project
  if (body.songId) {
    const { data: song, error: songErr } = await adminClient
      .from('project_songs')
      .select('id')
      .eq('id', body.songId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (songErr || !song) {
      return { status: 400, body: { error: 'Invalid song ID: Song does not belong to this project.' } };
    }
  }

  // Fetch caller profile
  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name, email')
    .eq('id', callerUser.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const newFileRecord: ProjectFileRecord = {
    id: body.fileId,
    organization_id: project.organization_id,
    project_id: projectId,
    song_id: body.songId || null,
    name: body.fileName.trim(),
    storage_path: body.storagePath,
    file_type: body.fileType || 'application/octet-stream',
    file_size: Math.max(0, Number(body.fileSize) || 0),
    uploaded_by: callerUser.id,
    uploader_name: profile?.full_name || callerUser.email || 'Team Member',
    uploader_email: callerUser.email || null,
    created_at: now,
    updated_at: now,
  };

  // Insert into public.project_files table
  const { error: insertErr } = await adminClient.from('project_files').insert({
    id: newFileRecord.id,
    organization_id: newFileRecord.organization_id,
    project_id: newFileRecord.project_id,
    song_id: newFileRecord.song_id,
    name: newFileRecord.name,
    storage_path: newFileRecord.storage_path,
    file_type: newFileRecord.file_type,
    file_size: newFileRecord.file_size,
    uploaded_by: newFileRecord.uploaded_by,
    created_at: newFileRecord.created_at,
    updated_at: newFileRecord.updated_at,
  });

  if (insertErr) {
    console.error('[MixFlow Files] Insert into project_files failed:', insertErr);
    return { status: 500, body: { error: 'Failed to record file metadata in database.' } };
  }

  return { status: 201, body: { file: newFileRecord } };
}

/**
 * 4. Get Signed Download URL
 * Generates short-lived signed URL for authenticated organization members.
 */
export async function handleGetSignedDownloadUrl(
  ctx: ProjectFilesHandlerContext & { fileId: string }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, fileId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, body: { error: 'Authentication required. Bearer token missing.' } };
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const userClient = createClientFn(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { status: 401, body: { error: 'Invalid or expired authentication session.' } };
  }
  const callerUser = userData.user;

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

  // Verify caller membership in organization
  const { data: membership, error: memErr } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (memErr || !membership) {
    return { status: 403, body: { error: 'Forbidden: You do not belong to this organization.' } };
  }

  // Find file metadata from public.project_files
  const { data: targetFile, error: fileErr } = await adminClient
    .from('project_files')
    .select('*')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (fileErr || !targetFile) {
    return { status: 404, body: { error: 'File record not found.' } };
  }

  // Security: Confirm storage path belongs to this organization and project
  const expectedPrefix = `${project.organization_id}/${projectId}/`;
  if (!targetFile.storage_path.startsWith(expectedPrefix)) {
    return { status: 403, body: { error: 'Security violation: File path mismatch.' } };
  }

  // Generate short-lived signed URL (300 seconds = 5 minutes)
  const { data: signedData, error: signErr } = await adminClient.storage
    .from('project-files')
    .createSignedUrl(targetFile.storage_path, 300);

  if (signErr || !signedData?.signedUrl) {
    console.error('[MixFlow Storage] createSignedUrl error:', signErr);
    return { status: 500, body: { error: signErr?.message || 'Failed to generate download URL.' } };
  }

  return {
    status: 200,
    body: {
      signedUrl: signedData.signedUrl,
      fileName: targetFile.name,
      fileType: targetFile.file_type,
    },
  };
}

/**
 * 5. Delete File
 * Verifies caller is studio manager or original uploader before removing from storage and DB.
 */
export async function handleDeleteProjectFile(
  ctx: ProjectFilesHandlerContext & { fileId: string }
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, fileId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, body: { error: 'Authentication required. Bearer token missing.' } };
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  const userClient = createClientFn(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { status: 401, body: { error: 'Invalid or expired authentication session.' } };
  }
  const callerUser = userData.user;

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

  // Verify caller membership in organization
  const { data: membership, error: memErr } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (memErr || !membership) {
    return { status: 403, body: { error: 'Forbidden: You do not belong to this organization.' } };
  }

  // Find file metadata from public.project_files
  const { data: targetFile, error: fileErr } = await adminClient
    .from('project_files')
    .select('*')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (fileErr || !targetFile) {
    return { status: 404, body: { error: 'File record not found.' } };
  }

  // Security: Check deletion permission
  // Only owner, admin, or the original uploader can delete
  const isManager = membership.role === 'owner' || membership.role === 'admin';
  const isUploader = targetFile.uploaded_by === callerUser.id;

  if (!isManager && !isUploader) {
    return {
      status: 403,
      body: { error: 'Forbidden: Only studio owners, admins, or the original uploader can delete this file.' },
    };
  }

  // Security: Ensure storage path is in this organization and project
  const expectedPrefix = `${project.organization_id}/${projectId}/`;
  if (!targetFile.storage_path.startsWith(expectedPrefix)) {
    return { status: 403, body: { error: 'Security violation: File path mismatch.' } };
  }

  // Remove from Supabase Storage
  try {
    await adminClient.storage.from('project-files').remove([targetFile.storage_path]);
  } catch (err: any) {
    console.warn('[MixFlow Storage] Failed to remove storage object:', err?.message);
  }

  // Remove from public.project_files DB table
  const { error: delErr } = await adminClient.from('project_files').delete().eq('id', fileId);
  if (delErr) {
    console.error('[MixFlow Files] Delete from project_files failed:', delErr);
    return { status: 500, body: { error: 'Failed to delete file from database.' } };
  }

  return { status: 200, body: { success: true } };
}
