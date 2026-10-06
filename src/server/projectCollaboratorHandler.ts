import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

interface Ctx {
  authHeader?: string;
  projectId?: string;
  body?: any;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

async function auth(ctx: Ctx) {
  if (!ctx.authHeader?.startsWith('Bearer ')) return { error: 'Authentication required.', status: 401 } as const;
  const token = ctx.authHeader.slice(7).trim();
  const fn = ctx.createClientFn || createClient;
  const client = fn(ctx.supabaseUrl, ctx.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { error: 'Invalid or expired authentication session.', status: 401 } as const;
  return { user: data.user } as const;
}

function hash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function token() {
  return crypto.randomBytes(32).toString('base64url');
}

async function projectAndMember(ctx: Ctx, roles = ['owner','admin','engineer','producer']) {
  const a = await auth(ctx);
  if ('error' in a) return a;
  const db = (ctx.createClientFn || createClient)(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: project, error } = await db.from('projects').select('id, organization_id').eq('id', ctx.projectId).maybeSingle();
  if (error || !project) return { error: 'Project not found.', status: 404 } as const;
  const { data: member } = await db.from('organization_members').select('role').eq('organization_id', project.organization_id).eq('user_id', a.user.id).maybeSingle();
  if (!member || !roles.includes(member.role)) return { error: 'Forbidden.', status: 403 } as const;
  return { user: a.user, project, db } as const;
}

export async function handleListCollaboratorInvites(ctx: Ctx) {
  const x = await projectAndMember(ctx);
  if ('error' in x) return { status: x.status, body: { error: x.error } };
  const { data, error } = await x.db.from('project_collaborator_invites')
    .select('id, project_id, invited_by, name, email, role, expires_at, accepted_at, revoked_at, created_at')
    .eq('project_id', x.project.id).order('created_at', { ascending: false });
  if (error) return { status: 500, body: { error: 'Failed to load collaborator invites.' } };
  return { status: 200, body: { invites: data || [] } };
}

export async function handleCreateCollaboratorInvite(ctx: Ctx) {
  const x = await projectAndMember(ctx);
  if ('error' in x) return { status: x.status, body: { error: x.error } };
  const body = ctx.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { error: 'Invalid email address.' } };
  const role = body.role === 'reviewer' ? 'reviewer' : 'contributor';
  const hours = Math.min(Math.max(Number(body.expiresHours) || 168, 1), 720);
  const rawToken = token();
  const { data, error } = await x.db.from('project_collaborator_invites').insert({
    organization_id: x.project.organization_id,
    project_id: x.project.id,
    invited_by: x.user.id,
    name: typeof body.name === 'string' ? body.name.trim() || null : null,
    email,
    role,
    token_hash: hash(rawToken),
    expires_at: new Date(Date.now() + hours * 3600000).toISOString(),
  }).select('id, project_id, name, email, role, expires_at, created_at').single();
  if (error || !data) return { status: 500, body: { error: 'Failed to create collaborator invite.' } };
  return { status: 201, body: { invite: data, token: rawToken, invitePath: `#/collaborator/${rawToken}` } };
}

export async function handleRevokeCollaboratorInvite(ctx: Ctx) {
  const x = await projectAndMember(ctx);
  if ('error' in x) return { status: x.status, body: { error: x.error } };
  const id = ctx.body?.inviteId;
  const { data: invite } = await x.db.from('project_collaborator_invites').select('id, project_id, revoked_at').eq('id', id).eq('project_id', x.project.id).maybeSingle();
  if (!invite) return { status: 404, body: { error: 'Invite not found.' } };
  if (!invite.revoked_at) {
    const { error } = await x.db.from('project_collaborator_invites').update({ revoked_at: new Date().toISOString() }).eq('id', invite.id);
    if (error) return { status: 500, body: { error: 'Failed to revoke invite.' } };
  }
  return { status: 200, body: { success: true } };
}

export async function handleRedeemCollaboratorInvite(ctx: Ctx) {
  const rawToken = typeof ctx.body?.token === 'string' ? ctx.body.token.trim() : '';
  if (!rawToken) return { status: 400, body: { error: 'Invite token is required.' } };
  const db = (ctx.createClientFn || createClient)(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: invite, error } = await db.from('project_collaborator_invites')
    .select('id, project_id, organization_id, name, email, role, expires_at, accepted_at, revoked_at')
    .eq('token_hash', hash(rawToken)).maybeSingle();
  if (error || !invite) return { status: 404, body: { error: 'Invalid collaborator invite.' } };
  if (invite.revoked_at) return { status: 410, body: { error: 'This collaborator invite has been revoked.' } };
  if (Date.parse(invite.expires_at) <= Date.now()) return { status: 410, body: { error: 'This collaborator invite has expired.' } };
  if (!invite.accepted_at) {
    await db.from('project_collaborator_invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);
  }
  return { status: 200, body: { collaborator: { projectId: invite.project_id, organizationId: invite.organization_id, name: invite.name, email: invite.email, role: invite.role, expiresAt: invite.expires_at }, token: rawToken } };
}
