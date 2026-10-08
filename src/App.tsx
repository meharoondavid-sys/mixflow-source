import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Disc3 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectsProvider } from './context/ProjectsContext';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { AuthScreen } from './components/auth/AuthScreen';
import { CollaboratorPortal } from './components/collaborator/CollaboratorPortal';
import { MobileProjectFileUploadView } from './components/engineer/MobileProjectFileUploadView';
import { ClientAudioReviewView } from './components/client/ClientAudioReviewView';
import { PublicReviewView } from './components/client/PublicReviewView';
import { ClientPortalPreview } from './components/client/ClientPortalPreview';
import { ClientAuthScreen } from './components/client/ClientAuthScreen';

// Modals
const DashboardView = lazy(() => import('./components/engineer/DashboardView').then(m => ({ default: m.DashboardView })));
const ProjectOverviewView = lazy(() => import('./components/engineer/ProjectOverviewView').then(m => ({ default: m.ProjectOverviewView })));
const ClientsView = lazy(() => import('./components/engineer/ClientsView').then(m => ({ default: m.ClientsView })));
const InvoicesView = lazy(() => import('./components/engineer/InvoicesView').then(m => ({ default: m.InvoicesView })));
const SettingsView = lazy(() => import('./components/engineer/SettingsView').then(m => ({ default: m.SettingsView })));
const ClientReviewView = lazy(() => import('./components/client/ClientReviewView').then(m => ({ default: m.ClientReviewView })));
const ClientPortal = lazy(() => import('./components/client/ClientPortal').then(m => ({ default: m.ClientPortal })));
const NewProjectModal = lazy(() => import('./components/modals/NewProjectModal').then(m => ({ default: m.NewProjectModal })));
const UploadMixModal = lazy(() => import('./components/modals/UploadMixModal').then(m => ({ default: m.UploadMixModal })));
const PaymentModal = lazy(() => import('./components/modals/PaymentModal').then(m => ({ default: m.PaymentModal })));
const InvoiceModal = lazy(() => import('./components/modals/InvoiceModal').then(m => ({ default: m.InvoiceModal })));

const AppContent: React.FC = () => {
  const { 
    user, 
    loading, 
    organization, 
    role,
    provisioning, 
    provisioningError, 
    refreshProfileAndOrg 
  } = useAuth();
  const { 
    currentView, 
    setCurrentView,
    engineerTab, 
    setEngineerTab,
    activeProjectId,
    setActiveProjectId,
    setActiveClientToken,
    projects
  } = useApp();

  const isClientAccountEntry = new URLSearchParams(window.location.search).get('client') === '1';
  const isPasswordRecovery = window.location.hash.includes('type=recovery') || new URLSearchParams(window.location.search).get('reset') === '1';
  const isPreviewMode = new URLSearchParams(window.location.search).get('preview') === '1';
  const collaboratorMatch = window.location.hash.match(/^#\/collaborator\/invite\/([^/]+)$/);
  const collaboratorToken = collaboratorMatch?.[1] || null;

  const isStudioStaff = Boolean(
    user && organization && role && ['owner', 'admin', 'engineer', 'producer', 'finance'].includes(role)
  );
  const isClientAccount = Boolean(
    user && user.user_metadata?.account_type === 'client' && !organization
  );

  // FIX 2: Studio users with valid organization membership (owner, admin, engineer, producer, finance)
  // are routed to the Engineer/Studio Console after authentication if the browser remained on #/client.
  // Public review links (#/review/...) and genuine client users are strictly preserved.
  useEffect(() => {
    if (!loading && user && isClientAccount && !isPreviewMode) {
      const hash = window.location.hash;
      if (!hash.startsWith('#/review/')) setCurrentView('client');
      return;
    }

    if (!loading && user && isStudioStaff && !isPreviewMode) {
      const hash = window.location.hash;
      // Do NOT interfere with public review links (#/review/...)
      if (hash.startsWith('#/review/')) {
        return;
      }

      // If user is studio staff and arrived or remained on a generic client route (#/client, #/client/projects)
      // or empty hash, ensure they are routed to the Engineer/Studio Console after authentication.
      if (
        currentView === 'client' &&
        !hash.startsWith('#/client/') &&
        hash !== '#/client' &&
        hash !== '#client' &&
        (hash === '' || hash === '#engineer' || hash === '#/engineer' || hash === '#dashboard')
      ) {
        setCurrentView('engineer');
        setEngineerTab('projects');
      }
    }
  }, [user, loading, isStudioStaff, isClientAccount, currentView, setCurrentView, setEngineerTab]);

  // Listen to hash change for direct share links and tab routing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/review/')) {
        const token = hash.replace('#/review/', '');
        const found = projects.find(p => p.shareToken === token);
        if (found) {
          setActiveClientToken(token);
          setCurrentView('client');
        }
      } else if (hash === '#clients' || hash === '#/clients') {
        // The engineer Clients page must be handled before the generic
        // #/client... route below because "#/clients" starts with "#/client".
        setCurrentView('engineer');
        setActiveProjectId(null);
        setEngineerTab('clients');
      } else if (hash.startsWith('#/review/') || hash.startsWith('#review/')) {
        setCurrentView('client');
        setActiveProjectId(null);
      } else if (hash.startsWith('#/client/') || hash.startsWith('#client/')) {
        // Real Client Portal routes must stay in the Client Portal, even if
        // the browser currently has a studio staff session. This is important
        // for song-specific review links sent to clients.
        setCurrentView('client');
      } else if (hash.startsWith('#/project/') || hash.startsWith('#project/')) {
        const pId = hash.replace(/^#\/?project\//, '');
        if (pId) {
          setCurrentView('engineer');
          setEngineerTab('projects');
          setActiveProjectId(pId);
        }
      } else if (hash === '#invoices' || hash === '#/invoices') {
        setCurrentView('engineer');
        setActiveProjectId(null);
        setEngineerTab('invoices');
      } else if (hash === '#settings' || hash === '#/settings' || hash.startsWith('#/settings/') || hash === '#team' || hash === '#/team') {
        setCurrentView('engineer');
        setActiveProjectId(null);
        setEngineerTab('settings');
      } else if (hash === '#projects' || hash === '#/projects') {
        setCurrentView('engineer');
        setActiveProjectId(null);
        setEngineerTab('projects');
      } else if (hash === '#engineer' || hash === '#/engineer' || hash === '#dashboard' || hash === '') {
        if (isClientAccount) setCurrentView('client');
        else setCurrentView('engineer');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [projects, setActiveClientToken, setCurrentView, setEngineerTab, setActiveProjectId, isClientAccount, hasPendingClientClaim, clientLibraryAccess, isClientAuthCallback]);

  // Auth should never leave the user on an indefinite blank/loading screen.
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-zinc-100 font-sans">
        <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/80 p-7 text-center shadow-2xl">
          <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Disc3 size={24} className="animate-spin" />
          </div>
          <h1 className="text-base font-semibold text-white">Opening MixFlow</h1>
          <p className="mt-1 text-xs text-zinc-400">Restoring your secure session…</p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full w-1/3 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">This should only take a moment.</p>
        </div>
      </div>
    );
  }

  // Dedicated client account entry. Client accounts use email + password and
  // never enter studio organization provisioning.
  if (isClientAccountEntry && !user && !isPasswordRecovery) {
    return <ClientAuthScreen />;
  }

  // Provisioning state: User authenticated but studio organization is currently being created
  if (user && !organization && provisioning) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
          <Disc3 size={24} className="animate-spin-slow" />
        </div>
        <p className="text-xs text-emerald-400 font-mono tracking-wider font-semibold">FINALIZING STUDIO WORKSPACE & PERMISSIONS...</p>
        <p className="text-[11px] text-zinc-500 mt-1">Configuring organization and owner role</p>
      </div>
    );
  }

  // Provisioning failure state: Show actionable error and retry option
  if (user && !organization && provisioningError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-zinc-100 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
            <Disc3 size={24} />
          </div>
          <h2 className="text-base font-bold text-white tracking-tight">Studio Setup Incomplete</h2>
          <p className="text-xs text-red-400/90 leading-relaxed bg-red-950/40 p-3 rounded-xl border border-red-900/50 font-mono">
            {provisioningError}
          </p>
          <p className="text-[11px] text-zinc-400">
            Click below to retry provisioning your studio organization.
          </p>
          <button
            onClick={() => refreshProfileAndOrg()}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Retry Workspace Provisioning
          </button>
        </div>
      </div>
    );
  }

  if (collaboratorToken) {
    return <CollaboratorPortal token={collaboratorToken} />;
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-zinc-100 font-sans">
        <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/80 p-7 text-center shadow-2xl">
          <div className="mx-auto mb-4 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400"><Disc3 size={20} className="animate-spin" /></div>
          <p className="text-sm font-medium text-white">Loading your workspace</p>
          <p className="mt-1 text-xs text-zinc-500">Getting the next screen ready…</p>
        </div>
      </div>
    }>
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black pb-16">
      {/* 1. Client View: Either share review link or authenticated Client Portal */}
      {currentView === 'client' ? (
        isPreviewMode ? (
          <ClientAudioReviewView projectId="preview-demo-project" songs={[{ id: 'preview-demo-song', title: 'Demo Song — Client Review Preview', track_number: 1 }]} />
        ) : window.location.hash.startsWith('#/review/') ? (
          <ClientPortal />
        ) : !user || isPasswordRecovery ? (
          <AuthScreen />
        ) : (
          <ClientPortal />
        )
      ) : !user || isPasswordRecovery ? (
        /* 2. Unauthenticated Engineer / Password Recovery */
        <AuthScreen />
      ) : (
        /* 3. Authenticated Engineer: Full Studio Console (Organization & Owner role confirmed) */
        <div className="min-h-screen flex flex-col">
          <Navbar />
          
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
            {activeProjectId ? (
              <ProjectOverviewView 
                projectId={activeProjectId} 
                onBack={() => {
                  window.location.hash = '#projects';
                  setActiveProjectId(null);
                }} 
              />
            ) : engineerTab === 'projects' ? (
              <DashboardView onSelectProject={(id) => setActiveProjectId(id)} />
            ) : engineerTab === 'clients' ? (
              <ClientsView />
            ) : engineerTab === 'invoices' ? (
              <InvoicesView />
            ) : (
              <SettingsView />
            )}
          </main>
        </div>
      )}



      {/* Global Modals */}
      <NewProjectModal />
      <UploadMixModal />
      <PaymentModal />
      <InvoiceModal />
    </div>
    </Suspense>
  );
};

export default function App() {
  // UI-only client portal preview for product/design testing. It never touches auth or project data.
  if (new URLSearchParams(window.location.search).get('preview') === 'client') {
    return <ClientPortalPreview />;
  }

  // Public review links are intentionally outside AuthProvider: clients do not need a MixFlow account.
  if (/^#\/?review\//.test(window.location.hash)) {
    return <PublicReviewView />;
  }

  // Keep the mobile upload route outside the main studio providers.
  // This minimizes memory while Android's native file picker is open.
  const mobileUploadMatch = window.location.hash.match(/^#\/mobile-upload\/([^?]+)/);
  if (mobileUploadMatch?.[1]) {
    return <MobileProjectFileUploadView projectId={decodeURIComponent(mobileUploadMatch[1])} />;
  }

  return (
    <AuthProvider>
      <ProjectsProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ProjectsProvider>
    </AuthProvider>
  );
}
