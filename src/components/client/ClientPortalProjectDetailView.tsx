import React from 'react';
import { 
  ArrowLeft, 
  Music, 
  FileText, 
  Download, 
  Calendar, 
  Disc3, 
  CheckCircle2, 
  Clock, 
  FileArchive, 
  FileAudio, 
  FileCode, 
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { ClientPortalProjectDetail } from '../../types/clientPortal';
import { ClientAudioReviewView } from './ClientAudioReviewView';
import { ClientPortalDeliveriesSection } from './ClientPortalDeliveriesSection';
import { ClientPortalBillingSection } from './ClientPortalBillingSection';

interface ClientPortalProjectDetailViewProps {
  project: ClientPortalProjectDetail | null;
  loading: boolean;
  error: string | null;
  downloadingFileId: string | null;
  onBack: () => void;
  onDownloadFile: (fileId: string, fileName: string) => void;
}

export const ClientPortalProjectDetailView: React.FC<ClientPortalProjectDetailViewProps> = ({
  project,
  loading,
  error,
  downloadingFileId,
  onBack,
  onDownloadFile,
}) => {
  // Format File Size
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // File Icon Helper
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('audio')) return <FileAudio size={16} className="text-emerald-400" />;
    if (fileType.includes('zip') || fileType.includes('compressed') || fileType.includes('tar'))
      return <FileArchive size={16} className="text-amber-400" />;
    if (fileType.includes('image')) return <ImageIcon size={16} className="text-purple-400" />;
    if (fileType.includes('pdf') || fileType.includes('text'))
      return <FileText size={16} className="text-blue-400" />;
    return <FileCode size={16} className="text-zinc-400" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            {status === 'approved' ? 'Approved' : 'Completed'}
          </span>
        );
      case 'in_production':
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
            In Production
          </span>
        );
      case 'in_review':
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
            In Review
          </span>
        );
      case 'needs_revision':
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400">
            Revising
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 capitalize">
            {status.replace('_', ' ')}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-zinc-900 rounded animate-pulse" />
        <div className="h-32 bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 animate-pulse" />
        <div className="h-64 bg-zinc-900/40 border border-zinc-800 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-10 text-center space-y-4">
        <h2 className="text-base font-bold text-white">Project Unavailable</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          {error || 'Unable to access the requested project. Please ensure you have permission or return to your projects list.'}
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 rounded-xl transition cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
        <span>Back to Projects</span>
      </button>

      {/* Project Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold uppercase">
                {project.project_type}
              </span>
              {getStatusBadge(project.status)}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {project.name}
            </h1>
          </div>

          {project.deadline && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400 font-mono">
              <Calendar size={14} className="text-emerald-400" />
              <span>Target Delivery: {project.deadline}</span>
            </div>
          )}
        </div>

        {project.description && (
          <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl pt-2 border-t border-zinc-800/50">
            {project.description}
          </p>
        )}
      </div>

      {/* Interactive Audio Review & Timestamped Feedback */}
      <ClientAudioReviewView
        projectId={project.id}
        songs={project.songs || []}
      />

      {/* Final Master Deliverables (Step 14) */}
      <ClientPortalDeliveriesSection projectId={project.id} />

      {/* Section 1: Track Listing (Songs) */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Music size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Songs / Tracklist</h2>
              <p className="text-[11px] text-zinc-500">Track overview for this production project</p>
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {project.songs.length} {project.songs.length === 1 ? 'track' : 'tracks'}
          </span>
        </div>

        {project.songs.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
            No songs have been added to this project yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-950/40">
            {project.songs.map((song) => (
              <div
                key={song.id}
                className="px-4 py-3.5 flex items-center justify-between text-xs hover:bg-zinc-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 w-6 text-center text-[11px] font-semibold">
                    {String(song.track_number).padStart(2, '0')}
                  </span>
                  <span className="font-medium text-zinc-200">{song.title}</span>
                </div>
                <div>{getStatusBadge(song.status)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Project Files & Deliverables */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Project Files & Audio Deliverables</h2>
              <p className="text-[11px] text-zinc-500">Secure downloadable studio files for this project</p>
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {project.files.length} {project.files.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {project.files.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
            No delivery files have been uploaded for this project yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-950/40">
            {project.files.map((file) => {
              const isDownloading = downloadingFileId === file.id;
              const formattedDate = file.created_at
                ? new Date(file.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent';

              return (
                <div
                  key={file.id}
                  className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-zinc-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
                      {getFileIcon(file.file_type)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-200 truncate">{file.name}</p>
                      <div className="flex items-center gap-2.5 text-[11px] text-zinc-500 font-mono">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Secure Download Button */}
                  <button
                    onClick={() => onDownloadFile(file.id, file.name)}
                    disabled={isDownloading}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-emerald-400 font-semibold text-xs transition cursor-pointer shrink-0 border border-zinc-700/60 shadow-sm"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Preparing Link...</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} />
                        <span>Download</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Project Billing & Payment History (Step 13) */}
      <ClientPortalBillingSection
        projectId={project.id}
        projectPrice={project.project_price || 0}
        depositAmount={project.deposit_amount || 0}
      />
    </div>
  );
};
