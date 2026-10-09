import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Disc3, 
  Music, 
  Layers, 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Plus, 
  FileText, 
  User, 
  Building, 
  Mail, 
  Phone,
  Edit2,
  Loader2,
  ChevronDown,
  X,
  Sliders,
  Sparkles,
  Tag,
  Users,
  Check,
  Copy,
  Upload
} from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useServices } from '../../hooks/useServices';
import { useClients } from '../../hooks/useClients';
import { useTeamMembers, TeamMember } from '../../hooks/useTeamMembers';
import { ProjectFilesSection } from './ProjectFilesSection';
import { ProjectFeedbackTab } from './ProjectFeedbackTab';
import { ProjectPaymentsSection } from './ProjectPaymentsSection';
import { ProjectDeliveriesSection } from './ProjectDeliveriesSection';
import { useProjectPayments } from '../../hooks/useProjectPayments';
import { 
  ProjectRecord, 
  ProjectType,
  ProjectStatus, 
  PROJECT_STATUS_CONFIG,
  SongInput,
  ProjectSongRecord 
} from '../../types/project';
import { 
  SERVICE_STATUS_OPTIONS, 
  getServiceStatusConfig, 
  ServiceRecord 
} from '../../types/service';

interface ProjectOverviewViewProps {
  projectId: string;
  onBack: () => void;
}

export const ProjectOverviewView: React.FC<ProjectOverviewViewProps> = ({
  projectId,
  onBack,
}) => {
  const { 
    projects, 
    updateProject, 
    deleteProject, 
    addSongToProject, 
    updateSong,
    deleteSong, 
    canManageProjects,
    organization
  } = useProjects();

  const { clients } = useClients();

  const project = projects.find((p) => p.id === projectId);

  const { summary: paymentSummary } = useProjectPayments(
    projectId,
    project?.project_price || 0,
    project?.deposit_amount || 0
  );

  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackNumber, setNewTrackNumber] = useState('');
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Song Edit / Delete Modal states
  const [editingSong, setEditingSong] = useState<ProjectSongRecord | null>(null);
  const [editSongTitle, setEditSongTitle] = useState('');
  const [editSongTrackNum, setEditSongTrackNum] = useState('');
  const [editSongStatus, setEditSongStatus] = useState('in_production');
  const [isSavingSong, setIsSavingSong] = useState(false);
  const [deletingSong, setDeletingSong] = useState<ProjectSongRecord | null>(null);
  const [isDeletingSong, setIsDeletingSong] = useState(false);
  const [songActionError, setSongActionError] = useState<string | null>(null);

  // Edit Project Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editClientId, setEditClientId] = useState('');
  const [editProjectType, setEditProjectType] = useState<ProjectType>('single');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDeposit, setEditDeposit] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('inquiry');

  const handleOpenEditModal = () => {
    if (!project) return;
    setEditName(project.name);
    setEditClientId(project.client_id);
    setEditProjectType(project.project_type);
    setEditDescription(project.description || '');
    setEditPrice(String(project.project_price || 0));
    setEditDeposit(String(project.deposit_amount || 0));
    setEditDeadline(project.deadline || '');
    setEditStatus(project.status);
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!editName.trim()) {
      setEditError('Project Name is required.');
      return;
    }
    if (!editClientId) {
      setEditError('Client selection is required.');
      return;
    }
    if (editPrice !== '' && Number(editPrice) < 0) {
      setEditError('Project price cannot be negative.');
      return;
    }
    if (editDeposit !== '' && Number(editDeposit) < 0) {
      setEditError('Deposit amount cannot be negative.');
      return;
    }
    const priceNum = editPrice !== '' ? Number(editPrice) || 0 : 0;
    const depositNum = editDeposit !== '' ? Number(editDeposit) || 0 : 0;
    if (depositNum > priceNum) {
      setEditError('Deposit amount cannot exceed total project price.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    const res = await updateProject(project.id, {
      name: editName.trim(),
      client_id: editClientId,
      project_type: editProjectType,
      description: editDescription.trim() || null,
      project_price: priceNum,
      deposit_amount: depositNum,
      deadline: editDeadline || null,
      status: editStatus,
    });
    setIsSavingEdit(false);
    if (res.error) {
      setEditError(res.error.message);
    } else {
      setShowEditModal(false);
    }
  };

  // Services & Team Members Hooks & State
  const {
    availableServices,
    projectServices,
    assignments,
    loadingProjectServices,
    addServiceToProject,
    updateProjectServiceStatus,
    updateProjectServiceDeadline,
    removeProjectService,
    createCustomService,
    assignTeamMember,
    removeTeamMember,
    getAssignmentsForService,
    canManage,
  } = useServices(projectId);

  const { teamMembers } = useTeamMembers();
  const [activeAssignPopoverServiceId, setActiveAssignPopoverServiceId] = useState<string | null>(null);

  const canManageServices = canManageProjects || canManage;

  const teamMemberMap = useMemo(() => {
    const map = new Map<string, TeamMember>();
    teamMembers.forEach((m) => map.set(m.user_id, m));
    return map;
  }, [teamMembers]);

  const getMemberInitials = (name: string | null): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [initialServiceStatus, setInitialServiceStatus] = useState('Not Started');
  const [isAddingService, setIsAddingService] = useState(false);
  const [addServiceError, setAddServiceError] = useState<string | null>(null);

  // Custom service mode inside Add Service Modal
  const [activeServiceTab, setActiveServiceTab] = useState<'catalog' | 'custom'>('catalog');
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServiceDesc, setCustomServiceDesc] = useState('');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customServiceError, setCustomServiceError] = useState<string | null>(null);

  const handleOpenAddServiceModal = () => {
    setSelectedServiceId('');
    setInitialServiceStatus('Not Started');
    setAddServiceError(null);
    setActiveServiceTab('catalog');
    setCustomServiceName('');
    setCustomServiceDesc('');
    setCustomServiceError(null);
    setShowAddServiceModal(true);
  };

  const handleAddCatalogService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId) {
      setAddServiceError('Please choose a service to attach.');
      return;
    }

    setIsAddingService(true);
    setAddServiceError(null);
    const res = await addServiceToProject(projectId, selectedServiceId, initialServiceStatus);
    setIsAddingService(false);

    if (res.error) {
      setAddServiceError(res.error.message);
    } else {
      setShowAddServiceModal(false);
    }
  };

  const handleCreateAndAddCustomService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customServiceName.trim()) {
      setCustomServiceError('Service name is required.');
      return;
    }

    setIsCreatingCustom(true);
    setCustomServiceError(null);

    // 1. Create custom service in database (reusable by org)
    const customRes = await createCustomService({
      name: customServiceName.trim(),
      description: customServiceDesc.trim() || null,
      is_custom: true,
    });

    if (customRes.error || !customRes.service) {
      setIsCreatingCustom(false);
      setCustomServiceError(customRes.error?.message || 'Failed to create custom service');
      return;
    }

    // 2. Attach newly created service to this project
    const attachRes = await addServiceToProject(
      projectId,
      customRes.service.id,
      initialServiceStatus
    );
    setIsCreatingCustom(false);

    if (attachRes.error) {
      setCustomServiceError(attachRes.error.message);
    } else {
      setShowAddServiceModal(false);
    }
  };

  if (!project) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center space-y-4">
        <Disc3 size={32} className="mx-auto text-zinc-600 animate-spin-slow" />
        <h3 className="font-bold text-white text-base">Project Not Found</h3>
        <p className="text-xs text-zinc-400">
          The requested project record could not be loaded or was removed.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Projects</span>
        </button>
      </div>
    );
  }

  const balance = paymentSummary.outstanding_balance;
  const statusConfig = PROJECT_STATUS_CONFIG[project.status] || {
    label: project.status,
    color: 'text-zinc-300',
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    setIsUpdatingStatus(true);
    await updateProject(project.id, { status: newStatus });
    setIsUpdatingStatus(false);
  };

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newTrackTitle.trim()) return;

    // Track number determination: custom or auto-increment (1 for singles)
    let trackNum = newTrackNumber ? Number(newTrackNumber) : 0;
    if (!trackNum || trackNum <= 0) {
      if (project.project_type === 'single' && (!project.songs || project.songs.length === 0)) {
        trackNum = 1;
      } else {
        trackNum = (project.songs?.length || 0) + 1;
      }
    }

    setIsAddingTrack(true);
    setSongActionError(null);
    const res = await addSongToProject(project.id, {
      title: newTrackTitle.trim(),
      track_number: trackNum,
    });
    setIsAddingTrack(false);

    if (res.error) {
      setSongActionError(res.error.message);
    } else {
      setNewTrackTitle('');
      setNewTrackNumber('');
    }
  };

  const handleOpenEditSong = (song: ProjectSongRecord) => {
    setEditingSong(song);
    setEditSongTitle(song.title);
    setEditSongTrackNum(String(song.track_number));
    setEditSongStatus(song.status || 'in_production');
    setSongActionError(null);
  };

  const handleSaveEditSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong || !project) return;
    if (!editSongTitle.trim()) {
      setSongActionError('Song title is required.');
      return;
    }
    const trackNum = Number(editSongTrackNum);
    if (!trackNum || trackNum <= 0) {
      setSongActionError('Track number must be greater than 0.');
      return;
    }

    setIsSavingSong(true);
    setSongActionError(null);
    const res = await updateSong(project.id, editingSong.id, {
      title: editSongTitle.trim(),
      track_number: trackNum,
      status: editSongStatus,
    });
    setIsSavingSong(false);

    if (res.error) {
      setSongActionError(res.error.message);
    } else {
      setEditingSong(null);
    }
  };

  const handleConfirmDeleteSong = async () => {
    if (!deletingSong || !project) return;
    setIsDeletingSong(true);
    setSongActionError(null);
    const res = await deleteSong(project.id, deletingSong.id);
    setIsDeletingSong(false);

    if (res.error) {
      setSongActionError(res.error.message);
    } else {
      setDeletingSong(null);
    }
  };

  const handleBack = () => {
    window.location.hash = '#projects';
    onBack();
  };

  const handleDeleteProjectConfirm = async () => {
    setIsDeleting(true);
    const res = await deleteProject(project.id);
    setIsDeleting(false);
    if (!res.error) {
      handleBack();
    }
  };

  const formatDate = (dateStr?: string | null) => {
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

  return (
    <div className="space-y-6">
      {/* Back Button & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors cursor-pointer"
            title="Back to all projects"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${
                project.project_type === 'single'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : project.project_type === 'ep'
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
              }`}>
                {project.project_type.toUpperCase()}
              </span>
              <span className="text-zinc-600 text-xs">·</span>
              <span className="text-xs text-zinc-400 font-mono">
                {organization?.name || 'Studio Workspace'}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
              {project.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Status Dropdown Selector */}
          {canManageProjects ? (
            <div className="relative">
              <select
                value={project.status}
                disabled={isUpdatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                className={`py-1.5 pl-3 pr-8 rounded-xl border text-xs font-semibold cursor-pointer appearance-none focus:outline-none transition-colors ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
              >
                <option value="inquiry">Status: Inquiry</option>
                <option value="awaiting_files">Status: Awaiting Files</option>
                <option value="in_production">Status: In Production</option>
                <option value="in_review">Status: In Review</option>
                <option value="needs_revision">Status: Needs Revision</option>
                <option value="approved">Status: Approved</option>
                <option value="completed">Status: Completed</option>
                <option value="cancelled">Status: Cancelled</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
            </div>
          ) : (
            <span className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
              {statusConfig.label}
            </span>
          )}

          {canManageProjects && (
            <>
              <button
                onClick={handleOpenEditModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="Edit Project Details"
              >
                <Edit2 size={13} className="text-emerald-400" />
                <span>Edit Project</span>
              </button>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 text-zinc-400 hover:text-red-400 bg-zinc-900 border border-zinc-800 hover:border-red-500/30 rounded-xl transition-colors cursor-pointer"
                title="Delete Project"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

          {/* Songs Tracklist Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                  <Music size={13} className="text-emerald-400" />
                  <span>Songs & Tracklist</span>
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {project.songs?.length || 0} {project.songs?.length === 1 ? 'song' : 'songs'} in this {project.project_type.toUpperCase()}
                </p>
              </div>
            </div>

            {songActionError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center justify-between gap-2">
                <span>{songActionError}</span>
                <button onClick={() => setSongActionError(null)} className="text-red-400 hover:text-red-300">
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Songs List */}
            {(!project.songs || project.songs.length === 0) ? (
              <div className="py-8 text-center bg-zinc-950/60 rounded-xl border border-zinc-800/80 space-y-1">
                <Music size={20} className="mx-auto text-zinc-600" />
                <p className="text-xs text-zinc-400 font-medium">No songs recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/60">
                {project.songs.map((song, index) => (
                  <div key={song.id} className="py-3 px-4 flex items-center justify-between hover:bg-zinc-900/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono text-zinc-500 text-xs font-bold">
                        {String(song.track_number || index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <span className="text-xs font-semibold text-zinc-100 block">
                          {song.title}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">
                          {song.status || 'in_production'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {canManageProjects && (
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = `/#/mobile-upload/${encodeURIComponent(projectId)}?songId=${encodeURIComponent(song.id)}`;
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-500 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                          title={`Upload a file for ${song.title}`}
                        >
                          <Upload size={12} />
                          <span>Upload</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('mixflow:project-file-filter', { detail: { songId: song.id } }));
                          document.getElementById('project-files-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        title={`View files for ${song.title}`}
                      >
                        <FileText size={12} />
                        <span>Files</span>
                      </button>

                      <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono font-semibold text-emerald-300"
                        title="Project code for adding this project to the client's My Music"
                      >
                        <span>Code</span>
                        <span className="tracking-wider">{project.project_code || '—'}</span>
                        <button
                          type="button"
                          disabled={!project.project_code}
                          onClick={() => project.project_code && navigator.clipboard?.writeText(project.project_code)}
                          className="ml-0.5 text-zinc-500 hover:text-emerald-300 disabled:opacity-40"
                          title="Copy project code"
                        >
                          <Copy size={12} />
                        </button>
                      </div>

                    {canManageProjects && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditSong(song)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                          title="Edit track"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingSong(song)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Remove track"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Track Form (for EPs, Albums, or Singles needing extra tracks) */}
            {canManageProjects && (
              <form onSubmit={handleAddSong} className="flex gap-2 pt-1">
                <input
                  type="number"
                  min="1"
                  placeholder="#"
                  value={newTrackNumber}
                  onChange={(e) => setNewTrackNumber(e.target.value)}
                  className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 font-mono text-center"
                  title="Track number (optional, auto-increments)"
                />
                <input
                  type="text"
                  placeholder="Add another track title..."
                  value={newTrackTitle}
                  onChange={(e) => setNewTrackTitle(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={isAddingTrack || !newTrackTitle.trim()}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAddingTrack ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  <span>Add Track</span>
                </button>
              </form>
            )}
          </div>


      {/* Quantitative Metric Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Price */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-zinc-400 block">Project Price</span>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            ${project.project_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Agreed scope</span>
        </div>

        {/* Deposit Paid */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-zinc-400 block">Deposit Amount</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            ${project.deposit_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Initial retainer</span>
        </div>

        {/* Balance Remaining */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-zinc-400 block">Remaining Balance</span>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              paymentSummary.is_overpaid
                ? 'text-purple-400'
                : balance === 0
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {paymentSummary.is_overpaid
              ? `-$${paymentSummary.overpaid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            {paymentSummary.is_overpaid
              ? 'Credit overpayment'
              : balance === 0
              ? 'Paid in full'
              : 'Due upon completion'}
          </span>
        </div>

        {/* Deadline */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-zinc-400 block">Target Deadline</span>
          <div className="text-lg font-bold font-mono text-zinc-200 mt-1">
            {formatDate(project.deadline)}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            Created {formatDate(project.created_at)}
          </span>
        </div>
      </div>



      {/* Main Content Grid: Description & Client Info vs Songs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Description & Tracklist */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
              <FileText size={13} className="text-emerald-400" />
              <span>Project Description & Brief</span>
            </h3>
            <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {project.description || 'No description or brief notes provided for this project.'}
            </p>
          </div>

          {/* Services & Scope Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                  <Sliders size={13} className="text-emerald-400" />
                  <span>Services & Production Scope</span>
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {projectServices.length} {projectServices.length === 1 ? 'service' : 'services'} configured for this project
                </p>
              </div>

              {canManageProjects && (
                <button
                  type="button"
                  onClick={handleOpenAddServiceModal}
                  className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus size={13} className="text-emerald-400" />
                  <span>Add Service</span>
                </button>
              )}
            </div>

            {/* Services List */}
            {loadingProjectServices ? (
              <div className="py-6 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin text-emerald-400" />
                <span>Loading project services...</span>
              </div>
            ) : projectServices.length === 0 ? (
              <div className="py-7 text-center bg-zinc-950/60 rounded-xl border border-zinc-800/80 space-y-2 p-4">
                <Sliders size={20} className="mx-auto text-zinc-600" />
                <p className="text-xs text-zinc-300 font-medium">No services attached to this project yet</p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  Add services like Mixing, Mastering, Vocal Production, or custom organization services to track their progress.
                </p>
                {canManageProjects && (
                  <button
                    type="button"
                    onClick={handleOpenAddServiceModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-xs transition-colors cursor-pointer mt-1"
                  >
                    <Plus size={13} />
                    <span>Attach Service</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-xl overflow-visible bg-zinc-950/60">
                {projectServices.map((ps) => {
                  const statusConfig = getServiceStatusConfig(ps.status);
                  const serviceAssignments = getAssignmentsForService(ps.id);
                  const isAssignPopoverOpen = activeAssignPopoverServiceId === ps.id;

                  return (
                    <div key={ps.id} className="p-4 space-y-3 hover:bg-zinc-900/40 transition-colors relative">
                      {/* Top Row: Service Name, Badge, Status Dropdown & Remove */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-zinc-100">
                              {ps.service?.name || 'Service'}
                            </span>
                            {ps.service?.is_custom ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                Custom
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                                Catalog
                              </span>
                            )}
                          </div>
                          {ps.service?.description && (
                            <p className="text-[11px] text-zinc-400 line-clamp-1">
                              {ps.service.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          {canManageServices ? (
                            <div className="relative">
                              <select
                                value={statusConfig.value}
                                onChange={(e) => updateProjectServiceStatus(ps.id, e.target.value)}
                                className={`py-1 pl-2.5 pr-7 rounded-lg border text-[11px] font-semibold cursor-pointer appearance-none focus:outline-none transition-colors ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
                              >
                                {SERVICE_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-200">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" />
                            </div>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                              {statusConfig.label}
                            </span>
                          )}

                          {canManageServices && (
                            <button
                              type="button"
                              onClick={() => removeProjectService(ps.id)}
                              className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                              title="Remove service from project"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Team Assignments & Service Deadline */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-zinc-800/60 text-xs">
                        {/* Team Assignments */}
                        <div className="flex items-center gap-2 flex-wrap relative">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                            <Users size={11} />
                            <span>Team:</span>
                          </span>

                          {serviceAssignments.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {serviceAssignments.map((a) => {
                                const member = teamMemberMap.get(a.user_id);
                                return (
                                  <div
                                    key={a.id}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-200"
                                    title={`${member?.full_name || 'Team Member'} (${member?.role || 'member'})`}
                                  >
                                    {member?.avatar_url ? (
                                      <img
                                        src={member.avatar_url}
                                        alt=""
                                        className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                      />
                                    ) : (
                                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[8px] flex items-center justify-center shrink-0">
                                        {getMemberInitials(member?.full_name ?? null)}
                                      </span>
                                    )}
                                    <span className="max-w-[110px] truncate text-zinc-200">
                                      {member?.full_name || 'Member'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-500 italic">Unassigned</span>
                          )}

                          {canManageServices && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setActiveAssignPopoverServiceId(isAssignPopoverOpen ? null : ps.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/80 text-[11px] font-medium transition-colors cursor-pointer"
                                title="Assign team members"
                              >
                                <Plus size={11} className="text-emerald-400" />
                                <span>Assign</span>
                              </button>

                              {/* Assign Dropdown Popover */}
                              {isAssignPopoverOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-30"
                                    onClick={() => setActiveAssignPopoverServiceId(null)}
                                  />
                                  <div className="absolute left-0 top-full mt-1.5 z-40 w-64 bg-zinc-900 border border-zinc-700/90 rounded-xl shadow-2xl p-2.5 space-y-2">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 px-1">
                                      <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider font-mono">
                                        Assign Team Members
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setActiveAssignPopoverServiceId(null)}
                                        className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>

                                    {teamMembers.length === 0 ? (
                                      <p className="text-[11px] text-zinc-500 py-3 text-center">
                                        No team members in organization
                                      </p>
                                    ) : (
                                      <div className="max-h-56 overflow-y-auto space-y-1">
                                        {teamMembers.map((m) => {
                                          const assignment = serviceAssignments.find((a) => a.user_id === m.user_id);
                                          const isAssigned = Boolean(assignment);

                                          return (
                                            <button
                                              key={m.user_id}
                                              type="button"
                                              onClick={async () => {
                                                if (isAssigned && assignment) {
                                                  await removeTeamMember(assignment.id);
                                                } else {
                                                  await assignTeamMember(ps.id, m.user_id);
                                                }
                                              }}
                                              className="w-full flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors text-left cursor-pointer group"
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                {m.avatar_url ? (
                                                  <img
                                                    src={m.avatar_url}
                                                    alt=""
                                                    className="w-6 h-6 rounded-full object-cover shrink-0"
                                                  />
                                                ) : (
                                                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                                                    {getMemberInitials(m.full_name)}
                                                  </span>
                                                )}
                                                <div className="min-w-0">
                                                  <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-white">
                                                    {m.full_name || 'Team Member'}
                                                  </p>
                                                  <p className="text-[10px] font-mono text-zinc-400 capitalize">
                                                    {m.role}
                                                  </p>
                                                </div>
                                              </div>

                                              <div
                                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                  isAssigned
                                                    ? 'bg-emerald-500 border-emerald-500 text-black'
                                                    : 'border-zinc-700 bg-zinc-950 group-hover:border-zinc-500'
                                                }`}
                                              >
                                                {isAssigned && <Check size={11} strokeWidth={3} />}
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Service Deadline */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                            <Calendar size={11} className={ps.deadline ? 'text-emerald-400' : 'text-zinc-500'} />
                            <span>Deadline:</span>
                          </span>

                          {canManageServices ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={ps.deadline || ''}
                                onChange={(e) => updateProjectServiceDeadline(ps.id, e.target.value || null)}
                                className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 rounded px-2 py-0.5 text-[11px] text-zinc-300 focus:outline-none transition-colors cursor-pointer"
                              />
                              {ps.deadline && (
                                <button
                                  type="button"
                                  onClick={() => updateProjectServiceDeadline(ps.id, null)}
                                  className="text-zinc-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                                  title="Clear deadline"
                                >
                                  <X size={11} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className={ps.deadline ? 'text-zinc-300 font-medium text-[11px]' : 'text-zinc-500 italic text-[11px]'}>
                              {ps.deadline
                                ? new Date(ps.deadline + 'T00:00:00').toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'No deadline'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (1 col): Client Card & Meta */}
        <div className="space-y-6">
          {/* Client Details Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
              <User size={13} className="text-emerald-400" />
              <span>Assigned Client</span>
            </h3>

            {project.client ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/20">
                    {project.client.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{project.client.full_name}</h4>
                    {project.client.company_name && (
                      <p className="text-xs text-zinc-400">{project.client.company_name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-800/80 text-xs">
                  {project.client.email && (
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Mail size={13} className="text-zinc-500 shrink-0" />
                      <a href={`mailto:${project.client.email}`} className="hover:text-emerald-400 truncate">
                        {project.client.email}
                      </a>
                    </div>
                  )}

                  {project.client.phone && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Phone size={13} className="text-zinc-500 shrink-0" />
                      <span>{project.client.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500">No client details available.</div>
            )}
          </div>

          {/* Record Metadata */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2 text-xs font-mono text-zinc-400">
            <div className="flex justify-between">
              <span className="text-zinc-500">Project ID</span>
              <span className="text-zinc-300">{project.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Created</span>
              <span className="text-zinc-300">{formatDate(project.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Last Updated</span>
              <span className="text-zinc-300">{formatDate(project.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Project & Song Files Management Section (Step 9) */}
      <ProjectFilesSection projectId={project.id} songs={project.songs || []} />

      {/* Audio Versions & Timestamped Client Feedback (Step 11 & 12) */}
      <ProjectFeedbackTab projectId={project.id} songs={project.songs || []} />

      {/* Payments & Billing Foundation (Step 13) */}
      <ProjectPaymentsSection
        projectId={project.id}
        projectPrice={project.project_price}
        depositAmount={project.deposit_amount}
        clientName={project.client?.full_name}
      />

      {/* Final Delivery Foundation (Step 14) */}
      <ProjectDeliveriesSection
        projectId={project.id}
        projectName={project.name}
        songs={project.songs || []}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 size={22} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Delete Project?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">{project.name}</strong>?
                This will permanently remove the project and its tracklist from your studio workspace.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProjectConfirm}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg shadow-red-600/20"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <span>Delete Project</span>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 size={16} className="text-emerald-400" />
                <span>Edit Project Details</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Project Name <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Project Type <span className="text-emerald-400">*</span>
                  </label>
                  <select
                    value={editProjectType}
                    onChange={(e) => setEditProjectType(e.target.value as ProjectType)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="single">Single (1 Track)</option>
                    <option value="ep">EP (3 - 6 Tracks)</option>
                    <option value="album">Album (Full Record)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Client / Artist <span className="text-emerald-400">*</span>
                </label>
                <select
                  required
                  value={editClientId}
                  onChange={(e) => setEditClientId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.company_name ? `(${c.company_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Description / Brief</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Project Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Deposit Amount ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editDeposit}
                    onChange={(e) => setEditDeposit(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Target Deadline</label>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="inquiry">Inquiry</option>
                    <option value="awaiting_files">Awaiting Files</option>
                    <option value="in_production">In Production</option>
                    <option value="in_review">In Review</option>
                    <option value="needs_revision">Needs Revision</option>
                    <option value="approved">Approved</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <span>Save Changes</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Service Modal */}
      {showAddServiceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders size={16} className="text-emerald-400" />
                <span>Attach Service to Project</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddServiceModal(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveServiceTab('catalog')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeServiceTab === 'catalog'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Service Catalog
              </button>
              <button
                type="button"
                onClick={() => setActiveServiceTab('custom')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeServiceTab === 'custom'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles size={12} className="text-purple-400" />
                <span>+ Custom Service</span>
              </button>
            </div>

            {/* Mode 1: Catalog Service */}
            {activeServiceTab === 'catalog' ? (
              <form onSubmit={handleAddCatalogService} className="space-y-4 text-xs">
                {addServiceError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{addServiceError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Select Service <span className="text-emerald-400">*</span>
                  </label>
                  <select
                    required
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Choose a service...</option>
                    {availableServices.map((svc) => {
                      const alreadyAttached = projectServices.some((ps) => ps.service_id === svc.id);
                      return (
                        <option key={svc.id} value={svc.id}>
                          {svc.name} {svc.is_custom ? '(Custom)' : ''} {alreadyAttached ? '— (Already added)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Initial Status</label>
                  <select
                    value={initialServiceStatus}
                    onChange={(e) => setInitialServiceStatus(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    {SERVICE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowAddServiceModal(false)}
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingService || !selectedServiceId}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isAddingService ? <Loader2 size={14} className="animate-spin" /> : <span>Attach Service</span>}
                  </button>
                </div>
              </form>
            ) : (
              /* Mode 2: Custom Service Creation */
              <form onSubmit={handleCreateAndAddCustomService} className="space-y-4 text-xs">
                {customServiceError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{customServiceError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Custom Service Name <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dolby Atmos Spatial Mix, Vinyl Cut Prep..."
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Description / Deliverable Specs</label>
                  <textarea
                    rows={2}
                    placeholder="Describe deliverable expectations, stems, or technical guidelines..."
                    value={customServiceDesc}
                    onChange={(e) => setCustomServiceDesc(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Initial Status</label>
                  <select
                    value={initialServiceStatus}
                    onChange={(e) => setInitialServiceStatus(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    {SERVICE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[11px] text-purple-300 leading-relaxed">
                  💡 This custom service will be saved in your studio catalog database so you and your team can reuse it across future projects.
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowAddServiceModal(false)}
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCustom || !customServiceName.trim()}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingCustom ? <Loader2 size={14} className="animate-spin" /> : <span>Create & Attach</span>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Song Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Music size={16} className="text-emerald-400" />
                  <span>Edit Track Details</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update track sequence, title, or production status.
                </p>
              </div>
              <button
                onClick={() => setEditingSong(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {songActionError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{songActionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditSong} className="space-y-4 text-xs">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                    Track # <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editSongTrackNum}
                    onChange={(e) => setEditSongTrackNum(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 text-center font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                    Track Title <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editSongTitle}
                    onChange={(e) => setEditSongTitle(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 font-mono text-[11px] uppercase">
                  Production Status
                </label>
                <select
                  value={editSongStatus}
                  onChange={(e) => setEditSongStatus(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500 capitalize"
                >
                  <option value="in_production">In Production</option>
                  <option value="tracking">Tracking / Recording</option>
                  <option value="editing">Editing / Tuning</option>
                  <option value="mixing">Mixing</option>
                  <option value="mastering">Mastering</option>
                  <option value="needs_revision">Needs Revision</option>
                  <option value="approved">Approved</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingSong(null)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSong}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSong ? <Loader2 size={14} className="animate-spin" /> : <span>Save Track</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Song Confirmation Modal */}
      {deletingSong && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 size={22} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Remove Song Track?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Are you sure you want to remove Track #{deletingSong.track_number}{' '}
                <strong className="text-white">"{deletingSong.title}"</strong> from this project?
              </p>
            </div>

            {songActionError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 text-center">
                {songActionError}
              </div>
            )}

            <div className="flex gap-2.5 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setDeletingSong(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSong}
                disabled={isDeletingSong}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingSong ? <Loader2 size={14} className="animate-spin" /> : <span>Remove Track</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
