// Supabase Edge Function: accept-invitation (Step 6C)
// Invoked securely by authenticated invited users to accept an organization invitation

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
    const callerEmail = callerUser.email?.trim().toLowerCase();

    if (!callerEmail) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed: authenticated user does not have an email address' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request body if present
    let body: any = {};
    try {
      const text = await req.text();
      if (text && text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { invitation_id, organization_id: requestedOrgId } = body || {};
    let targetInvitation: any = null;

    // 3. Find matching invitation
    if (invitation_id && typeof invitation_id === 'string' && invitation_id.trim()) {
      const trimmedInviteId = invitation_id.trim();
      const { data: invById, error: invByIdErr } = await adminClient
        .from('organization_invitations')
        .select('*')
        .eq('id', trimmedInviteId)
        .maybeSingle();

      if (invByIdErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to look up invitation record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!invById) {
        return new Response(
          JSON.stringify({ error: 'Invitation not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Security check: Must belong to caller email (case-insensitive)
      if (invById.email.trim().toLowerCase() !== callerEmail) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: You cannot accept an invitation intended for another email address.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetInvitation = invById;
    } else {
      let query = adminClient
        .from('organization_invitations')
        .select('*')
        .ilike('email', callerEmail);

      if (requestedOrgId && typeof requestedOrgId === 'string' && requestedOrgId.trim()) {
        query = query.eq('organization_id', requestedOrgId.trim());
      }

      query = query.order('created_at', { ascending: false });

      const { data: matchingInvites, error: matchErr } = await query;
      if (matchErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to look up invitations for user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pendingInvite = matchingInvites?.find((i: any) => i.status === 'pending');

      if (!pendingInvite) {
        const acceptedInvite = matchingInvites?.find((i: any) => i.status === 'accepted');
        if (acceptedInvite) {
          const { data: existingMember } = await adminClient
            .from('organization_members')
            .select('organization_id, user_id, role')
            .eq('organization_id', acceptedInvite.organization_id)
            .eq('user_id', callerUser.id)
            .maybeSingle();

          if (existingMember) {
            return new Response(
              JSON.stringify({
                success: true,
                message: 'User is already a member of this organization.',
                already_member: true,
                member: existingMember,
                invitation: acceptedInvite,
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const revokedInvite = matchingInvites?.find((i: any) => i.status === 'revoked');
        if (revokedInvite) {
          return new Response(
            JSON.stringify({ error: 'This invitation has been revoked.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const expiredInvite = matchingInvites?.find((i: any) => i.status === 'expired');
        if (expiredInvite) {
          return new Response(
            JSON.stringify({ error: 'This invitation has expired.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ error: 'No matching pending invitation found for your email address.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetInvitation = pendingInvite;
    }

    // 4. Verify invitation status
    if (targetInvitation.status === 'revoked') {
      return new Response(
        JSON.stringify({ error: 'This invitation has been revoked.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetInvitation.status === 'expired') {
      return new Response(
        JSON.stringify({ error: 'This invitation has expired.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetInvitation.status === 'accepted') {
      const { data: existingMember } = await adminClient
        .from('organization_members')
        .select('organization_id, user_id, role')
        .eq('organization_id', targetInvitation.organization_id)
        .eq('user_id', callerUser.id)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Invitation has already been accepted and user is an active member.',
            already_member: true,
            member: existingMember,
            invitation: targetInvitation,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'This invitation has already been accepted.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetInvitation.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Invalid invitation status '${targetInvitation.status}'.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Strict role validation: Do not allow owner role via invitation
    const authoritativeRole = targetInvitation.role?.trim().toLowerCase();
    if (authoritativeRole === 'owner') {
      return new Response(
        JSON.stringify({ error: "The 'owner' role cannot be acquired via invitation acceptance." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_INVITE_ROLES.includes(authoritativeRole)) {
      return new Response(
        JSON.stringify({ error: `Invalid role '${targetInvitation.role}' in invitation record.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authoritativeOrgId = targetInvitation.organization_id;

    // 6. Check whether caller is already a member
    const { data: existingMember, error: memErr } = await adminClient
      .from('organization_members')
      .select('organization_id, user_id, role')
      .eq('organization_id', authoritativeOrgId)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (memErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to verify existing organization membership' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingMember) {
      await adminClient
        .from('organization_invitations')
        .update({ status: 'accepted' })
        .eq('id', targetInvitation.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User is already a member of this organization.',
          already_member: true,
          member: existingMember,
          invitation: {
            ...targetInvitation,
            status: 'accepted',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Create row in organization_members with authoritative data
    const { data: newMember, error: insertErr } = await adminClient
      .from('organization_members')
      .insert({
        organization_id: authoritativeOrgId,
        user_id: callerUser.id,
        role: authoritativeRole,
      })
      .select('organization_id, user_id, role')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        await adminClient
          .from('organization_invitations')
          .update({ status: 'accepted' })
          .eq('id', targetInvitation.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'User is already a member of this organization.',
            already_member: true,
            member: {
              organization_id: authoritativeOrgId,
              user_id: callerUser.id,
              role: authoritativeRole,
            },
            invitation: {
              ...targetInvitation,
              status: 'accepted',
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to create organization membership record.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Mark invitation as accepted
    await adminClient
      .from('organization_invitations')
      .update({ status: 'accepted' })
      .eq('id', targetInvitation.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation accepted successfully. You are now a member of the organization.',
        already_member: false,
        member: newMember,
        invitation: {
          ...targetInvitation,
          status: 'accepted',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'An unexpected internal error occurred while accepting the invitation.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
