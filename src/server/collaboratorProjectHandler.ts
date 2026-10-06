import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { resolveCollaboratorSession } from './collaboratorHandler.js';

type Ctx = {
  body?: any;
  projectId?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
};

function db(ctx: Ctx) {
  return (ctx.createClientFn || createClient)(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function tokenFrom(ctx: Ctx) {
  return typeof ctx.body?.sessionToken === 'string' ? ctx.body.sessionToken.trim() : '';
}

async function session(ctx: Ctx) {
  const token = tokenFrom(ctx);
  if (!token) return null;
  return resolveCollaboratorSession(ctx, token);
}

async function projectAccess(ctx: Ctx) {
  const s = await session(ctx);
  if (!s || !ctx.projectId || s.project_id !== ctx.projectId) return null;
  return s;
}

export async function handleCollaboratorProjectFiles(ctx: Ctx) {
  const s = await projectAccess(ctx);
  if (!s) return { status: 401, body: { error: 'Invalid or expired collaborator session.' } };

  const client = db(ctx);
  const { data, error } = await client
    .from('project_files')
    .select('id, project_id, song_id, name, file_type, file_size, created_at, updated_at')
    .eq('project_id', ctx.projectId)
    .order('created_at', { ascending: false });

  if (error) return { status: 500, body: { error: 'Failed to retrieve project files.' } };
  return { status: 200, body: { files: data || [], collaborator_role: s.role } };
}

export async function handleCollaboratorFileDownload(ctx: Ctx) {
  const s = await projectAccess(ctx);
  if (!s) return { status: 401, body: { error: 'Invalid or expired collaborator session.' } };
  if (!ctx.body?.fileId) return { status: 400, body: { error: 'File ID is required.' } };

  const client = db(ctx);
  const { data: file, error } = await client
    .from('project_files')
    .select('id, project_id, name, file_type, storage_path')
    .eq('id', ctx.body.fileId)
    .eq('project_id', ctx.projectId)
    .maybeSingle();

  if (error || !file) return { status: 404, body: { error: 'File not found.' } };

  const { data: project } = await client
    .from('projects')
    .select('organization_id')
    .eq('id', ctx.projectId)
    .maybeSingle();

  if (!project || !file.storage_path.startsWith(`${project.organization_id}/${ctx.projectId}/`)) {
    return { status: 403, body: { error: 'Security violation: File path mismatch.' } };
  }

  const { data: signed, error: signErr } = await client.storage
    .from('project-files')
    .createSignedUrl(file.storage_path, 300);

  if (signErr || !signed?.signedUrl) return { status: 500, body: { error: 'Failed to generate download URL.' } };
  return { status: 200, body: { signedUrl: signed.signedUrl, fileName: file.name, fileType: file.file_type } };
}

export async function handleCollaboratorVersions(ctx: Ctx) {
  const s = await projectAccess(ctx);
  if (!s) return { status: 401, body: { error: 'Invalid or expired collaborator session.' } };

  const client = db(ctx);
  const { data, error } = await client
    .from('project_file_versions')
    .select('id, project_id, song_id, file_id, version_number, name, file_type, file_size, duration_seconds, notes, created_at')
    .eq('project_id', ctx.projectId)
    .order('version_number', { ascending: true });

  if (error) return { status: 500, body: { error: 'Failed to retrieve audio versions.' } };
  return { status: 200, body: { versions: data || [], collaborator_role: s.role } };
}

export async function handleCollaboratorPlayback(ctx: Ctx) {
  const s = await projectAccess(ctx);
  if (!s) return { status: 401, body: { error: 'Invalid or expired collaborator session.' } };
  if (!ctx.body?.versionId) return { status: 400, body: { error: 'Version ID is required.' } };

  const client = db(ctx);
  const { data: version, error } = await client
    .from('project_file_versions')
    .select('id, project_id, name, file_type, storage_path')
    .eq('id', ctx.body.versionId)
    .eq('project_id', ctx.projectId)
    .maybeSingle();

  if (error || !version) return { status: 404, body: { error: 'Version not found.' } };

  const { data: project } = await client
    .from('projects')
    .select('organization_id')
    .eq('id', ctx.projectId)
    .maybeSingle();

  if (!project || !version.storage_path.startsWith(`${project.organization_id}/${ctx.projectId}/`)) {
    return { status: 403, body: { error: 'Security violation: Version path mismatch.' } };
  }

  const { data: signed, error: signErr } = await client.storage
    .from('project-files')
    .createSignedUrl(version.storage_path, 300);

  if (signErr || !signed?.signedUrl) return { status: 500, body: { error: 'Failed to generate playback URL.' } };
  return { status: 200, body: { signedUrl: signed.signedUrl, fileName: version.name, fileType: version.file_type } };
}

export async function handleCollaboratorRequestVersionUpload(ctx: Ctx) {
  const s = await projectAccess(ctx);
  if (!s) return { status: 401, body: { error: 'Invalid or expired collaborator session.' } };
  if (s.role !== 'contributor') return { status: 403, body: { error: 'Reviewer collaborators cannot upload versions.' } };
  if (!ctx.body?.fileName || !String(ctx.body.fileName).trim()) return { status: 400, body: { error: 'File name is required.' } };

  const client = db(ctx);
  const { data: project } = await client
    .from('projects')
    .select('id, organization_id')
    .eq('id', ctx.projectId)
    .maybeSingle();
  if (!project) return { status: 404, body: { error: 'Project not found.' } };

  if (ctx.body.songId) {
    const { data: song } = await client.from('project_songs').select('id').eq('id', ctx.body.songId).eq('project_id', ctx.projectId).maybeSingle();
    if (!song) return { status: 400, body: { error: 'Invalid song ID.' } };
  }

  const versionId = crypto.randomUUID();
  const safeName = String(ctx.body.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${project.organization_id}/${ctx.projectId}/${versionId}_${safeName}`;

  const { data: upload, error } = await client.storage.from('project-files').createSignedUploadUrl(storagePath);
  if (error || !upload) return { status: 500, body: { error: 'Failed to generate signed upload URL.' } };

  return { status: 200, body: { versionId, storagePath, signedUrl: upload.signedUrl, token: upload.token } };
}

export async function handleCollaboratorListFeedback(ctx: Ctx) {
  const s = await projectAccess(ctx);
  if (!s) return { status: 401, body: { error: 'Invalid or expired collaborator session.' } };

  const client = db(ctx);
  const { data, error } = await client
    .from('project_feedback')
    .select('id, project_id, song_id, version_id, author_name, author_role, timestamp_seconds, comment, status, created_at, resolved_at')
    .eq('project_id', ctx.projectId)
    .order('created_at', { ascending: true });

  if (error) return { status: 500, body: { error: 'Failed to retrieve project feedback.' } };
  return { status: 200, body: { feedback: data || [] } };
}

export async function handleCollaboratorCreateFeedback(ctx: Ctx) {
  const s = await projectAccess(ctx);
  if (!s) return { status: 401, body: { error: 'Invalid or expired collaborator session.' } };

  const b = ctx.body || {};
  const timestampSeconds = Number(b.timestampSeconds);
  const comment = typeof b.comment === 'string' ? b.comment.trim() : '';
  if (!b.versionId || !Number.isFinite(timestampSeconds) || timestampSeconds < 0 || !comment) {
    return { status: 400, body: { error: 'versionId, timestampSeconds and comment are required.' } };
  }

  const client = db(ctx);
  const { data: version } = await client
    .from('project_file_versions')
    .select('id, project_id, song_id')
    .eq('id', b.versionId)
    .eq('project_id', ctx.projectId)
    .maybeSingle();
  if (!version) return { status: 400, body: { error: 'Version does not belong to this project.' } };

  const { data: invite } = await client
    .from('project_collaborator_invites')
    .select('name, email')
    .eq('id', (await client.from('project_collaborator_sessions').select('invite_id').eq('id', s.id).maybeSingle()).data?.invite_id || '')
    .maybeSingle();

  const authorName = invite?.name || invite?.email || 'Collaborator';

  const { data: feedback, error } = await client
    .from('project_feedback')
    .insert({
      organization_id: (await client.from('projects').select('organization_id').eq('id', ctx.projectId).single()).data?.organization_id,
      project_id: ctx.projectId,
      song_id: b.songId || version.song_id || null,
      version_id: b.versionId,
      client_id: null,
      author_id: null,
      author_name: authorName,
      author_role: 'collaborator',
      timestamp_seconds: timestampSeconds,
      comment,
      status: 'open',
    })
    .select()
    .single();

  if (error || !feedback) return { status: 500, body: { error: 'Failed to save collaborator feedback.' } };
  return { status: 201, body: { feedback } };
}

export async function handleCollaboratorConfirmVersion(ctx: Ctx) {
  const s = await projectAccess(ctx);
  if (!s) return { status: 401, body: { error: 'Invalid or expired collaborator session.' } };
  if (s.role !== 'contributor') return { status: 403, body: { error: 'Reviewer collaborators cannot confirm uploads.' } };

  const b = ctx.body || {};
  if (!b.versionId || !b.storagePath || !b.fileName) return { status: 400, body: { error: 'versionId, storagePath and fileName are required.' } };

  const client = db(ctx);
  const { data: project } = await client.from('projects').select('id, organization_id').eq('id', ctx.projectId).maybeSingle();
  if (!project) return { status: 404, body: { error: 'Project not found.' } };

  const prefix = `${project.organization_id}/${ctx.projectId}/`;
  if (!b.storagePath.startsWith(prefix + b.versionId + '_')) {
    return { status: 400, body: { error: 'Security violation: Storage path does not match version ID.' } };
  }

  if (b.songId) {
    const { data: song } = await client.from('project_songs').select('id').eq('id', b.songId).eq('project_id', ctx.projectId).maybeSingle();
    if (!song) return { status: 400, body: { error: 'Invalid song ID.' } };
  }

  let query = client.from('project_file_versions').select('version_number').eq('project_id', ctx.projectId);
  if (b.songId) query = query.eq('song_id', b.songId);
  const { data: versions } = await query.order('version_number', { ascending: false }).limit(1);
  const next = (versions?.[0]?.version_number || 0) + 1;

  const { data: inserted, error } = await client.from('project_file_versions').insert({
    id: b.versionId,
    organization_id: project.organization_id,
    project_id: ctx.projectId,
    song_id: b.songId || null,
    file_id: b.fileId || null,
    version_number: next,
    name: String(b.fileName).trim(),
    storage_path: b.storagePath,
    file_type: b.fileType || 'audio/wav',
    file_size: Math.max(0, Number(b.fileSize) || 0),
    duration_seconds: b.durationSeconds ? Math.max(0, Number(b.durationSeconds)) : null,
    notes: b.notes?.trim() || null,
  }).select().single();

  if (error || !inserted) return { status: 500, body: { error: 'Failed to record collaborator version.' } };
  return { status: 201, body: { version: inserted } };
}
