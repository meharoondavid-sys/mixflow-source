import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Building, 
  Edit2, 
  Trash2, 
  Eye, 
  AlertCircle, 
  X, 
  Loader2, 
  Calendar, 
  FileText, 
  ShieldAlert,
  Disc3,
  RefreshCw,
  Bug,
  Music,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { useApp } from '../../context/AppContext';
import { ClientRecord, ClientInsertInput, ClientUpdateInput, ClientProjectItem } from '../../types/client';

export const ClientsView: React.FC = () => {
  const {
    clients,
    loading,
    error,
    diagnosticError,
    fetchClients,
    fetchClientProjects,
    createClient,
    updateClient,
    deleteClient,
    canManageClients,
    role,
    organization
  } = useClients();

  const { setActiveProjectId, setEngineerTab } = useApp();

  const [search, setSearch] = useState('');
  
  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientRecord | null>(null);
  const [viewingClient, setViewingClient] = useState<ClientRecord | null>(null);

  // Client Projects State (for Details View)
  const [clientProjects, setClientProjects] = useState<ClientProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Form States for Add
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form States for Edit
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Load client projects when opening details modal
  useEffect(() => {
    if (!viewingClient) {
      setClientProjects([]);
      setProjectsError(null);
      return;
    }

    let isMounted = true;
    setLoadingProjects(true);
    setProjectsError(null);

    fetchClientProjects(viewingClient.id).then((res) => {
      if (!isMounted) return;
      setLoadingProjects(false);
      if (res.error) {
        setProjectsError(res.error.message);
      } else {
        setClientProjects(res.projects);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [viewingClient, fetchClientProjects]);

  // Filter clients by search query
  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.full_name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const resetAddForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setCompanyName('');
    setNotes('');
    setFormError(null);
  };

  const handleOpenAddModal = () => {
    resetAddForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (client: ClientRecord) => {
    setEditingClient(client);
    setEditFullName(client.full_name);
    setEditEmail(client.email || '');
    setEditPhone(client.phone || '');
    setEditCompanyName(client.company_name || '');
    setEditNotes(client.notes || '');
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFormError('Full Name is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const input: ClientInsertInput = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      company_name: companyName.trim() || null,
      notes: notes.trim() || null,
    };

    const res = await createClient(input);
    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error.message);
    } else {
      setIsAddModalOpen(false);
      resetAddForm();
      setSuccessToast(`Client "${input.full_name}" created successfully.`);
      setTimeout(() => setSuccessToast(null), 3500);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    if (!editFullName.trim()) {
      setFormError('Full Name is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const input: ClientUpdateInput = {
      full_name: editFullName.trim(),
      email: editEmail.trim() || null,
      phone: editPhone.trim() || null,
      company_name: editCompanyName.trim() || null,
      notes: editNotes.trim() || null,
    };

    const res = await updateClient(editingClient.id, input);
    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error.message);
    } else {
      if (viewingClient?.id === editingClient.id && res.client) {
        setViewingClient(res.client);
      }
      setEditingClient(null);
      setSuccessToast(`Client "${input.full_name}" updated successfully.`);
      setTimeout(() => setSuccessToast(null), 3500);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingClient) return;

    // Safety constraint: Prevent deleting client with associated projects
    if ((deletingClient.project_count ?? 0) > 0) {
      setFormError(
        `Cannot delete client "${deletingClient.full_name}" because they have ${deletingClient.project_count} associated studio project(s). Reassign or remove their projects first.`
      );
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    const res = await deleteClient(deletingClient.id);
    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error.message);
    } else {
      if (viewingClient?.id === deletingClient.id) {
        setViewingClient(null);
      }
      const clientName = deletingClient.full_name;
      setDeletingClient(null);
      setSuccessToast(`Client "${clientName}" removed from studio.`);
      setTimeout(() => setSuccessToast(null), 3500);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Users className="text-emerald-400" size={24} />
              <span>Clients</span>
            </h1>
            {organization?.name && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                {organization.name}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage the artists, musicians, producers, labels, and partners you work with.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchClients()}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh clients list"
            aria-label="Refresh clients"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-400' : ''} />
          </button>
          
          {canManageClients && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Client</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Success Banner */}
      {successToast && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-emerald-300 p-1">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-xs text-red-400 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1">
              <span className="font-semibold text-red-300">Database Notice: </span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchClients()}
              className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900/60 border border-red-800 text-red-200 rounded-lg text-[11px] transition-colors"
            >
              Retry
            </button>
          </div>

          {diagnosticError && (
            <div className="mt-2 pt-2 border-t border-red-500/20 text-[11px] font-mono text-zinc-300 space-y-1 bg-black/40 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-red-300">
                <span className="flex items-center gap-1">
                  <Bug size={12} className="text-red-400" />
                  <span>Operation: {diagnosticError.operation}</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-200 border border-red-800 text-[10px]">
                  Code: {diagnosticError.code}
                </span>
              </div>
              <div className="text-zinc-400 break-all">{diagnosticError.message}</div>
              {diagnosticError.hint && (
                <div className="text-amber-300 text-[10px]">Hint: {diagnosticError.hint}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Role permission notice if viewer is not owner/admin */}
      {!canManageClients && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-3.5 py-2 flex items-center gap-2 text-xs text-zinc-400">
          <ShieldAlert size={14} className="text-amber-400 shrink-0" />
          <span>
            You have read-only client access as an organization <strong>{role || 'member'}</strong>. Only Owners and Admins can create, edit, or delete clients.
          </span>
        </div>
      )}

      {/* Client Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search clients by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
              title="Clear search filter"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="text-xs text-zinc-500 font-mono self-end sm:self-auto">
          {clients.length > 0 && (
            <span>
              Showing {filteredClients.length} of {clients.length} {clients.length === 1 ? 'client' : 'clients'}
            </span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && clients.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Disc3 size={20} className="animate-spin-slow" />
          </div>
          <p className="text-xs text-zinc-400 font-mono">LOADING STUDIO CLIENT ROSTER...</p>
        </div>
      ) : clients.length === 0 ? (
        /* Empty state when there are no clients */
        <div className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-3xl p-10 sm:p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 mx-auto">
            <Users size={26} className="text-emerald-400" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-white">No clients yet</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Add your first client to start organizing your work and project tracks.
            </p>
          </div>
          {canManageClients && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Your First Client</span>
            </button>
          )}
        </div>
      ) : filteredClients.length === 0 ? (
        /* Empty search state */
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-zinc-300">No clients match "{search}"</p>
          <p className="text-xs text-zinc-500">Try searching with a different name, email, or company.</p>
          <button
            onClick={() => setSearch('')}
            className="text-xs text-emerald-400 hover:underline pt-2 font-medium cursor-pointer"
          >
            Clear Search Filter
          </button>
        </div>
      ) : (
        /* Client List Table */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400 font-mono">
                <tr>
                  <th className="py-3.5 px-5 font-medium">Client</th>
                  <th className="py-3.5 px-5 font-medium">Company</th>
                  <th className="py-3.5 px-5 font-medium">Email</th>
                  <th className="py-3.5 px-5 font-medium">Phone</th>
                  <th className="py-3.5 px-5 font-medium text-center">Projects</th>
                  <th className="py-3.5 px-5 font-medium">Date Added</th>
                  <th className="py-3.5 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredClients.map((client) => {
                  const projectCount = client.project_count ?? 0;
                  const hasProjects = projectCount > 0;

                  return (
                    <tr key={client.id} className="hover:bg-zinc-850/50 transition-colors group">
                      {/* Name */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-500/20">
                            {client.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <button
                              onClick={() => setViewingClient(client)}
                              className="font-bold text-zinc-100 hover:text-emerald-400 text-left transition-colors cursor-pointer block"
                            >
                              {client.full_name}
                            </button>
                            {client.notes && (
                              <span className="text-[10px] text-zinc-500 line-clamp-1 max-w-[180px]">
                                {client.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-4 px-5 text-zinc-300">
                        {client.company_name ? (
                          <div className="flex items-center gap-1.5">
                            <Building size={12} className="text-zinc-500 shrink-0" />
                            <span>{client.company_name}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="py-4 px-5 text-zinc-300">
                        {client.email ? (
                          <a
                            href={`mailto:${client.email}`}
                            className="hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                          >
                            <Mail size={12} className="text-zinc-500 shrink-0" />
                            <span>{client.email}</span>
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-5 text-zinc-400">
                        {client.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone size={12} className="text-zinc-500 shrink-0" />
                            <span>{client.phone}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Projects Count (Relationship Column) */}
                      <td className="py-4 px-5 text-center">
                        <button
                          onClick={() => setViewingClient(client)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium border transition-colors cursor-pointer ${
                            hasProjects
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                          title={`View ${projectCount} project(s) for ${client.full_name}`}
                        >
                          <Music size={11} />
                          <span>{projectCount}</span>
                        </button>
                      </td>

                      {/* Date Added */}
                      <td className="py-4 px-5 text-zinc-400 font-mono text-[11px]">
                        {formatDate(client.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingClient(client)}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="View Client Details & Projects"
                            aria-label="View Client Details"
                          >
                            <Eye size={13} />
                          </button>

                          {canManageClients && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(client)}
                                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title="Edit Client"
                                aria-label="Edit Client"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                onClick={() => {
                                  setDeletingClient(client);
                                  setFormError(null);
                                }}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  hasProjects
                                    ? 'bg-zinc-800 text-zinc-600 hover:text-zinc-500 cursor-not-allowed'
                                    : 'bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400'
                                }`}
                                title={
                                  hasProjects
                                    ? `Cannot delete client with ${projectCount} active project(s). Reassign or remove projects first.`
                                    : 'Delete Client'
                                }
                                aria-label="Delete Client"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-zinc-800/80">
            {filteredClients.map((client) => {
              const projectCount = client.project_count ?? 0;
              const hasProjects = projectCount > 0;

              return (
                <div key={client.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-500/20">
                        {client.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-xs">{client.full_name}</h4>
                        {client.company_name && (
                          <p className="text-[11px] text-zinc-400">{client.company_name}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewingClient(client)}
                        className="p-1.5 bg-zinc-800 text-zinc-300 rounded-lg"
                        title="View Details"
                        aria-label="View Details"
                      >
                        <Eye size={13} />
                      </button>
                      {canManageClients && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(client)}
                            className="p-1.5 bg-zinc-800 text-zinc-300 rounded-lg"
                            title="Edit Client"
                            aria-label="Edit Client"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              setDeletingClient(client);
                              setFormError(null);
                            }}
                            className={`p-1.5 rounded-lg ${
                              hasProjects ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-800 text-red-400'
                            }`}
                            title={hasProjects ? 'Client has active projects' : 'Delete Client'}
                            aria-label="Delete Client"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-zinc-400">
                    {client.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} className="text-zinc-500 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-zinc-500 shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-zinc-500 font-mono text-[10px] pt-1">
                      <span>Added {formatDate(client.created_at)}</span>
                      <span className="text-sky-400 font-medium">{projectCount} project(s)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Add Client Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users size={18} className="text-emerald-400" />
                  <span>Add Client</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Record artist, producer, or record label details for your studio workspace.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Full Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Email Address <span className="text-zinc-500">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="artist@label.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Phone / WhatsApp <span className="text-zinc-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="+1 (555) 019-2834"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Company / Record Label <span className="text-zinc-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sub Pop Records"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Notes & Preferences <span className="text-zinc-500">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Preferences, mixing notes, stem delivery requirements..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Add Client</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit2 size={18} className="text-emerald-400" />
                  <span>Edit Client</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update contact information and preferences for this client.
                </p>
              </div>
              <button
                onClick={() => setEditingClient(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Full Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Phone / WhatsApp
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Company / Record Label
                </label>
                <input
                  type="text"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Delete Client Confirmation Modal */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 size={22} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Delete Client?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">{deletingClient.full_name}</strong>?
              </p>
              {(deletingClient.project_count ?? 0) > 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs text-left flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>
                    This client is linked to <strong>{deletingClient.project_count} project(s)</strong>. MixFlow's foreign key protection prevents deletion to avoid losing or orphaning project records.
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  This client has no active projects and will be permanently removed from your studio workspace.
                </p>
              )}
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 text-center">
                {formError}
              </div>
            )}

            <div className="flex gap-2.5 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting || (deletingClient.project_count ?? 0) > 0}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Client</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Client Details View Modal with Associated Projects */}
      {viewingClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-6 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-lg shrink-0">
                  {viewingClient.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{viewingClient.full_name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Client
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {viewingClient.company_name || 'Independent Client'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingClient(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Information Grid */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email */}
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase tracking-wider">Email</span>
                  {viewingClient.email ? (
                    <a
                      href={`mailto:${viewingClient.email}`}
                      className="text-zinc-200 hover:text-emerald-400 flex items-center gap-1.5 break-all font-medium transition-colors"
                    >
                      <Mail size={13} className="text-zinc-500 shrink-0" />
                      <span>{viewingClient.email}</span>
                    </a>
                  ) : (
                    <span className="text-zinc-600">Not provided</span>
                  )}
                </div>

                {/* Phone */}
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase tracking-wider">Phone</span>
                  {viewingClient.phone ? (
                    <div className="text-zinc-200 flex items-center gap-1.5 font-medium">
                      <Phone size={13} className="text-zinc-500 shrink-0" />
                      <span>{viewingClient.phone}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-600">Not provided</span>
                  )}
                </div>

                {/* Company */}
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase tracking-wider">Company / Label</span>
                  <div className="text-zinc-200 flex items-center gap-1.5 font-medium">
                    <Building size={13} className="text-zinc-500 shrink-0" />
                    <span>{viewingClient.company_name || 'Independent Artist'}</span>
                  </div>
                </div>

                {/* Studio Workspace */}
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase tracking-wider">Studio Workspace</span>
                  <div className="text-emerald-400 font-medium font-mono text-[11px]">
                    {organization?.name || 'MixFlow Studio'}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1 uppercase tracking-wider">
                  <FileText size={11} />
                  <span>Notes & Preferences</span>
                </span>
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {viewingClient.notes || 'No notes added for this client yet.'}
                </p>
              </div>

              {/* Timestamps */}
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-800">
                <span>Created: {formatDate(viewingClient.created_at)}</span>
                <span>Last Updated: {formatDate(viewingClient.updated_at)}</span>
              </div>
            </div>

            {/* 6. Associated Projects Section */}
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Music size={14} className="text-sky-400" />
                  <span>Associated Projects</span>
                  <span className="text-zinc-500 lowercase font-normal">
                    ({clientProjects.length})
                  </span>
                </h4>
              </div>

              {loadingProjects ? (
                <div className="py-6 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-2 bg-zinc-950/40 rounded-2xl border border-zinc-800/60">
                  <Loader2 size={14} className="animate-spin text-sky-400" />
                  <span>Loading client projects...</span>
                </div>
              ) : projectsError ? (
                <div className="p-4 bg-red-950/30 border border-red-500/20 rounded-xl text-xs text-red-400">
                  {projectsError}
                </div>
              ) : clientProjects.length === 0 ? (
                <div className="py-7 px-4 text-center space-y-1.5 bg-zinc-950/40 rounded-2xl border border-zinc-800/60">
                  <Music size={20} className="mx-auto text-zinc-600" />
                  <p className="text-xs text-zinc-300 font-medium">No projects for this client yet</p>
                  <p className="text-[11px] text-zinc-500">
                    When audio mixing or production projects are created for this client, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-zinc-800/80 rounded-2xl overflow-hidden divide-y divide-zinc-800/80 bg-zinc-950/50">
                  {clientProjects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => {
                        setViewingClient(null);
                        setActiveProjectId(proj.id);
                        setEngineerTab('projects');
                        window.location.hash = `#/project/${proj.id}`;
                      }}
                      className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-zinc-850/60 transition-colors cursor-pointer group"
                      title="Click to view Project Overview"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors text-xs">{proj.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {proj.project_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {proj.deadline ? `Deadline: ${formatDate(proj.deadline)}` : `Added ${formatDate(proj.created_at)}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-zinc-200">
                            {formatCurrency(proj.project_price)}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono capitalize bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          {proj.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-zinc-500 group-hover:text-emerald-400 transition-colors hidden sm:inline">
                          →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-800">
              {canManageClients ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const c = viewingClient;
                      setViewingClient(null);
                      handleOpenEditModal(c);
                    }}
                    className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 size={13} />
                    <span>Edit Client</span>
                  </button>

                  <button
                    onClick={() => {
                      const c = viewingClient;
                      setViewingClient(null);
                      setDeletingClient(c);
                    }}
                    className="px-3.5 py-2 bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              ) : (
                <div />
              )}

              <button
                onClick={() => setViewingClient(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-medium text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
