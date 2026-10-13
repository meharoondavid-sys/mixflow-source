import React, { useState } from 'react';
import {
  Plus,
  Search,
  Disc3,
  Music,
  Layers,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Clock3,
  MessageSquare,
  X,
  Sliders
} from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useApp } from '../../context/AppContext';
import { NewProjectModal } from '../modals/NewProjectModal';
import { ProjectType, ProjectStatus, PROJECT_STATUS_CONFIG } from '../../types/project';

interface DashboardViewProps {
  onSelectProject?: (projectId: string) => void;
}

const VALID_STATUSES: { value: 'all' | ProjectStatus; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'awaiting_files', label: 'Awaiting Files' },
  { value: 'in_production', label: 'In Production' },
  { value: 'in_review', label: 'In Review' },
  { value: 'needs_revision', label: 'Needs Revision' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectProject }) => {
  const { 
    projects, 
    loading, 
    error, 
    isTableMissing,
    fetchProjects, 
    canManageProjects, 
    organization 
  } = useProjects();

  const { setActiveProjectId, setEngineerTab } = useApp();

  const [search, setSearch] = useState('');
  const [attentionSearch, setAttentionSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ProjectType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  const filteredProjects = projects.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || 
      p.name.toLowerCase().includes(q) ||
      (p.client?.full_name && p.client.full_name.toLowerCase().includes(q)) ||
      (p.songs && p.songs.some((s) => s.title.toLowerCase().includes(q)));

    const matchesType = typeFilter === 'all' || p.project_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleOpenProject = (id: string) => {
    window.location.hash = `#/project/${id}`;
    if (onSelectProject) {
      onSelectProject(id);
    } else {
      setActiveProjectId(id);
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const needsAttention = projects.filter((p) =>
    p.status === 'needs_revision' ||
    p.status === 'in_review' ||
    p.status === 'awaiting_files'
  );
  const filteredNeedsAttention = needsAttention.filter((p) => {
    const q = attentionSearch.toLowerCase().trim();
    return !q || p.name.toLowerCase().includes(q) || (p.client?.full_name || '').toLowerCase().includes(q);
  });

  const attentionLabel = (status: ProjectStatus) => {
    if (status === 'needs_revision') return 'Revision requested';
    if (status === 'in_review') return 'Client review';
    if (status === 'awaiting_files') return 'Waiting for files';
    return PROJECT_STATUS_CONFIG[status]?.label || status;
  };

  // Compute studio metrics from the current project list
  const totalValue = projects.reduce((acc, p) => acc + (p.project_price || 0), 0);
  const activeCount = projects.filter((p) => p.status === 'in_production' || p.status === 'in_review').length;
  const completedCount = projects.filter((p) => p.status === 'completed' || p.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Studio Projects Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Disc3 className="text-emerald-400" size={24} />
              <span>Projects</span>
            </h1>
            {organization?.name && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                {organization.name}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage singles, EPs, and album productions across your studio workspace.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchProjects()}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh projects list"
            aria-label="Refresh projects"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-400' : ''} />
          </button>

          {canManageProjects && (
            <button
              onClick={() => setIsNewProjectModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={16} />
              <span>Create Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Friendly error banner */}
      {error && !isTableMissing && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-2xl p-4 text-xs">
          <AlertCircle size={17} className="shrink-0 mt-0.5 text-red-400" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-300">We couldn't load your projects</p>
            <p className="text-red-200/70 mt-0.5">Please try again. Your project data has not been changed.</p>
          </div>
          <button onClick={() => fetchProjects()} className="shrink-0 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-200 rounded-lg text-[11px] font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Needs your attention</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">The projects that need your next action.</p>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">{filteredNeedsAttention.length} of {needsAttention.length} projects</span>
          </div>

          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by project name or client..."
              value={attentionSearch}
              onChange={(e) => setAttentionSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              aria-label="Search projects needing attention by project or client"
            />
            {attentionSearch && (
              <button
                onClick={() => setAttentionSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                title="Clear attention search"
                aria-label="Clear attention search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {filteredNeedsAttention.length > 0 ? (
            <div className="grid gap-2">
              {filteredNeedsAttention.slice(0, 4).map((project) => {
                const isRevision = project.status === 'needs_revision';
                const isReview = project.status === 'in_review';
                return (
                  <button
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className="w-full text-left flex items-center gap-3 p-3.5 bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 rounded-2xl transition-all group"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isRevision ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      isReview ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                      'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}>
                      {isRevision ? <MessageSquare size={16} /> : isReview ? <Clock3 size={16} /> : <Music size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-zinc-100 truncate">{project.name}</span>
                        <span className="text-[10px] text-zinc-500">· {project.client?.full_name || 'Client'}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{attentionLabel(project.status)}</p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-400">
              No projects match that project or client name.
            </div>
          )}
        </section>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Type & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Types ({projects.length})
            </button>
            <button
              onClick={() => setTypeFilter('single')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === 'single'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Singles
            </button>
            <button
              onClick={() => setTypeFilter('ep')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === 'ep'
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              EPs
            </button>
            <button
              onClick={() => setTypeFilter('album')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === 'album'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Albums
            </button>
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {VALID_STATUSES.map((st) => (
                <option key={st.value} value={st.value} className="bg-zinc-950 text-zinc-300">
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search projects, clients, songs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && projects.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Disc3 size={20} className="animate-spin-slow" />
          </div>
          <p className="text-xs text-zinc-400 font-mono">LOADING STUDIO PROJECTS...</p>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state as required by brief */
        <div className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-3xl p-10 sm:p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 mx-auto">
            <Disc3 size={26} className="text-emerald-400" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-white">No projects yet</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No projects yet. Create your first project to start working with a client.
            </p>
          </div>
          {canManageProjects && (
            <button
              onClick={() => setIsNewProjectModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <Plus size={16} />
              <span>Create Your First Project</span>
            </button>
          )}
        </div>
      ) : filteredProjects.length === 0 ? (
        /* Filter/search empty */
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-zinc-300">No projects match the current filters</p>
          <p className="text-xs text-zinc-500">Try searching with different terms or reset your filters.</p>
          <button
            onClick={() => {
              setSearch('');
              setTypeFilter('all');
              setStatusFilter('all');
            }}
            className="text-xs text-emerald-400 hover:underline pt-2 font-medium cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Projects as Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const statusInfo = PROJECT_STATUS_CONFIG[project.status] || {
              label: project.status,
              color: 'text-zinc-300',
              bg: 'bg-zinc-800',
              border: 'border-zinc-700',
            };
            const songCount = project.songs?.length || 0;
            const serviceCount = project.service_count || 0;
            const typeStyle = project.project_type === 'single'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : project.project_type === 'ep'
              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => handleOpenProject(project.id)}
                className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80 rounded-2xl p-4 sm:p-5 space-y-4 transition-all group focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      project.project_type === 'single'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : project.project_type === 'ep'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}>
                      {project.project_type === 'single' ? <Music size={17} /> : project.project_type === 'ep' ? <Layers size={17} /> : <Disc3 size={17} />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors break-words">{project.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 truncate">{project.client?.full_name || 'Independent Client'}</p>
                      {project.client?.company_name && <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{project.client.company_name}</p>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-zinc-600 group-hover:text-emerald-400 shrink-0 mt-1 transition-colors" />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}>
                    {statusInfo.label}
                  </span>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${typeStyle}`}>
                    {project.project_type}
                  </span>
                </div>

                {project.description && (
                  <p className="text-xs text-zinc-500 line-clamp-2">{project.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500 block mb-1">Tracks</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                      <Music size={13} className="text-emerald-400" /> {songCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500 block mb-1">Services</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                      <Sliders size={13} className="text-sky-400" /> {serviceCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500 block mb-1">Contract value</span>
                    <span className="text-xs font-bold text-zinc-100">{formatCurrency(project.project_price)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500 block mb-1">Deadline</span>
                    <span className="text-xs text-zinc-300">{formatDate(project.deadline)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{formatCurrency(project.deposit_amount)} deposit</span>
                  <span className="text-emerald-400 font-semibold">Open project <ChevronRight size={12} className="inline ml-0.5" /></span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onSuccess={(id) => {
          setIsNewProjectModalOpen(false);
          handleOpenProject(id);
        }}
      />
    </div>
  );
};
