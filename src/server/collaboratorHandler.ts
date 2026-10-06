import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

type Ctx = {
  authHeader?: string;
  projectId?: string;
  body?: any;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
};

const INVITE_DAYS = 7;
const SESSION_DAYS = 30;
const INVITE_ROLES = ['contributor', 'reviewer'] as const;
type CollaboratorRole = typeof INVITE_ROLES[number];

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

async function authenticate(ctx: Ctx) {
  if (!ctx.authHeader?.toLowerCase().startsWith('bearer ')) {
    return { error: 'Authentication required.', status: 401 } as const;
  }
  const token = ctx.authHeader.replace(/^bearer\s+/i, '').trim();
  if (!token) return { error: 'Authentication required.', status: 401 } as const;
  const client = (ctx.createClientFn || createClient)(ctx.supabaseUrl, ctx.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { error: 'Invalid or expired session.', status: 401 } as const;
  return { user: data.user } as const;
}

function admin(ctx: Ctx) {
  return (ctx.createClientFn || createClient)(ctx.supabaseUrl, ctx.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function verifyProjectRole(ctx: Ctx, projectId: string, userId: string) {
  const db = admin(ctx);
  const { data: project, error: projectErr } = await db
    .from('projects')
    .select('id, organization_id, name')
    .eq('id', projectId)
    .maybeSingle();
  if (projectErr || !project) return { error: 'Project not found.', status: 404 } as const;

  const { data: membership, error: memberErr } = await db
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (memberErr) return { error: 'Failed to verify project membership.', status: 500 } as const;
  if (!membership || !['owner', 'admin', 'engineer', 'producer'].includes(membership.role)) {
    return { error: 'Forbidden: insufficient project permissions.', status: 403 } as const;
  }
  return { db, project, membership } as const;
}

export async function handleCreateCollaboratorInvite(ctx: Ctx) {
  const auth = await authenticate(ctx);
  if ('error' in auth) return { status: auth.status, body: { error: auth.error } };
  if (!ctx.projectId) return { status: 400, body: { error: 'Project ID is required.' } };

  const access = await verifyProjectRole(ctx, ctx.projectId, auth.user.id);
  if ('error' in access) return { status: access.status, body: { error: access.error } };

  const name = typeof ctx.body?.name === 'string' ? ctx.body.name.trim().slice(0, 120) : null;
  const email = typeof ctx.body?.email === 'string' ? ctx.body.email.trim().toLowerCase() : null;
  const role = typeof ctx.body?.role === 'string' ? ctx.body.role.trim().toLowerCase() : 'contributor';

  if (!INVITE_ROLES.includes(role as CollaboratorRole)) {
    return { status: 400, body: { error: 'Invalid collaborator role.' } };
  }

  const rawToken = randomToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86400000).toISOString();

  const { data: invite, error } = await access.db
    .from('project_collaborator_invites')
    .insert({
      organization_id: access.project.organization_id,
      project_id: ctx.projectId,
      invited_by: auth.user.id,
      name,
      email,
      role,
      token_hash: hashToken(rawToken),
      expires_at: expiresAt,
    })
    .select('id, project_id, name, email, role, expires_at, created_at')
    .single();

  if (error || !invite) {
    return { status: 500, body: { error: 'Failed to create collaborator invite.' } };
  }

  return {
    status: 201,
    body: {
      success: true,
      invite,
      invite_token: rawToken,
      invite_path: `#/collaborator/invite/${rawToken}`,
    },
  };
}

export async function handleListCollaboratorInvites(ctx: Ctx) {
  const auth = await authenticate(ctx);
  if ('error' in auth) return { status: auth.status, body: { error: auth.error } };
  if (!ctx.projectId) return { status: 400, body: { error: 'Project ID is required.' } };

  const access = await verifyProjectRole(ctx, ctx.projectId, auth.user.id);
  if ('error' in access) return { status: access.status, body: { error: access.error } };

  const { data, error } = await access.db
    .from('project_collaborator_invites')
    .select('id, project_id, name, email, role, expires_at, accepted_at, revoked_at, created_at')
    .eq('project_id', ctx.projectId)
    .order('created_at', { ascending: false });

  if (error) return { status: 500, body: { error: 'Failed to list collaborator invites.' } };
  return { status: 200, body: { invites: data || [] } };
}

export async function handleRevokeCollaboratorInvite(ctx: Ctx) {
  const auth = await authenticate(ctx);
  if ('error' in auth) return { status: auth.status, body: { error: auth.error } };
  if (!ctx.projectId || !ctx.body?.inviteId) return { status: 400, body: { error: 'Project ID and invite ID are required.' } };

  const access = await verifyProjectRole(ctx, ctx.projectId, auth.user.id);
  if ('error' in access) return { status: access.status, body: { error: access.error } };

  const { data, error } = await access.db
    .from('project_collaborator_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', ctx.body.inviteId)
    .eq('project_id', ctx.projectId)
    .is('accepted_at', null)
    .select('id, revoked_at')
    .maybeSingle();

  if (error) return { status: 500, body: { error: 'Failed to revoke collaborator invite.' } };
  if (!data) return { status: 404, body: { error: 'Invite not found or already accepted.' } };
  return { status: 200, body: { success: true, invite: data } };
}

export async function handleAcceptCollaboratorInvite(ctx: Ctx) {
  const token = typeof ctx.body?.inviteToken === 'string' ? ctx.body.inviteToken.trim() : '';
  if (!token) return { status: 400, body: { error: 'Invite token is required.' } };

  const db = admin(ctx);
  const { data: invite, error } = await db
    .from('project_collaborator_invites')
    .select('id, project_id, organization_id, name, email, role, expires_at, accepted_at, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (error || !invite) return { status: 404, body: { error: 'Invite not found.' } };
  if (invite.revoked_at) return { status: 410, body: { error: 'This collaborator invite has been revoked.' } };
  if (invite.accepted_at) return { status: 410, body: { error: 'This collaborator invite has already been accepted.' } };
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return { status: 410, body: { error: 'This collaborator invite has expired.' } };
  }

  const sessionToken = randomToken();
  const sessionExpires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();

  const { error: sessionErr } = await db
    .from('project_collaborator_sessions')
    .insert({
      invite_id: invite.id,
      project_id: invite.project_id,
      role: invite.role,
      token_hash: hashToken(sessionToken),
      expires_at: sessionExpires,
    });

  if (sessionErr) return { status: 500, body: { error: 'Failed to create collaborator session.' } };

  const { error: markErr } = await db
    .from('project_collaborator_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('accepted_at', null);

  if (markErr) return { status: 500, body: { error: 'Failed to finalize collaborator invite.' } };

  return {
    status: 200,
    body: {
      success: true,
      session_token: sessionToken,
      session_expires_at: sessionExpires,
      collaborator: {
        project_id: invite.project_id,
        name: invite.name,
        email: invite.email,
        role: invite.role,
      },
    },
  };
}

export async function resolveCollaboratorSession(ctx: Ctx, token: string) {
  if (!token) return null;
  const db = admin(ctx);
  const { data } = await db
    .from('project_collaborator_sessions')
    .select('id, project_id, role, expires_at, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;

  await db.from('project_collaborator_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}
