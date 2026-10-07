import React, { useState, useEffect } from 'react';
import { ClientPortalNavbar } from './ClientPortalNavbar';
import { ClientPortalProjectsView } from './ClientPortalProjectsView';
import { ClientPortalProjectDetailView } from './ClientPortalProjectDetailView';
import { ClientAudioReviewView } from './ClientAudioReviewView';
import { useClientPortal } from '../../hooks/useClientPortal';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, UserCheck } from 'lucide-react';

export const ClientPortal: React.FC = () => {
  const { signOut, user } = useAuth();
  const {
    profile,
    isClient,
    projects,
    activeProject,
    loading,
    projectLoading,
    error,
    downloadingFileId,
    uploadProgress,
    isUploading,
    uploadFileToStudio,
    refreshPortal,
    fetchProjectDetail,
    setActiveProject,
    downloadFile,
  } = useClientPortal();

  const [activeProjectIdFromHash, setActiveProjectIdFromHash] = useState<string | null>(null);
  const [reviewSongIdFromHash, setReviewSongIdFromHash] = useState<string | null>(null);

  // Sync route with window hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#\/?client\/project\/([a-zA-Z0-9_-]+)(?:\/review\/([a-zA-Z0-9_-]+))?/);
      if (match && match[1]) {
        setActiveProjectIdFromHash(match[1]);
        setReviewSongIdFromHash(match[2] || null);
        fetchProjectDetail(match[1]);
      } else {
        setActiveProjectIdFromHash(null);
        setReviewSongIdFromHash(null);
        setActiveProject(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [fetchProjectDetail, setActiveProject]);

  const handleSelectProject = (projectId: string) => {
    window.location.hash = `#/client/project/${projectId}`;
  };

  const handleBackToProjects = () => {
    window.location.hash = '#/client/projects';
    setActiveProjectIdFromHash(null);
    setActiveProject(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black flex flex-col">
      <ClientPortalNavbar profile={profile} onSignOut={signOut} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {!loading && !isClient ? (
          /* Non-client State: Authenticated user has no client profile linked */
          <div className="max-w-lg mx-auto bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 text-center space-y-4 shadow-xl my-12">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <UserCheck size={24} />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Client Account Pending</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              You are signed in as <span className="font-mono text-zinc-300">{user?.email}</span>, but your account has not yet been linked to an active studio client profile.
            </p>
            <p className="text-[11px] text-zinc-500">
              When your studio engineer registers your email address for your audio projects, your projects and tracks will automatically appear here.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                onClick={() => {
                  window.location.hash = '';
                  window.location.reload();
                }}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Go to Studio Engineer Console →
              </button>
              <button
                onClick={refreshPortal}
                className="w-full sm:w-auto px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 rounded-xl transition cursor-pointer"
              >
                Refresh Account Status
              </button>
            </div>
          </div>
        ) : activeProjectIdFromHash && reviewSongIdFromHash && activeProject ? (
          /* Song Review View */
          <ClientAudioReviewView
            projectId={activeProject.id}
            songs={activeProject.songs}
            initialSongId={reviewSongIdFromHash}
          />
        ) : activeProjectIdFromHash ? (
          /* Project Detail View */
          <ClientPortalProjectDetailView
            project={activeProject}
            loading={projectLoading}
            error={error}
            downloadingFileId={downloadingFileId}
            uploadProgress={uploadProgress}
            isUploading={isUploading}
            onUploadFile={(file, songId) => {
              if (activeProjectIdFromHash) {
                return uploadFileToStudio(activeProjectIdFromHash, file, songId);
              }
              return Promise.resolve({ error: new Error('No active project selected.') });
            }}
            onBack={handleBackToProjects}
            onDownloadFile={(fileId, fileName) => {
              if (activeProjectIdFromHash) {
                downloadFile(activeProjectIdFromHash, fileId, fileName);
              }
            }}
          />
        ) : (
          /* Projects List View */
          <ClientPortalProjectsView
            projects={projects}
            loading={loading}
            error={error}
            onSelectProject={handleSelectProject}
            onRefresh={refreshPortal}
          />
        )}
      </main>
    </div>
  );
};
