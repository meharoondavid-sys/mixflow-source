import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Users, 
  Disc3, 
  Music, 
  Layers, 
  Calendar, 
  DollarSign, 
  Clock, 
  Filter, 
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  Eye, 
  Bug,
  FileText,
  Copy,
  Check,
  Database,
  X,
  Sliders
} from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useApp } from '../../context/AppContext';
import { NewProjectModal } from '../modals/NewProjectModal';
import { ProjectRecord, ProjectType, ProjectStatus, PROJECT_STATUS_CONFIG } from '../../types/project';
import { PROJECTS_MIGRATION_SQL } from '../../data/projectsMigrationSql';

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
    diagnosticError, 
    isTableMissing,
    fetchProjects, 
    canManageProjects, 
    organization 
  } = useProjects();

  const { setActiveProjectId, setEngineerTab } = useApp();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ProjectType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(PROJECTS_MIGRATION_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

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

  // Compute metrics from real Supabase projects
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

      {/* Global Error Banner */}
      {error && !isTableMissing && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-xs text-red-400 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1">
              <span className="font-semibold text-red-300">Database Notice: </span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchProjects()}
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

      {/* Metric Cards (only shown when projects exist) */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <span className="text-[11px] text-zinc-400 block mb-1">Total Projects</span>
            <div className="text-xl font-bold font-mono text-white tabular-nums">
              {projects.length}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <span className="text-[11px] text-zinc-400 block mb-1">In Production</span>
            <div className="text-xl font-bold font-mono text-sky-400 tabular-nums">
              {activeCount}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <span className="text-[11px] text-zinc-400 block mb-1">Approved / Complete</span>
            <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
              {completedCount}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <span className="text-[11px] text-zinc-400 block mb-1">Total Contract Value</span>
            <div className="text-xl font-bold font-mono text-zinc-200 tabular-nums">
              {formatCurrency(totalValue)}
            </div>
          </div>
        </div>
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
        /* Projects List / Table */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400 font-mono">
                <tr>
                  <th className="py-3.5 px-4 font-medium">Project Name</th>
                  <th className="py-3.5 px-4 font-medium">Client</th>
                  <th className="py-3.5 px-4 font-medium">Type</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium">Deadline</th>
                  <th className="py-3.5 px-4 font-medium">Price</th>
                  <th className="py-3.5 px-4 font-medium">Deposit</th>
                  <th className="py-3.5 px-4 font-medium text-center">Tracks</th>
                  <th className="py-3.5 px-4 font-medium text-center">Services</th>
                  <th className="py-3.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredProjects.map((project) => {
                  const statusInfo = PROJECT_STATUS_CONFIG[project.status] || {
                    label: project.status,
                    color: 'text-zinc-300',
                    bg: 'bg-zinc-800',
                    border: 'border-zinc-700',
                  };

                  const songCount = project.songs?.length || 0;
                  const serviceCount = project.service_count || 0;

                  return (
                    <tr 
                      key={project.id} 
                      onClick={() => handleOpenProject(project.id)}
                      className="hover:bg-zinc-850/50 transition-colors cursor-pointer group"
                    >
                      {/* Project Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            project.project_type === 'single'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : project.project_type === 'ep'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}>
                            {project.project_type === 'single' ? (
                              <Music size={14} />
                            ) : project.project_type === 'ep' ? (
                              <Layers size={14} />
                            ) : (
                              <Disc3 size={14} />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors block">
                              {project.name}
                            </span>
                            {project.description && (
                              <span className="text-[10px] text-zinc-500 line-clamp-1 max-w-[180px]">
                                {project.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-4 px-4">
                        <span className="font-medium text-zinc-200 block">
                          {project.client?.full_name || '—'}
                        </span>
                        {project.client?.company_name && (
                          <span className="text-[11px] text-zinc-500">
                            {project.client.company_name}
                          </span>
                        )}
                      </td>

                      {/* Project Type */}
                      <td className="py-4 px-4 font-mono">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                          project.project_type === 'single'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : project.project_type === 'ep'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                        }`}>
                          {project.project_type}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Deadline */}
                      <td className="py-4 px-4 text-zinc-300 font-mono text-[11px]">
                        {formatDate(project.deadline)}
                      </td>

                      {/* Price */}
                      <td className="py-4 px-4 font-mono font-bold text-zinc-100">
                        {formatCurrency(project.project_price)}
                      </td>

                      {/* Deposit */}
                      <td className="py-4 px-4 font-mono text-zinc-300">
                        {formatCurrency(project.deposit_amount)}
                      </td>

                      {/* Song Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                          <Music size={11} className="text-emerald-400" />
                          <span>{songCount}</span>
                        </span>
                      </td>

                      {/* Service Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                          <Sliders size={11} className="text-sky-400" />
                          <span>{serviceCount}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-800 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 text-zinc-300 rounded-lg text-[11px] transition-colors font-medium">
                          <span>Overview</span>
                          <ChevronRight size={12} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-zinc-800/80">
            {filteredProjects.map((project) => {
              const statusInfo = PROJECT_STATUS_CONFIG[project.status] || {
                label: project.status,
                color: 'text-zinc-300',
                bg: 'bg-zinc-800',
                border: 'border-zinc-700',
              };

              const songCount = project.songs?.length || 0;
              const serviceCount = project.service_count || 0;

              return (
                <div 
                  key={project.id} 
                  onClick={() => handleOpenProject(project.id)}
                  className="p-4 space-y-3 hover:bg-zinc-850/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        project.project_type === 'single'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : project.project_type === 'ep'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}>
                        {project.project_type === 'single' ? (
                          <Music size={14} />
                        ) : project.project_type === 'ep' ? (
                          <Layers size={14} />
                        ) : (
                          <Disc3 size={14} />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-xs">{project.name}</h4>
                        <p className="text-[11px] text-zinc-400">
                          {project.client?.full_name || 'Independent Client'}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-zinc-400">
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase">Price / Deposit</span>
                      <span className="text-zinc-200 font-bold">{formatCurrency(project.project_price)}</span>
                      <span className="text-zinc-500 text-[10px] ml-1">({formatCurrency(project.deposit_amount)} dep)</span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase">Tracks & Services</span>
                      <span className="text-emerald-400">{songCount} track(s)</span>
                      <span className="text-zinc-600 mx-1">·</span>
                      <span className="text-sky-400">{serviceCount} service(s)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/60">
                    <span>Deadline: {formatDate(project.deadline)}</span>
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <span>View</span>
                      <ChevronRight size={10} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
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
