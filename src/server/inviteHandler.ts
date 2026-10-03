import { createClient } from '@supabase/supabase-js';

export const VALID_INVITE_ROLES = [
  'admin',
  'engineer',
  'producer',
  'assistant',
  'finance',
] as const;

export type ValidInviteRole = (typeof VALID_INVITE_ROLES)[number];

export interface InviteHandlerParams {
  authHeader?: string;
  body: any;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

export interface InviteHandlerResult {
  status: number;
  body: {
    success?: boolean;
    message?: string;
    invitation?: {
      id: string;
      organization_id: string;
      email: string;
      role: string;
      status: string;
      created_at: string;
    };
    error?: string;
  };
}

/**
 * Core secure invitation logic for Step 6B.
 * Can be executed from Express server endpoint or Supabase Edge Function.
 */
export async function handleInviteTeamMember({
  authHeader,
  body,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  createClientFn = createClient,
}: InviteHandlerParams): Promise<InviteHandlerResult> {
  // 1. Authenticate the caller using their Supabase access token
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

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      status: 500,
      body: { error: 'Server configuration error: Supabase URL or Anon key is missing' },
    };
  }

  // Create client with caller's token to securely verify caller identity
  const userClient = createClientFn(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      status: 401,
      body: { error: 'Authentication failed: invalid or expired session token' },
    };
  }

  const callerUser = userData.user;

  // 3. Accepts: organization_id, email, role
  const { organization_id, email, role } = body || {};

  if (!organization_id || typeof organization_id !== 'string') {
    return {
      status: 400,
      body: { error: 'Missing or invalid organization_id' },
    };
  }

  if (!email || typeof email !== 'string') {
    return {
      status: 400,
      body: { error: 'Missing or invalid email' },
    };
  }

  // 4. Validate email
  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return {
      status: 400,
      body: { error: 'Invalid email address format' },
    };
  }

  if (!role || typeof role !== 'string') {
    return {
      status: 400,
      body: { error: 'Missing or invalid role' },
    };
  }

  const normalizedRole = role.trim().toLowerCase();

  // 5. Rejects "owner" as an invite role
  if (normalizedRole === 'owner') {
    return {
      status: 400,
      body: { error: "The 'owner' role cannot be assigned via invitation." },
    };
  }

  // 4. Validate role against allowed roles
  if (!VALID_INVITE_ROLES.includes(normalizedRole as ValidInviteRole)) {
    return {
      status: 400,
      body: {
        error: `Invalid role '${role}'. Allowed roles are: ${VALID_INVITE_ROLES.join(', ')}.`,
      },
    };
  }

  // 8. Uses the Supabase service-role key only inside the server-side function
  if (!supabaseServiceRoleKey) {
    return {
      status: 500,
      body: { error: 'Server configuration error: Supabase service_role key not configured' },
    };
  }

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 2. Verifies the caller is an "owner" or "admin" of the organization
  // Uses authoritative public.organization_members, NEVER user_metadata or client claims
  const { data: callerMember, error: callerMemberErr } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (callerMemberErr) {
    return {
      status: 500,
      body: { error: 'Failed to verify organization membership' },
    };
  }

  if (!callerMember || (callerMember.role !== 'owner' && callerMember.role !== 'admin')) {
    return {
      status: 403,
      body: { error: 'Forbidden: Only organization owners and admins can invite team members' },
    };
  }

  // 6. Checks that the invited email is not already an organization member
  const { data: userListData, error: listUserErr } = await adminClient.auth.admin.listUsers();
  if (!listUserErr && userListData?.users) {
    const existingUser = userListData.users.find(
      (u) => u.email?.trim().toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      const { data: existingMembership } = await adminClient
        .from('organization_members')
        .select('role')
        .eq('organization_id', organization_id)
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingMembership) {
        return {
          status: 409,
          body: { error: 'This user is already a member of this organization.' },
        };
      }
    }
  }

  // 7. Checks that there is no existing pending invitation for the same organization/email, case-insensitively
  const { data: existingPendingInvite, error: pendingErr } = await adminClient
    .from('organization_invitations')
    .select('id, status, created_at')
    .eq('organization_id', organization_id)
    .ilike('email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingPendingInvite) {
    return {
      status: 409,
      body: {
        error: 'A pending invitation already exists for this email address in this organization.',
      },
    };
  }

  // 9. Uses Supabase Auth's server-side invitation mechanism to send the invitation
  // Note: No organization_id, role, or invited_by is placed in user_metadata (raw_user_meta_data),
  // as users can modify user_metadata client-side. All authoritative state resides in database tables.
  let authInviteSent = false;
  const { error: inviteAuthErr } =
    await adminClient.auth.admin.inviteUserByEmail(normalizedEmail);

  if (inviteAuthErr) {
    const isAlreadyRegistered =
      inviteAuthErr.status === 422 ||
      inviteAuthErr.message?.toLowerCase().includes('already') ||
      inviteAuthErr.message?.toLowerCase().includes('registered');

    if (!isAlreadyRegistered) {
      return {
        status: 500,
        body: { error: `Failed to issue Supabase Auth invitation: ${inviteAuthErr.message}` },
      };
    }
    authInviteSent = false;
  } else {
    authInviteSent = true;
  }

  // 10. Creates the corresponding "organization_invitations" record
  const { data: invitationRecord, error: insertErr } = await adminClient
    .from('organization_invitations')
    .insert({
      organization_id,
      email: normalizedEmail,
      role: normalizedRole,
      invited_by: callerUser.id,
      status: 'pending',
    })
    .select('id, organization_id, email, role, status, created_at')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return {
        status: 409,
        body: {
          error: 'A pending invitation already exists for this email address in this organization.',
        },
      };
    }
    return {
      status: 500,
      body: { error: 'Failed to record invitation in database' },
    };
  }

  // 11. Returns safe success response without exposing secrets or sensitive database details
  return {
    status: 201,
    body: {
      success: true,
      message: authInviteSent
        ? 'Invitation sent successfully.'
        : 'Invitation created for existing registered user.',
      invitation: {
        id: invitationRecord.id,
        organization_id: invitationRecord.organization_id,
        email: invitationRecord.email,
        role: invitationRecord.role,
        status: invitationRecord.status,
        created_at: invitationRecord.created_at,
      },
    },
  };
}
