// Supabase Edge Function: invite-team-member
// Invoked securely by authorized organization owners/admins

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_INVITE_ROLES = ['admin', 'engineer', 'producer', 'assistant', 'finance'];

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required: missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^bearer\s+/i, '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required: empty access token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing Supabase environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authenticate caller with their Supabase token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed: invalid or expired session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUser = userData.user;

    // 3. Parse and validate body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organization_id, email, role } = body || {};

    if (!organization_id || typeof organization_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid organization_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!role || typeof role !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedRole = role.trim().toLowerCase();

    // 5. Rejects "owner" as an invite role
    if (normalizedRole === 'owner') {
      return new Response(
        JSON.stringify({ error: "The 'owner' role cannot be assigned via invitation." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate allowed roles
    if (!VALID_INVITE_ROLES.includes(normalizedRole)) {
      return new Response(
        JSON.stringify({
          error: `Invalid role '${role}'. Allowed roles are: ${VALID_INVITE_ROLES.join(', ')}.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Service-role client
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2. Verifies the caller is an "owner" or "admin" of the organization in public.organization_members
    const { data: callerMember, error: callerMemberErr } = await adminClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (callerMemberErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to verify organization membership' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!callerMember || (callerMember.role !== 'owner' && callerMember.role !== 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only organization owners and admins can invite team members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          return new Response(
            JSON.stringify({ error: 'This user is already a member of this organization.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 7. Checks that there is no existing pending invitation for the same organization/email, case-insensitively
    const { data: existingPendingInvite } = await adminClient
      .from('organization_invitations')
      .select('id, status, created_at')
      .eq('organization_id', organization_id)
      .ilike('email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPendingInvite) {
      return new Response(
        JSON.stringify({
          error: 'A pending invitation already exists for this email address in this organization.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        return new Response(
          JSON.stringify({ error: `Failed to issue Supabase Auth invitation: ${inviteAuthErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        return new Response(
          JSON.stringify({
            error: 'A pending invitation already exists for this email address in this organization.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to record invitation in database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 11. Returns safe success response without exposing secrets or sensitive database details
    return new Response(
      JSON.stringify({
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
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error processing invitation' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
