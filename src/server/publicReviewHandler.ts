import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

interface PublicReviewContext {
  projectId: string;
  songId: string;
  token?: string;
  versionId?: string;
  body?: any;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

const client = (ctx: PublicReviewContext) => createClient(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

function expectedToken(projectId: string, songId: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(`${projectId}:${songId}`).digest('base64url');
}

function verify(ctx: PublicReviewContext) {
  const secret = ctx.supabaseServiceRoleKey;
  if (!secret || !ctx.token) return false;
  const expected = expectedToken(ctx.projectId, ctx.songId, secret);
  const actual = Buffer.from(ctx.token);\n  const expectedBuffer = Buffer.from(expected);\n  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

async function getProject(ctx: PublicReviewContext) {
  const db = client(ctx);
  const { data: project } = await db.from('projects').select('id, name, organization_id, client_id, status').eq('id', ctx.projectId).maybeSingle();
  if (!project) return null;
  const { data: song } = await db.from('project_songs').select('id, title, track_number').eq('id', ctx.songId).eq('project_id', ctx.projectId).maybeSingle();
  if (!song) return null;
  return { db, project, song };
}

export async function handleCreatePublicReviewLink(ctx: PublicReviewContext & { authHeader?: string }) {
  const token = ctx.authHeader?.replace(/^Bearer\\s+/, '').trim();
  if (!token) return { status: 401, body: { error: 'Authentication required.' } };

  // Link generation only needs the signed-in engineer's normal Supabase access.
  // This avoids requiring the privileged service-role key for this operation.
  const db = createClient(ctx.supabaseUrl, ctx.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error } = await db.auth.getUser(token);
  if (error || !userData.user) return { status: 401, body: { error: 'Invalid authentication session.' } };
  const { data: project } = await db.from('projects').select('id, organization_id').eq('id', ctx.projectId).maybeSingle();
  if (!project) return { status: 404, body: { error: 'Project not found.' } };
  const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', project.organization_id).eq('user_id', userData.user.id).maybeSingle();
  if (!membership || !['owner','admin','engineer','producer'].includes(membership.role)) return { status: 403, body: { error: 'Forbidden.' } };
  const { data: song } = await db.from('project_songs').select('id').eq('id', ctx.songId).eq('project_id', ctx.projectId).maybeSingle();
  if (!song) return { status: 404, body: { error: 'Song not found.' } };
  return { status: 200, body: { token: expectedToken(ctx.projectId, ctx.songId, ctx.supabaseServiceRoleKey) } };
}

export async function handlePublicReview(ctx: PublicReviewContext) {
  if (!verify(ctx)) return { status: 401, body: { error: 'Invalid or expired review link.' } };
  const found = await getProject(ctx);
  if (!found) return { status: 404, body: { error: 'Review not found.' } };
  const { db, project, song } = found;
  const { data: versions } = await db.from('project_file_versions').select('*').eq('project_id', ctx.projectId).eq('song_id', ctx.songId).order('version_number', { ascending: true });
  const ids = (versions || []).map(v => v.id);
  const { data: feedback } = ids.length ? await db.from('project_feedback').select('*').in('version_id', ids).order('timestamp_seconds', { ascending: true }) : { data: [] as any[] };
  const uploaderIds = Array.from(new Set((versions || []).map(v => v.uploaded_by).filter(Boolean)));
  const uploaderNames: Record<string,string> = {};
  if (uploaderIds.length) {
    const { data: profiles } = await db.from('profiles').select('id, full_name, email').in('id', uploaderIds);
    for (const p of profiles || []) uploaderNames[p.id] = p.full_name || p.email || 'Studio Engineer';
  }
  const enriched = (versions || []).map(v => ({ ...v, uploader_name: v.uploaded_by ? uploaderNames[v.uploaded_by] || 'Studio Engineer' : 'Studio Engineer', feedback_count: (feedback || []).filter(f => f.version_id === v.id).length, is_latest: v.id === (versions || [])[versions!.length - 1]?.id }));
  return { status: 200, body: { project: { id: project.id, name: project.name, status: project.status }, song, versions: enriched, feedback: feedback || [] } };
}

export async function handlePublicReviewPlayback(ctx: PublicReviewContext) {
  if (!verify(ctx)) return { status: 401, body: { error: 'Invalid or expired review link.' } };
  const found = await getProject(ctx);
  if (!found) return { status: 404, body: { error: 'Review not found.' } };
  const { data: version } = await found.db.from('project_file_versions').select('id, name, version_number, duration_seconds, storage_path, song_id').eq('id', ctx.versionId).eq('project_id', ctx.projectId).eq('song_id', ctx.songId).maybeSingle();
  if (!version) return { status: 404, body: { error: 'Audio version not found.' } };
  const { data, error } = await found.db.storage.from('project-files').createSignedUrl(version.storage_path, 300);
  if (error || !data?.signedUrl) return { status: 500, body: { error: 'Failed to generate secure audio playback link.' } };
  return { status: 200, body: { signedUrl: data.signedUrl, versionNumber: version.version_number, name: version.name, durationSeconds: version.duration_seconds } };
}

export async function handlePublicReviewFeedback(ctx: PublicReviewContext) {
  if (!verify(ctx)) return { status: 401, body: { error: 'Invalid or expired review link.' } };
  const found = await getProject(ctx);
  if (!found || !ctx.body?.versionId) return { status: 400, body: { error: 'Invalid review request.' } };
  const timestamp = Number(ctx.body.timestampSeconds);
  if (!Number.isFinite(timestamp) || timestamp < 0 || !String(ctx.body.comment || '').trim()) return { status: 400, body: { error: 'Timestamp and feedback comment are required.' } };
  const { data: version } = await found.db.from('project_file_versions').select('id, song_id').eq('id', ctx.body.versionId).eq('project_id', ctx.projectId).eq('song_id', ctx.songId).maybeSingle();
  if (!version) return { status: 404, body: { error: 'Audio version not found.' } };
  const row = { id: crypto.randomUUID(), organization_id: found.project.organization_id, project_id: ctx.projectId, song_id: ctx.songId, version_id: version.id, client_id: found.project.client_id, author_id: null, author_name: String(ctx.body.authorName || 'Client').trim().slice(0,100) || 'Client', author_role: 'client', timestamp_seconds: Math.round(timestamp * 100) / 100, comment: String(ctx.body.comment).trim(), status: 'open', created_at: new Date().toISOString(), resolved_at: null, resolved_by: null };
  const { data, error } = await found.db.from('project_feedback').insert(row).select().single();
  if (error) return { status: 500, body: { error: 'Failed to save feedback.' } };
  return { status: 201, body: { feedback: data } };
}

export async function handlePublicReviewAction(ctx: PublicReviewContext) {
  if (!verify(ctx)) return { status: 401, body: { error: 'Invalid or expired review link.' } };
  const found = await getProject(ctx);
  const action = ctx.body?.action;
  if (!found || !['revision_requested','mix_approved'].includes(action)) return { status: 400, body: { error: 'Invalid review action.' } };
  const versionId = ctx.body.versionId;
  const { data: version } = await found.db.from('project_file_versions').select('id, status').eq('id', versionId).eq('project_id', ctx.projectId).eq('song_id', ctx.songId).maybeSingle();
  if (!version) return { status: 404, body: { error: 'Audio version not found.' } };
  if (action === 'mix_approved') {
    const { data: open } = await found.db.from('project_feedback').select('id').eq('version_id', versionId).eq('status','open').limit(1);
    if (open?.length) return { status: 409, body: { error: 'Resolve all open feedback before approving the mix.' } };
  }
  const toStatus = action === 'revision_requested' ? 'needs_revision' : 'approved';
  const versionStatus = action === 'revision_requested' ? 'revision_requested' : 'approved';
  await found.db.from('project_file_versions').update({ status: versionStatus }).eq('id', versionId);
  const { data: project, error } = await found.db.from('projects').update({ status: toStatus, updated_at: new Date().toISOString() }).eq('id', ctx.projectId).select().single();
  if (error) return { status: 500, body: { error: 'Failed to update review status.' } };
  return { status: 200, body: { project } };
}
