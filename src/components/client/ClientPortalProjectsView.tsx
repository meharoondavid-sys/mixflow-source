import React, { useState, useMemo } from 'react';
import { 
  FolderKanban, 
  Search, 
  Music, 
  FileText, 
  Calendar, 
  Clock, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { ClientPortalProjectSummary } from '../../types/clientPortal';

interface ClientPortalProjectsViewProps {
  projects: ClientPortalProjectSummary[];
  loading: boolean;
  error: string | null;
  onSelectProject: (projectId: string) => void;
  onRefresh: () => void;
}

export const ClientPortalProjectsView: React.FC<ClientPortalProjectsViewProps> = ({
  projects,
  loading,
  error,
  onSelectProject,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  // Format Status Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return (
          <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            {status === 'approved' ? 'Approved' : 'Completed'}
          </span>
        );
      case 'in_production':
        return (
          <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
            In Production
          </span>
        );
      case 'in_review':
        return (
          <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
            In Review
          </span>
        );
      case 'needs_revision':
        return (
          <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400">
            Revising
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 capitalize">
            {status.replace('_', ' ')}
          </span>
        );
    }
  };

  const getProjectTypeBadge = (type: string) => {
    switch (type) {
      case 'single':
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase font-semibold">Single</span>;
      case 'ep':
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 uppercase font-semibold">EP</span>;
      case 'album':
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase font-semibold">Album</span>;
      default:
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase font-semibold">{type}</span>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-zinc-900 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-6 text-center space-y-3">
        <AlertCircle size={28} className="text-red-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">Failed to load projects</h3>
        <p className="text-xs text-red-400 max-w-md mx-auto">{error}</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-xl transition cursor-pointer text-zinc-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Music size={18} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">My Music</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Your projects, mixes, masters, and delivered files — all in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        {projects.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your music..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition"
            />
          </div>
        )}
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto">
            <FolderKanban size={24} />
          </div>
          <h3 className="text-sm font-semibold text-white">
            {searchQuery ? 'No matching projects' : 'Your music library is empty'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {searchQuery
              ? 'No projects match your search query. Try typing a different name.'
              : 'When an engineer starts a project for you, it will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="group bg-zinc-900/50 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-emerald-500/40 rounded-2xl p-5 transition-all shadow-lg hover:shadow-emerald-500/5 cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {project.name}
                      </h2>
                    </div>
                    <div>{getProjectTypeBadge(project.project_type)}</div>
                  </div>
                  <div>{getStatusBadge(project.status)}</div>
                </div>
              </div>

              {/* Footer Meta */}
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                    <Music size={13} className="text-zinc-500" />
                    {project.song_count} {project.song_count === 1 ? 'track' : 'tracks'}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                    <FileText size={13} className="text-zinc-500" />
                    {project.file_count} {project.file_count === 1 ? 'file' : 'files'}
                  </span>
                  {project.deadline && (
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400 hidden sm:flex">
                      <Calendar size={13} className="text-zinc-500" />
                      {project.deadline}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-emerald-400 group-hover:translate-x-0.5 transition-transform text-xs font-semibold">
                  <span>Open</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
