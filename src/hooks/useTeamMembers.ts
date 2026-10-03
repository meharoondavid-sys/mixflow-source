import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { OrganizationRole } from '../types/auth';

export interface TeamMember {
  user_id: string;
  organization_id: string;
  role: OrganizationRole;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  created_at: string;
}

const ROLE_PRIORITY: Record<OrganizationRole, number> = {
  owner: 1,
  admin: 2,
  engineer: 3,
  producer: 4,
  assistant: 5,
  finance: 6,
};

export function useTeamMembers() {
  const { user, organization, role } = useAuth();
  const canManage = role === 'owner' || role === 'admin';

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pending Invitations State (Step 6D)
  const [pendingInvitations, setPendingInvitations] = useState<OrganizationInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState<boolean>(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);

  const fetchTeamMembers = useCallback(async () => {
    if (!organization?.id) {
      setTeamMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = getSupabase();

    try {
      // 1. Fetch all members from public.organization_members for current organization
      const { data: memberRows, error: memberErr } = await supabase
        .from('organization_members')
        .select('organization_id, user_id, role, created_at')
        .eq('organization_id', organization.id);

      if (memberErr) {
        console.error('[MixFlow Team] Failed to fetch organization members:', memberErr.message);
        setError(memberErr.message);
        setTeamMembers([]);
        return;
      }

      if (!memberRows || memberRows.length === 0) {
        setTeamMembers([]);
        return;
      }

      // 2. Fetch profiles for all distinct user_ids
      const userIds = Array.from(new Set(memberRows.map((m) => m.user_id)));
      const { data: profileRows, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (profileErr) {
        console.warn('[MixFlow Team] Failed to fetch member profiles:', profileErr.message);
      }

      const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (profileRows) {
        profileRows.forEach((p) => {
          profileMap.set(p.id, {
            full_name: p.full_name || null,
            avatar_url: p.avatar_url || null,
          });
        });
      }

      // 3. Assemble team member records
      const members: TeamMember[] = memberRows.map((m) => {
        const prof = profileMap.get(m.user_id);
        return {
          user_id: m.user_id,
          organization_id: m.organization_id,
          role: (m.role as OrganizationRole) || 'engineer',
          created_at: m.created_at || new Date().toISOString(),
          full_name: prof?.full_name ?? null,
          avatar_url: prof?.avatar_url ?? null,
        };
      });

      // 4. Sort by role priority (owner, admin, engineer, producer, assistant, finance), then full_name
      members.sort((a, b) => {
        const priorityA = ROLE_PRIORITY[a.role] ?? 99;
        const priorityB = ROLE_PRIORITY[b.role] ?? 99;

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        const nameA = (a.full_name || '').toLowerCase();
        const nameB = (b.full_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setTeamMembers(members);
    } catch (err: any) {
      console.error('[MixFlow Team] Unexpected fetch exception:', err);
      setError(err?.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  // Fetch pending invitations (for owners and admins only)
  const fetchPendingInvitations = useCallback(async () => {
    if (!organization?.id || !canManage) {
      setPendingInvitations([]);
      setLoadingInvitations(false);
      return;
    }

    setLoadingInvitations(true);
    setInvitationsError(null);
    const supabase = getSupabase();

    try {
      const { data, error: fetchErr } = await supabase
        .from('organization_invitations')
        .select('id, organization_id, email, role, status, created_at')
        .eq('organization_id', organization.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('[MixFlow Team] Failed to fetch pending invitations:', fetchErr.message);
        setInvitationsError(fetchErr.message);
        setPendingInvitations([]);
        return;
      }

      setPendingInvitations(
        (data || []).map((row) => ({
          id: row.id,
          organization_id: row.organization_id,
          email: row.email,
          role: row.role as OrganizationRole,
          status: row.status as 'pending' | 'accepted' | 'revoked' | 'expired',
          created_at: row.created_at,
        }))
      );
    } catch (err: any) {
      console.error('[MixFlow Team] Unexpected invitation fetch error:', err);
      setInvitationsError(err?.message || 'Failed to load pending invitations');
    } finally {
      setLoadingInvitations(false);
    }
  }, [organization?.id, canManage]);

  useEffect(() => {
    fetchTeamMembers();
    if (canManage) {
      fetchPendingInvitations();
    } else {
      setPendingInvitations([]);
    }
  }, [fetchTeamMembers, fetchPendingInvitations, canManage]);

  // Update member role (organization-scoped)
  const updateMemberRole = async (
    targetUserId: string,
    newRole: OrganizationRole
  ): Promise<{ error: Error | null }> => {
    if (!organization?.id) {
      return { error: new Error('No active organization found') };
    }

    const supabase = getSupabase();

    try {
      const { error: updErr } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('organization_id', organization.id)
        .eq('user_id', targetUserId);

      if (updErr) {
        return { error: new Error(updErr.message) };
      }

      // Optimistically update local state and re-sort
      setTeamMembers((prev) => {
        const updated = prev.map((m) =>
          m.user_id === targetUserId ? { ...m, role: newRole } : m
        );

        updated.sort((a, b) => {
          const priorityA = ROLE_PRIORITY[a.role] ?? 99;
          const priorityB = ROLE_PRIORITY[b.role] ?? 99;
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          const nameA = (a.full_name || '').toLowerCase();
          const nameB = (b.full_name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        return updated;
      });

      return { error: null };
    } catch (err: any) {
      return { error: new Error(err?.message || 'Failed to update member role') };
    }
  };

  // Securely invite team member via server-side endpoint POST /api/invite-team-member
  const inviteMember = async (
    email: string,
    targetRole: OrganizationRole
  ): Promise<{ success: boolean; error?: string }> => {
    if (!organization?.id) {
      return { success: false, error: 'No active studio organization found' };
    }

    if (!canManage) {
      return { success: false, error: 'Forbidden: Only owners and admins can invite team members.' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (targetRole === 'owner') {
      return { success: false, error: "The 'owner' role cannot be assigned via invitation." };
    }

    try {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        return { success: false, error: 'Your session has expired. Please sign in again.' };
      }

      const res = await fetch('/api/invite-team-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organization_id: organization.id,
          email: normalizedEmail,
          role: targetRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data?.error || 'Failed to send invitation. Please try again.',
        };
      }

      // Refresh pending invitations list immediately without full page reload
      await fetchPendingInvitations();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'A network error occurred while sending the invitation.',
      };
    }
  };

  // Securely revoke pending invitation via server-side endpoint POST /api/revoke-invitation
  const revokeInvitation = async (
    invitationId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!organization?.id) {
      return { success: false, error: 'No active studio organization found' };
    }

    if (!canManage) {
      return { success: false, error: 'Forbidden: Only owners and admins can revoke invitations.' };
    }

    try {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        return { success: false, error: 'Your session has expired. Please sign in again.' };
      }

      const res = await fetch('/api/revoke-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invitation_id: invitationId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data?.error || 'Failed to revoke invitation. Please try again.',
        };
      }

      // Refresh pending invitations list immediately without full page reload
      await fetchPendingInvitations();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'A network error occurred while revoking the invitation.',
      };
    }
  };

  return {
    teamMembers,
    loading,
    error,
    refetch: fetchTeamMembers,
    updateMemberRole,
    canManage,
    // Step 6D additions:
    pendingInvitations,
    loadingInvitations,
    invitationsError,
    fetchPendingInvitations,
    inviteMember,
    revokeInvitation,
  };
}
