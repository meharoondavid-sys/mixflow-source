import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Shield, 
  Check, 
  AlertCircle, 
  Loader2, 
  ChevronDown, 
  Clock, 
  Sparkles,
  Lock,
  UserPlus,
  Mail,
  X,
  Trash2,
  Send,
  AlertTriangle
} from 'lucide-react';
import { useTeamMembers, TeamMember, OrganizationInvitation } from '../../hooks/useTeamMembers';
import { useAuth } from '../../context/AuthContext';
import { OrganizationRole } from '../../types/auth';

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  producer: 'Producer',
  assistant: 'Assistant',
  finance: 'Finance',
};

// Roles that can be edited by owners/admins on existing members
const EDITABLE_ROLES: OrganizationRole[] = [
  'admin',
  'engineer',
  'producer',
  'assistant',
  'finance',
];

// Strictly excludes 'owner' - owner can never be invited
export const INVITE_ROLES: { role: OrganizationRole; label: string; desc: string }[] = [
  { role: 'admin', label: 'Admin', desc: 'Full studio administration and member management' },
  { role: 'engineer', label: 'Engineer', desc: 'Audio engineering, mixing, and session control' },
  { role: 'producer', label: 'Producer', desc: 'Production oversight and client project management' },
  { role: 'assistant', label: 'Assistant', desc: 'Assisting tracking sessions and studio operations' },
  { role: 'finance', label: 'Finance', desc: 'Studio invoicing, billing, and accounting' },
];

export const ROLE_STYLES: Record<OrganizationRole, { bg: string; text: string; border: string }> = {
  owner: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  admin: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  engineer: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
  },
  producer: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  assistant: {
    bg: 'bg-zinc-800',
    text: 'text-zinc-300',
    border: 'border-zinc-700',
  },
  finance: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
  },
};

function formatMemberDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const TeamMembersView: React.FC = () => {
  const { user } = useAuth();
  const { 
    teamMembers, 
    loading, 
    error, 
    updateMemberRole, 
    canManage,
    pendingInvitations,
    loadingInvitations,
    invitationsError,
    inviteMember,
    revokeInvitation,
  } = useTeamMembers();

  // Role change states
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Invite Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('engineer');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Revoke Modal States
  const [revokingInvite, setRevokingInvite] = useState<OrganizationInvitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Handle member role change
  const handleRoleChange = async (targetUserId: string, newRole: OrganizationRole) => {
    setActionError(null);
    setSuccessMessage(null);
    setUpdatingUserId(targetUserId);

    const res = await updateMemberRole(targetUserId, newRole);
    setUpdatingUserId(null);

    if (res.error) {
      setActionError(res.error.message);
    } else {
      setSuccessMessage(`Updated role to ${ROLE_LABELS[newRole]}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Handle invitation submit
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setInviteError('Email address is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setInviteError('Please enter a valid email address.');
      return;
    }

    if (inviteRole === 'owner') {
      setInviteError("The 'owner' role cannot be assigned via invitation.");
      return;
    }

    setIsInviting(true);
    const res = await inviteMember(trimmedEmail, inviteRole);
    setIsInviting(false);

    if (res.success) {
      setSuccessMessage(`Invitation successfully sent to ${trimmedEmail} (${ROLE_LABELS[inviteRole]}).`);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('engineer');
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setInviteError(res.error || 'Failed to send invitation. Please try again.');
    }
  };

  // Handle revoke confirmation
  const handleRevokeConfirm = async () => {
    if (!revokingInvite) return;

    setIsRevoking(true);
    const res = await revokeInvitation(revokingInvite.id);
    setIsRevoking(false);

    if (res.success) {
      setSuccessMessage(`Invitation for ${revokingInvite.email} has been revoked.`);
      setRevokingInvite(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setActionError(res.error || 'Failed to revoke invitation.');
      setRevokingInvite(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="text-emerald-400" size={24} />
            <span>Team Members</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage the people who work in your studio workspace.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
            {teamMembers.length} {teamMembers.length === 1 ? 'active member' : 'active members'}
          </span>

          {/* Invite Member Action - Visible exclusively to owners and admins */}
          {canManage && (
            <button
              onClick={() => {
                setInviteError(null);
                setIsInviteModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Invite Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Notifications / Alerts */}
      {actionError && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{actionError}</span>
          </div>
          <button 
            onClick={() => setActionError(null)} 
            className="text-red-400 hover:text-red-300 p-1"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Check size={15} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)} 
            className="text-emerald-400 hover:text-emerald-300 p-1"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Main Members Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
              Active Studio Members
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-zinc-500 font-mono flex flex-col items-center justify-center gap-3">
            <Loader2 size={20} className="animate-spin text-emerald-400" />
            <span>Loading team members...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle size={24} className="mx-auto text-red-400" />
            <p className="text-xs text-red-400 font-medium">Failed to load team members</p>
            <p className="text-[11px] text-zinc-500">{error}</p>
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users size={28} className="mx-auto text-zinc-600" />
            <p className="text-xs text-zinc-300 font-medium">No team members found</p>
            <p className="text-[11px] text-zinc-500">
              Your studio workspace currently has no active team members registered.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  <th className="py-3 px-5 font-semibold">Member</th>
                  <th className="py-3 px-5 font-semibold">Role</th>
                  <th className="py-3 px-5 font-semibold">Member Since</th>
                  <th className="py-3 px-5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-xs">
                {teamMembers.map((member) => {
                  const isCurrentUser = member.user_id === user?.id;
                  const isOwner = member.role === 'owner';
                  const roleStyle = ROLE_STYLES[member.role] || ROLE_STYLES.engineer;
                  const isUpdating = updatingUserId === member.user_id;

                  // Safety Rules Enforcement:
                  // 1. Cannot change own role
                  // 2. Cannot change Owner role
                  // 3. Must have manager permissions (owner or admin)
                  const canEditRole = canManage && !isCurrentUser && !isOwner;

                  return (
                    <tr 
                      key={member.user_id}
                      className="hover:bg-zinc-850/40 transition-colors"
                    >
                      {/* Member Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt=""
                              className="w-9 h-9 rounded-full object-cover shrink-0 border border-zinc-700"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                              {getInitials(member.full_name)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-100 text-sm truncate">
                                {member.full_name || 'Studio Member'}
                              </span>
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  YOU
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-400 block font-mono">
                              Studio Contributor
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Column */}
                      <td className="py-4 px-5">
                        {canEditRole ? (
                          <div className="relative inline-block">
                            {isUpdating ? (
                              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs">
                                <Loader2 size={12} className="animate-spin text-emerald-400" />
                                <span>Updating...</span>
                              </div>
                            ) : (
                              <div className="relative">
                                <select
                                  value={member.role}
                                  onChange={(e) => handleRoleChange(member.user_id, e.target.value as OrganizationRole)}
                                  className={`appearance-none cursor-pointer text-xs font-semibold py-1.5 pl-3 pr-8 rounded-xl border focus:outline-none transition-colors ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                                >
                                  {EDITABLE_ROLES.map((roleKey) => (
                                    <option 
                                      key={roleKey} 
                                      value={roleKey} 
                                      className="bg-zinc-900 text-zinc-200"
                                    >
                                      {ROLE_LABELS[roleKey]}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown 
                                  size={12} 
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" 
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                              {ROLE_LABELS[member.role] || member.role}
                            </span>
                            {isOwner && (
                              <span title="Studio Owner (Primary Account)" className="text-zinc-500">
                                <Lock size={12} />
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Member Since Column */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-xs">
                          <Clock size={13} className="text-zinc-500 shrink-0" />
                          <span>{formatMemberDate(member.created_at)}</span>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-4 px-5 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Active</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations Section (Step 6D) - Displayed for owners and admins */}
      {canManage && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl space-y-0">
          <div className="px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-amber-400" />
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
                Pending Invitations
              </span>
            </div>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-900/80 px-2.5 py-0.5 rounded-lg border border-zinc-800">
              {pendingInvitations.length} pending
            </span>
          </div>

          {loadingInvitations ? (
            <div className="py-12 text-center text-xs text-zinc-500 font-mono flex flex-col items-center justify-center gap-2.5">
              <Loader2 size={18} className="animate-spin text-amber-400" />
              <span>Checking pending invitations...</span>
            </div>
          ) : invitationsError ? (
            <div className="p-6 text-center space-y-1.5">
              <AlertCircle size={20} className="mx-auto text-amber-400" />
              <p className="text-xs text-amber-300 font-medium">Failed to load pending invitations</p>
              <p className="text-[11px] text-zinc-500">{invitationsError}</p>
            </div>
          ) : pendingInvitations.length === 0 ? (
            <div className="py-10 px-5 text-center space-y-1.5">
              <Mail size={24} className="mx-auto text-zinc-600" />
              <p className="text-xs text-zinc-300 font-medium">No pending invitations</p>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                All team member invitations have been accepted or no invitations are currently pending.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-5 font-semibold">Invited Recipient</th>
                    <th className="py-3 px-5 font-semibold">Assigned Role</th>
                    <th className="py-3 px-5 font-semibold">Sent Date</th>
                    <th className="py-3 px-5 font-semibold">Status</th>
                    <th className="py-3 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-xs">
                  {pendingInvitations.map((invite) => {
                    const roleStyle = ROLE_STYLES[invite.role] || ROLE_STYLES.engineer;

                    return (
                      <tr key={invite.id} className="hover:bg-zinc-850/40 transition-colors">
                        {/* Email */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                              <Mail size={14} />
                            </div>
                            <div>
                              <span className="font-semibold text-zinc-100 block">
                                {invite.email}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                Awaiting response
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-4 px-5">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                            {ROLE_LABELS[invite.role] || invite.role}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-4 px-5 font-mono text-zinc-400 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-zinc-500 shrink-0" />
                            <span>{formatMemberDate(invite.created_at)}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span>Pending</span>
                          </span>
                        </td>

                        {/* Revoke Action */}
                        <td className="py-4 px-5 text-right">
                          <button
                            onClick={() => setRevokingInvite(invite)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer"
                            title="Revoke this pending invitation"
                          >
                            <Trash2 size={13} />
                            <span>Revoke</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserPlus size={18} className="text-emerald-400" />
                  <span>Invite Team Member</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Send a secure invitation to join your studio workspace.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!isInviting) setIsInviteModalOpen(false);
                }}
                disabled={isInviting}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {inviteError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2 animate-in fade-in duration-150">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              {/* Email Input */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5 font-mono text-[11px] uppercase">
                  Recipient Email <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="colleague@studio.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={isInviting}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 text-xs transition-colors"
                  />
                </div>
              </div>

              {/* Role Selector (Owner strictly excluded) */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5 font-mono text-[11px] uppercase">
                  Assigned Role <span className="text-emerald-400">*</span>
                </label>
                <div className="space-y-2">
                  {INVITE_ROLES.map(({ role, label, desc }) => {
                    const isSelected = inviteRole === role;
                    const style = ROLE_STYLES[role];

                    return (
                      <label
                        key={role}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-zinc-800/80 border-emerald-500/50 shadow-sm'
                            : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="inviteRole"
                          value={role}
                          checked={isSelected}
                          onChange={() => setInviteRole(role)}
                          disabled={isInviting}
                          className="mt-0.5 text-emerald-500 focus:ring-emerald-500/40"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-100">{label}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${style.bg} ${style.text} ${style.border}`}>
                              {label}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={isInviting}
                  className="px-4 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {isInviting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Sending Invitation...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {revokingInvite && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 my-8">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Revoke Invitation?</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Are you sure you want to revoke the pending invitation for{' '}
                <span className="font-semibold text-zinc-200">{revokingInvite.email}</span>{' '}
                ({ROLE_LABELS[revokingInvite.role]})? The recipient will no longer be able to accept it.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setRevokingInvite(null)}
                disabled={isRevoking}
                className="px-3.5 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeConfirm}
                disabled={isRevoking}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isRevoking ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Revoking...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Confirm Revoke</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
