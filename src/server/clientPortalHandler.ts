import { createClient } from '@supabase/supabase-js';
import {
  ClientPortalProjectSummary,
  ClientPortalProjectDetail,
  ClientPortalProfile,
  ClientPortalSongItem,
  ClientPortalFileItem,
} from '../types/clientPortal.js';

interface ClientPortalHandlerContext {
  authHeader?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

/**
 * Authenticates the caller using Supabase Auth
 * Returns the caller user object or throws an error response
 */
async function authenticateCaller(ctx: ClientPortalHandlerContext) {
  const { authHeader, supabaseUrl, supabaseAnonKey, createClientFn } = ctx;
  const clientFactory = createClientFn || createClient;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { errorStatus: 401, errorBody: { error: 'Authentication required. Bearer token missing.' } };
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  if (!token) {
    return { errorStatus: 401, errorBody: { error: 'Authentication required. Empty token provided.' } };
  }

  const userClient = clientFactory(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { errorStatus: 401, errorBody: { error: 'Invalid or expired authentication session.' } };
  }

  return { callerUser: userData.user };
}

/**
 * Finds client records associated with an authenticated user.
 * Matches by user_id, or safely links by verified user email if unlinked.
 */
async function getAssociatedClients(
  adminClient: any,
  userId: string,
  userEmail?: string | null,
  emailConfirmed = false
): Promise<any[]> {
  // 1. Direct match by user_id
  const { data: directClients } = await adminClient
    .from('clients')
    .select('*')
    .eq('user_id', userId);

  if (directClients && directClients.length > 0) {
    return directClients;
  }

  // 2. Only link an unassigned client by email when Supabase Auth confirms
  // the caller owns that email address. Never infer identity from an
  // unverified auth email.
  if (userEmail && emailConfirmed) {
    const { data: emailClients } = await adminClient
      .from('clients')
      .select('*')
      .ilike('email', userEmail.trim().toLowerCase());

    if (emailClients && emailClients.length > 0) {
      // Link the first unlinked client to this user
      for (const cl of emailClients) {
        if (!cl.user_id) {
          await adminClient
            .from('clients')
            .update({ user_id: userId, updated_at: new Date().toISOString() })
            .eq('id', cl.id);
          cl.user_id = userId;
        }
      }
      return emailClients;
    }
  }

  return [];
}

/**
 * 1. GET /api/client-portal/me
 * Returns client profile for authenticated user
 */
export async function handleGetClientPortalMe(
  ctx: ClientPortalHandlerContext
): Promise<{ status: number; body: any }> {
  const authRes = await authenticateCaller(ctx);
  if (authRes.errorStatus) {
    return { status: authRes.errorStatus, body: authRes.errorBody };
  }
  const callerUser = authRes.callerUser!;

  const clientFactory = ctx.createClientFn || createClient;
  const adminClient = clientFactory(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clients = await getAssociatedClients(
    adminClient,
    callerUser.id,
    callerUser.email,
    callerUser.email_confirmed_at != null
  );
  if (!clients || clients.length === 0) {
    return {
      status: 200,
      body: {
        isClient: false,
        client: null,
        message: 'No client profile associated with this account.',
      },
    };
  }

  const primaryClient = clients[0];
  const profile: ClientPortalProfile = {
    id: primaryClient.id,
    full_name: primaryClient.full_name,
    email: primaryClient.email,
    company_name: primaryClient.company_name,
    phone: primaryClient.phone,
  };

  return {
    status: 200,
    body: {
      isClient: true,
      client: profile,
    },
  };
}

/**
 * 2. GET /api/client-portal/projects
 * Lists all projects belonging exclusively to this authenticated client
 */
export async function handleGetClientPortalProjects(
  ctx: ClientPortalHandlerContext
): Promise<{ status: number; body: any }> {
  const authRes = await authenticateCaller(ctx);
  if (authRes.errorStatus) {
    return { status: authRes.errorStatus, body: authRes.errorBody };
  }
  const callerUser = authRes.callerUser!;

  const clientFactory = ctx.createClientFn || createClient;
  const adminClient = clientFactory(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clients = await getAssociatedClients(
    adminClient,
    callerUser.id,
    callerUser.email,
    callerUser.email_confirmed_at != null
  );
  if (!clients || clients.length === 0) {
    return { status: 200, body: { projects: [] } };
  }

  const clientIds = clients.map((c) => c.id);

  // Authoritatively fetch projects where client_id belongs to the caller's client records
  const { data: projectRows, error: pErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id, name, project_type, status, deadline, created_at, updated_at')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false });

  if (pErr) {
    console.error('[MixFlow Client Portal] Error querying client projects:', pErr);
    return { status: 500, body: { error: 'Failed to retrieve client projects.' } };
  }

  const rawProjects = projectRows || [];
  if (rawProjects.length === 0) {
    return { status: 200, body: { projects: [] } };
  }

  const projectIds = rawProjects.map((p: any) => p.id);

  // Aggregate song counts
  const { data: songsData } = await adminClient
    .from('project_songs')
    .select('project_id')
    .in('project_id', projectIds);

  const songCountMap: Record<string, number> = {};
  for (const s of songsData || []) {
    songCountMap[s.project_id] = (songCountMap[s.project_id] || 0) + 1;
  }

  // Aggregate file counts
  const { data: filesData } = await adminClient
    .from('project_files')
    .select('project_id')
    .in('project_id', projectIds);

  const fileCountMap: Record<string, number> = {};
  for (const f of filesData || []) {
    fileCountMap[f.project_id] = (fileCountMap[f.project_id] || 0) + 1;
  }

  const projects: ClientPortalProjectSummary[] = rawProjects.map((p: any) => ({
    id: p.id,
    organization_id: p.organization_id,
    client_id: p.client_id,
    name: p.name,
    project_type: p.project_type,
    status: p.status,
    deadline: p.deadline || null,
    song_count: songCountMap[p.id] || 0,
    file_count: fileCountMap[p.id] || 0,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  return { status: 200, body: { projects } };
}

/**
 * 3. GET /api/client-portal/projects/:projectId
 * Returns details, songs, and files for a single project belonging to the client
 */
export async function handleGetClientPortalProjectDetail(
  ctx: ClientPortalHandlerContext & { projectId: string }
): Promise<{ status: number; body: any }> {
  const authRes = await authenticateCaller(ctx);
  if (authRes.errorStatus) {
    return { status: authRes.errorStatus, body: authRes.errorBody };
  }
  const callerUser = authRes.callerUser!;

  const clientFactory = ctx.createClientFn || createClient;
  const adminClient = clientFactory(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clients = await getAssociatedClients(
    adminClient,
    callerUser.id,
    callerUser.email,
    callerUser.email_confirmed_at != null
  );
  if (!clients || clients.length === 0) {
    return { status: 403, body: { error: 'Forbidden: No client profile associated with this account.' } };
  }

  const clientIds = clients.map((c) => c.id);

  // Fetch project and verify ownership by client
  const { data: project, error: pErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id, name, project_type, description, status, deadline, project_price, deposit_amount, created_at, updated_at')
    .eq('id', ctx.projectId)
    .maybeSingle();

  if (pErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Security check: Client A cannot access Client B's projects
  if (!clientIds.includes(project.client_id)) {
    return {
      status: 403,
      body: { error: 'Forbidden: You do not have access to this project.' },
    };
  }

  // Fetch songs
  const { data: songsData, error: sErr } = await adminClient
    .from('project_songs')
    .select('id, project_id, title, track_number, status')
    .eq('project_id', ctx.projectId)
    .order('track_number', { ascending: true });

  if (sErr) {
    console.error('[MixFlow Client Portal] Error querying songs:', sErr);
  }

  // Fetch files (without exposing internal uploader UUIDs or sensitive internals)
  const { data: filesData, error: fErr } = await adminClient
    .from('project_files')
    .select('id, project_id, song_id, name, file_type, file_size, created_at')
    .eq('project_id', ctx.projectId)
    .order('created_at', { ascending: false });

  if (fErr) {
    console.error('[MixFlow Client Portal] Error querying files:', fErr);
  }

  const songs: ClientPortalSongItem[] = (songsData || []).map((s: any) => ({
    id: s.id,
    project_id: s.project_id,
    title: s.title,
    track_number: s.track_number,
    status: s.status,
  }));

  const files: ClientPortalFileItem[] = (filesData || []).map((f: any) => ({
    id: f.id,
    project_id: f.project_id,
    song_id: f.song_id || null,
    name: f.name,
    file_type: f.file_type,
    file_size: Number(f.file_size) || 0,
    created_at: f.created_at,
  }));

  const detail: ClientPortalProjectDetail = {
    id: project.id,
    organization_id: project.organization_id,
    client_id: project.client_id,
    name: project.name,
    project_type: project.project_type,
    description: project.description || null,
    status: project.status,
    deadline: project.deadline || null,
    project_price: Number(project.project_price) || 0,
    deposit_amount: Number(project.deposit_amount) || 0,
    created_at: project.created_at,
    updated_at: project.updated_at,
    songs,
    files,
  };

  return { status: 200, body: detail };
}

/**
 * 4. POST /api/client-portal/projects/:projectId/files/:fileId/download-url
 * Generates temporary signed download URL for an authorized project file
 */
export async function handleGetClientPortalFileDownloadUrl(
  ctx: ClientPortalHandlerContext & { projectId: string; fileId: string }
): Promise<{ status: number; body: any }> {
  const authRes = await authenticateCaller(ctx);
  if (authRes.errorStatus) {
    return { status: authRes.errorStatus, body: authRes.errorBody };
  }
  const callerUser = authRes.callerUser!;

  const clientFactory = ctx.createClientFn || createClient;
  const adminClient = clientFactory(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clients = await getAssociatedClients(
    adminClient,
    callerUser.id,
    callerUser.email,
    callerUser.email_confirmed_at != null
  );
  if (!clients || clients.length === 0) {
    return { status: 403, body: { error: 'Forbidden: No client profile associated with this account.' } };
  }

  const clientIds = clients.map((c) => c.id);

  // Verify project exists and belongs to this client
  const { data: project, error: pErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', ctx.projectId)
    .maybeSingle();

  if (pErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  if (!clientIds.includes(project.client_id)) {
    return {
      status: 403,
      body: { error: 'Forbidden: You do not have access to files for this project.' },
    };
  }

  // Verify file exists and belongs to this project
  const { data: targetFile, error: fErr } = await adminClient
    .from('project_files')
    .select('id, project_id, organization_id, name, storage_path, file_type')
    .eq('id', ctx.fileId)
    .eq('project_id', ctx.projectId)
    .maybeSingle();

  if (fErr || !targetFile) {
    return { status: 404, body: { error: 'File not found.' } };
  }

  // Security: Confirm storage path strictly scopes to organization_id/project_id/
  const expectedPrefix = `${project.organization_id}/${ctx.projectId}/`;
  if (!targetFile.storage_path.startsWith(expectedPrefix)) {
    return { status: 403, body: { error: 'Security violation: File path mismatch.' } };
  }

  // Generate short-lived signed URL (300 seconds = 5 minutes)
  const { data: signedData, error: signErr } = await adminClient.storage
    .from('project-files')
    .createSignedUrl(targetFile.storage_path, 300);

  if (signErr || !signedData?.signedUrl) {
    console.error('[MixFlow Storage] Failed to generate signed download URL for client:', signErr);
    return { status: 500, body: { error: 'Failed to generate download URL.' } };
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
 * 5. POST /api/client-portal/projects/:projectId/files/upload-url
 * Generates a signed upload URL for a client-owned project file.
 */
export async function handleCreateClientFileUploadUrl(
  ctx: ClientPortalHandlerContext & { projectId: string; body: { fileName: string; fileType: string; fileSize: number; songId?: string | null } }
): Promise<{ status: number; body: any }> {
  const authRes = await authenticateCaller(ctx);
  if (authRes.errorStatus) return { status: authRes.errorStatus, body: authRes.errorBody };
  const callerUser = authRes.callerUser!;

  const clientFactory = ctx.createClientFn || createClient;
  const adminClient = clientFactory(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clients = await getAssociatedClients(
    adminClient,
    callerUser.id,
    callerUser.email,
    callerUser.email_confirmed_at != null
  );
  if (!clients.length) {
    return { status: 403, body: { error: 'Forbidden: No client profile associated with this account.' } };
  }

  const { data: project, error: projectErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', ctx.projectId)
    .maybeSingle();

  if (projectErr || !project) return { status: 404, body: { error: 'Project not found.' } };
  if (!clients.some((client: any) => client.id === project.client_id)) {
    return { status: 403, body: { error: 'Forbidden: You do not have access to this project.' } };
  }

  if (!ctx.body.fileName?.trim()) {
    return { status: 400, body: { error: 'File name is required.' } };
  }

  if (ctx.body.songId) {
    const { data: song } = await adminClient
      .from('project_songs')
      .select('id')
      .eq('id', ctx.body.songId)
      .eq('project_id', ctx.projectId)
      .maybeSingle();
    if (!song) return { status: 400, body: { error: 'Invalid song selected.' } };
  }

  const fileId = crypto.randomUUID();
  const sanitizedName = ctx.body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${project.organization_id}/${ctx.projectId}/${fileId}_${sanitizedName}`;

  const { data: uploadInfo, error: uploadErr } = await adminClient.storage
    .from('project-files')
    .createSignedUploadUrl(storagePath);

  if (uploadErr || !uploadInfo) {
    return { status: 500, body: { error: uploadErr?.message || 'Failed to prepare file upload.' } };
  }

  return {
    status: 200,
    body: { fileId, storagePath, signedUrl: uploadInfo.signedUrl, token: uploadInfo.token },
  };
}

/**
 * 6. POST /api/client-portal/projects/:projectId/files/confirm
 * Confirms a client-owned project file after direct storage upload.
 */
export async function handleConfirmClientFileUpload(
  ctx: ClientPortalHandlerContext & { projectId: string; body: { fileId: string; storagePath: string; fileName: string; fileType: string; fileSize: number; songId?: string | null } }
): Promise<{ status: number; body: any }> {
  const authRes = await authenticateCaller(ctx);
  if (authRes.errorStatus) return { status: authRes.errorStatus, body: authRes.errorBody };
  const callerUser = authRes.callerUser!;

  const clientFactory = ctx.createClientFn || createClient;
  const adminClient = clientFactory(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clients = await getAssociatedClients(
    adminClient,
    callerUser.id,
    callerUser.email,
    callerUser.email_confirmed_at != null
  );
  if (!clients.length) return { status: 403, body: { error: 'Forbidden: No client profile associated with this account.' } };

  const { data: project } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', ctx.projectId)
    .maybeSingle();

  if (!project) return { status: 404, body: { error: 'Project not found.' } };
  if (!clients.some((client: any) => client.id === project.client_id)) {
    return { status: 403, body: { error: 'Forbidden: You do not have access to this project.' } };
  }

  const expectedPrefix = `${project.organization_id}/${ctx.projectId}/`;
  const expectedFilePrefix = expectedPrefix + ctx.body.fileId + '_';
  if (!ctx.body.storagePath.startsWith(expectedFilePrefix)) {
    return { status: 400, body: { error: 'Security violation: Invalid project file path.' } };
  }

  if (ctx.body.songId) {
    const { data: song } = await adminClient
      .from('project_songs')
      .select('id')
      .eq('id', ctx.body.songId)
      .eq('project_id', ctx.projectId)
      .maybeSingle();
    if (!song) return { status: 400, body: { error: 'Invalid song selected.' } };
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name, email')
    .eq('id', callerUser.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const fileRecord = {
    id: ctx.body.fileId,
    organization_id: project.organization_id,
    project_id: ctx.projectId,
    song_id: ctx.body.songId || null,
    name: ctx.body.fileName.trim(),
    storage_path: ctx.body.storagePath,
    file_type: ctx.body.fileType || 'application/octet-stream',
    file_size: Math.max(0, Number(ctx.body.fileSize) || 0),
    uploaded_by: callerUser.id,
    uploader_name: profile?.full_name || callerUser.email || 'Client',
    uploader_email: callerUser.email || null,
    created_at: now,
    updated_at: now,
  };

  const { error: insertErr } = await adminClient.from('project_files').insert({
    id: fileRecord.id,
    organization_id: fileRecord.organization_id,
    project_id: fileRecord.project_id,
    song_id: fileRecord.song_id,
    name: fileRecord.name,
    storage_path: fileRecord.storage_path,
    file_type: fileRecord.file_type,
    file_size: fileRecord.file_size,
    uploaded_by: fileRecord.uploaded_by,
    created_at: fileRecord.created_at,
    updated_at: fileRecord.updated_at,
  });

  if (insertErr) {
    return { status: 500, body: { error: 'Failed to record the uploaded file.' } };
  }

  return { status: 201, body: { file: fileRecord } };
}

/**
 * POST /api/client-portal/projects/claim
 * Claims a project for the authenticated client using its unique project code.
 */
export async function handleClaimClientProject(
  ctx: ClientPortalHandlerContext & { body?: { projectCode?: string } }
): Promise<{ status: number; body: any }> {
  const authRes = await authenticateCaller(ctx);
  if (authRes.errorStatus) {
    return { status: authRes.errorStatus, body: authRes.errorBody };
  }

  const callerUser = authRes.callerUser!;
  if (callerUser.user_metadata?.account_type !== 'client') {
    return { status: 403, body: { error: 'Only client accounts can add projects by code.' } };
  }

  const projectCode = String(ctx.body?.projectCode || '').trim().toUpperCase();
  if (!/^MF-[A-Z0-9]{12}$/.test(projectCode)) {
    return { status: 400, body: { error: 'Enter a valid MixFlow project code.' } };
  }

  const clientFactory = ctx.createClientFn || createClient;
  const adminClient = clientFactory(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project, error: projectError } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id, name, project_code')
    .eq('project_code', projectCode)
    .maybeSingle();

  if (projectError) {
    console.error('[MixFlow Client Portal] Project code lookup failed:', projectError);
    return { status: 500, body: { error: 'Unable to verify that project code right now.' } };
  }

  if (!project) {
    return { status: 404, body: { error: 'That project code is not valid. Please check the code and try again.' } };
  }

  // Never allow a project already assigned to a different authenticated client
  // to be silently taken over.
  const { data: currentProjectClient } = await adminClient
    .from('clients')
    .select('id, user_id, organization_id, full_name, email')
    .eq('id', project.client_id)
    .maybeSingle();

  if (currentProjectClient?.user_id && currentProjectClient.user_id !== callerUser.id) {
    return { status: 409, body: { error: 'This project is already assigned to another MixFlow client account.' } };
  }

  // Prefer an existing client record for this account in the project's organization.
  // Otherwise, securely attach the project's existing unassigned client record.
  let targetClient: any = null;

  const { data: existingClient } = await adminClient
    .from('clients')
    .select('*')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (existingClient) {
    targetClient = existingClient;
  } else if (currentProjectClient && !currentProjectClient.user_id) {
    const { data: linkedClient, error: linkError } = await adminClient
      .from('clients')
      .update({
        user_id: callerUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentProjectClient.id)
      .is('user_id', null)
      .select('*')
      .maybeSingle();

    if (linkError || !linkedClient) {
      return { status: 409, body: { error: 'This project could not be linked to your client account. Please try again.' } };
    }
    targetClient = linkedClient;
  }

  if (!targetClient) {
    // This is a defensive fallback for legacy projects whose client row cannot
    // be linked directly. Create a client record only within this organization.
    const { data: createdClient, error: createClientError } = await adminClient
      .from('clients')
      .insert({
        organization_id: project.organization_id,
        full_name: callerUser.user_metadata?.full_name || callerUser.email || 'MixFlow Client',
        email: callerUser.email || null,
        user_id: callerUser.id,
      })
      .select('*')
      .single();

    if (createClientError || !createdClient) {
      console.error('[MixFlow Client Portal] Client record creation failed:', createClientError);
      return { status: 500, body: { error: 'Your account could not be linked to this project.' } };
    }
    targetClient = createdClient;
  }

  if (project.client_id !== targetClient.id) {
    const { error: projectUpdateError } = await adminClient
      .from('projects')
      .update({
        client_id: targetClient.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    if (projectUpdateError) {
      console.error('[MixFlow Client Portal] Project claim update failed:', projectUpdateError);
      return { status: 500, body: { error: 'The project was verified but could not be added to your library.' } };
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      project: {
        id: project.id,
        name: project.name,
        project_code: project.project_code,
      },
    },
  };
}
