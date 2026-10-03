import { createClient } from '@supabase/supabase-js';
import { VALID_INVITE_ROLES, ValidInviteRole } from './inviteHandler.js';

export interface AcceptInviteHandlerParams {
  authHeader?: string;
  body?: any;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

export interface AcceptInviteHandlerResult {
  status: number;
  body: {
    success?: boolean;
    message?: string;
    already_member?: boolean;
    member?: {
      organization_id: string;
      user_id: string;
      role: string;
    };
    invitation?: {
      id: string;
      organization_id: string;
      email: string;
      role: string;
      status: string;
    };
    error?: string;
  };
}

/**
 * Core secure invitation acceptance logic for Step 6C.
 * Can be executed from Express server endpoint or Supabase Edge Function.
 *
 * Security Guarantees:
 * 1. Caller identity (ID & Email) is authoritatively verified via Supabase Auth session token.
 * 2. Never uses user_metadata or raw_user_meta_data for authorization.
 * 3. Never trusts organization_id, role, user_id, or invited_by from the request body.
 * 4. Authoritative organization_id and role are taken exclusively from public.organization_invitations.
 * 5. Prevents any user from accepting an invitation intended for another email address.
 * 6. Prevents invitations from creating "owner" memberships.
 * 7. Fully idempotent against duplicate or repeated acceptance attempts.
 */
export async function handleAcceptInvitation({
  authHeader,
  body,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  createClientFn = createClient,
}: AcceptInviteHandlerParams): Promise<AcceptInviteHandlerResult> {
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

  if (!supabaseServiceRoleKey) {
    return {
      status: 500,
      body: { error: 'Server configuration error: Supabase service_role key not configured' },
    };
  }

  // Create client with caller token to securely verify caller identity
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
  const callerEmail = callerUser.email?.trim().toLowerCase();

  if (!callerEmail) {
    return {
      status: 401,
      body: { error: 'Authentication failed: authenticated user does not have an email address' },
    };
  }

  // Initialize service role client strictly server-side
  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { invitation_id, organization_id: requestedOrgId } = body || {};

  let targetInvitation: any = null;

  // 2. Find matching invitation
  if (invitation_id && typeof invitation_id === 'string' && invitation_id.trim()) {
    const trimmedInviteId = invitation_id.trim();
    const { data: invById, error: invByIdErr } = await adminClient
      .from('organization_invitations')
      .select('*')
      .eq('id', trimmedInviteId)
      .maybeSingle();

    if (invByIdErr) {
      return {
        status: 500,
        body: { error: 'Failed to look up invitation record' },
      };
    }

    if (!invById) {
      return {
        status: 404,
        body: { error: 'Invitation not found' },
      };
    }

    // Security Check: Verify invitation belongs to caller email (case-insensitive)
    if (invById.email.trim().toLowerCase() !== callerEmail) {
      return {
        status: 403,
        body: { error: 'Forbidden: You cannot accept an invitation intended for another email address.' },
      };
    }

    targetInvitation = invById;
  } else {
    // If invitation_id is not specified, query pending invitations for caller email
    let query = adminClient
      .from('organization_invitations')
      .select('*')
      .ilike('email', callerEmail);

    if (requestedOrgId && typeof requestedOrgId === 'string' && requestedOrgId.trim()) {
      query = query.eq('organization_id', requestedOrgId.trim());
    }

    // Sort newest first
    query = query.order('created_at', { ascending: false });

    const { data: matchingInvites, error: matchErr } = await query;

    if (matchErr) {
      return {
        status: 500,
        body: { error: 'Failed to look up invitations for user' },
      };
    }

    // Check for pending invitation first
    const pendingInvite = matchingInvites?.find((i: any) => i.status === 'pending');

    if (!pendingInvite) {
      // Check if user has an already accepted invitation and is already a member (idempotent path)
      const acceptedInvite = matchingInvites?.find((i: any) => i.status === 'accepted');
      if (acceptedInvite) {
        const { data: existingMember } = await adminClient
          .from('organization_members')
          .select('organization_id, user_id, role')
          .eq('organization_id', acceptedInvite.organization_id)
          .eq('user_id', callerUser.id)
          .maybeSingle();

        if (existingMember) {
          return {
            status: 200,
            body: {
              success: true,
              message: 'User is already a member of this organization.',
              already_member: true,
              member: {
                organization_id: existingMember.organization_id,
                user_id: existingMember.user_id,
                role: existingMember.role,
              },
              invitation: {
                id: acceptedInvite.id,
                organization_id: acceptedInvite.organization_id,
                email: acceptedInvite.email,
                role: acceptedInvite.role,
                status: 'accepted',
              },
            },
          };
        }
      }

      // Check for revoked / expired status for informative error
      const revokedInvite = matchingInvites?.find((i: any) => i.status === 'revoked');
      if (revokedInvite) {
        return {
          status: 409,
          body: { error: 'This invitation has been revoked.' },
        };
      }

      const expiredInvite = matchingInvites?.find((i: any) => i.status === 'expired');
      if (expiredInvite) {
        return {
          status: 409,
          body: { error: 'This invitation has expired.' },
        };
      }

      return {
        status: 404,
        body: { error: 'No matching pending invitation found for your email address.' },
      };
    }

    targetInvitation = pendingInvite;
  }

  // 3. Verify invitation status
  if (targetInvitation.status === 'revoked') {
    return {
      status: 409,
      body: { error: 'This invitation has been revoked.' },
    };
  }

  if (targetInvitation.status === 'expired') {
    return {
      status: 409,
      body: { error: 'This invitation has expired.' },
    };
  }

  if (targetInvitation.status === 'accepted') {
    // Check whether user is already an active member of this organization
    const { data: existingMember } = await adminClient
      .from('organization_members')
      .select('organization_id, user_id, role')
      .eq('organization_id', targetInvitation.organization_id)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (existingMember) {
      return {
        status: 200,
        body: {
          success: true,
          message: 'Invitation has already been accepted and user is an active member.',
          already_member: true,
          member: {
            organization_id: existingMember.organization_id,
            user_id: existingMember.user_id,
            role: existingMember.role,
          },
          invitation: {
            id: targetInvitation.id,
            organization_id: targetInvitation.organization_id,
            email: targetInvitation.email,
            role: targetInvitation.role,
            status: 'accepted',
          },
        },
      };
    }

    return {
      status: 409,
      body: { error: 'This invitation has already been accepted.' },
    };
  }

  if (targetInvitation.status !== 'pending') {
    return {
      status: 400,
      body: { error: `Invalid invitation status '${targetInvitation.status}'.` },
    };
  }

  // 4. Strict role validation: Do not allow an invitation to create an "owner" membership
  const authoritativeRole = targetInvitation.role?.trim().toLowerCase();
  if (authoritativeRole === 'owner') {
    return {
      status: 400,
      body: { error: "The 'owner' role cannot be acquired via invitation acceptance." },
    };
  }

  if (!VALID_INVITE_ROLES.includes(authoritativeRole as ValidInviteRole)) {
    return {
      status: 400,
      body: { error: `Invalid role '${targetInvitation.role}' in invitation record.` },
    };
  }

  const authoritativeOrgId = targetInvitation.organization_id;

  // 5. Check whether the authenticated user is already a member of that organization
  const { data: existingMember, error: memberCheckErr } = await adminClient
    .from('organization_members')
    .select('organization_id, user_id, role')
    .eq('organization_id', authoritativeOrgId)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (memberCheckErr) {
    return {
      status: 500,
      body: { error: 'Failed to verify existing organization membership' },
    };
  }

  if (existingMember) {
    // Idempotent acceptance: Update pending invitation to accepted
    await adminClient
      .from('organization_invitations')
      .update({ status: 'accepted' })
      .eq('id', targetInvitation.id);

    return {
      status: 200,
      body: {
        success: true,
        message: 'User is already a member of this organization.',
        already_member: true,
        member: {
          organization_id: existingMember.organization_id,
          user_id: existingMember.user_id,
          role: existingMember.role,
        },
        invitation: {
          id: targetInvitation.id,
          organization_id: targetInvitation.organization_id,
          email: targetInvitation.email,
          role: targetInvitation.role,
          status: 'accepted',
        },
      },
    };
  }

  // 6. If not already a member, create row in organization_members
  // Uses strictly authoritative organization_id and role from invitation record
  const { data: newMember, error: insertMemberErr } = await adminClient
    .from('organization_members')
    .insert({
      organization_id: authoritativeOrgId,
      user_id: callerUser.id,
      role: authoritativeRole,
    })
    .select('organization_id, user_id, role')
    .single();

  if (insertMemberErr) {
    // Safe against race conditions: if unique constraint was violated concurrently
    if (insertMemberErr.code === '23505') {
      await adminClient
        .from('organization_invitations')
        .update({ status: 'accepted' })
        .eq('id', targetInvitation.id);

      return {
        status: 200,
        body: {
          success: true,
          message: 'User is already a member of this organization.',
          already_member: true,
          member: {
            organization_id: authoritativeOrgId,
            user_id: callerUser.id,
            role: authoritativeRole,
          },
          invitation: {
            id: targetInvitation.id,
            organization_id: targetInvitation.organization_id,
            email: targetInvitation.email,
            role: targetInvitation.role,
            status: 'accepted',
          },
        },
      };
    }

    return {
      status: 500,
      body: { error: 'Failed to create organization membership record.' },
    };
  }

  // 7. Mark the invitation as "accepted"
  const { error: updateInviteErr } = await adminClient
    .from('organization_invitations')
    .update({ status: 'accepted' })
    .eq('id', targetInvitation.id);

  if (updateInviteErr) {
    console.error('[MixFlow] Failed to update invitation status to accepted:', updateInviteErr);
  }

  // 8. Return safe, structured success response
  return {
    status: 200,
    body: {
      success: true,
      message: 'Invitation accepted successfully. You are now a member of the organization.',
      already_member: false,
      member: {
        organization_id: newMember.organization_id,
        user_id: newMember.user_id,
        role: newMember.role,
      },
      invitation: {
        id: targetInvitation.id,
        organization_id: targetInvitation.organization_id,
        email: targetInvitation.email,
        role: targetInvitation.role,
        status: 'accepted',
      },
    },
  };
}
