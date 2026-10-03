import { createClient } from '@supabase/supabase-js';

export interface RevokeInviteHandlerParams {
  authHeader?: string;
  body?: any;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

export interface RevokeInviteHandlerResult {
  status: number;
  body: {
    success?: boolean;
    message?: string;
    error?: string;
  };
}

/**
 * Secure invitation revocation handler.
 * Only organization owners and admins can revoke invitations.
 */
export async function handleRevokeInvitation({
  authHeader,
  body,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  createClientFn = createClient,
}: RevokeInviteHandlerParams): Promise<RevokeInviteHandlerResult> {
  // 1. Authenticate caller
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return {
      status: 401,
      body: { error: 'Authentication required: missing or invalid Authorization header' },
    };
  }

  const token = authHeader.replace(/^bearer\s+/i, '').trim();
  if (!token) {
    return {
      status: 401,
      body: { error: 'Authentication required: empty access token' },
    };
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return {
      status: 500,
      body: { error: 'Server configuration error: missing Supabase credentials' },
    };
  }

  const userClient = createClientFn(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      status: 401,
      body: { error: 'Authentication failed: invalid or expired session token' },
    };
  }

  const callerUser = userData.user;

  // 2. Validate request body
  const { invitation_id } = body || {};
  if (!invitation_id || typeof invitation_id !== 'string' || !invitation_id.trim()) {
    return {
      status: 400,
      body: { error: 'Missing or invalid invitation_id' },
    };
  }

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3. Find the invitation
  const { data: invitation, error: invErr } = await adminClient
    .from('organization_invitations')
    .select('*')
    .eq('id', invitation_id.trim())
    .maybeSingle();

  if (invErr) {
    return {
      status: 500,
      body: { error: 'Failed to look up invitation' },
    };
  }

  if (!invitation) {
    return {
      status: 404,
      body: { error: 'Invitation not found' },
    };
  }

  // 4. Verify caller is owner or admin of that organization
  const { data: callerMember, error: callerMemberErr } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', invitation.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (callerMemberErr) {
    return {
      status: 500,
      body: { error: 'Failed to verify caller permissions' },
    };
  }

  if (!callerMember || (callerMember.role !== 'owner' && callerMember.role !== 'admin')) {
    return {
      status: 403,
      body: { error: 'Forbidden: Only organization owners and admins can revoke invitations' },
    };
  }

  // 5. Check if already accepted
  if (invitation.status === 'accepted') {
    return {
      status: 409,
      body: { error: 'Cannot revoke an invitation that has already been accepted.' },
    };
  }

  // 6. Update status to 'revoked'
  const { error: updateErr } = await adminClient
    .from('organization_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitation.id);

  if (updateErr) {
    return {
      status: 500,
      body: { error: 'Failed to revoke invitation' },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Invitation revoked successfully.',
    },
  };
}
