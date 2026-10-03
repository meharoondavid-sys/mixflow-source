import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  ExternalLink, 
  Sliders, 
  Disc3, 
  CheckCircle2, 
  CreditCard, 
  MessageSquare,
  X,
  ChevronDown,
  UserCheck,
  Download,
  LogOut,
  User,
  Building,
  Users
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { downloadProjectSourceZip } from '../utils/exportSourceZip';

export const Navbar: React.FC = () => {
  const { 
    currentView, 
    setCurrentView, 
    engineerTab, 
    setEngineerTab, 
    activeProjectId, 
    setActiveProjectId, 
    activeProject,
    clientActiveProject,
    setIsNewProjectOpen, 
    notifications,
    markNotificationsRead,
    engineer,
    openClientReview,
    projects,
    user,
    profile,
    organization,
    role,
    signOut
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  const currentClientProject = clientActiveProject || projects[0];

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await signOut();
  };

  const userDisplayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Engineer';
  const orgDisplayName = organization?.name || 'Studio Console';
  const roleDisplay = role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Owner';
  const initials = userDisplayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div 
            onClick={() => {
              if (currentView === 'engineer') {
                setActiveProjectId(null);
                setEngineerTab('projects');
              }
            }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <Disc3 size={18} className="animate-spin-slow" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white font-sans">
              MixFlow
            </span>
          </div>

          {/* Context Tag */}
          <span className="hidden sm:inline text-xs text-zinc-400 font-mono">
            / {currentView === 'engineer' ? 'Studio Console' : 'Client Review'}
          </span>
        </div>

        {/* Zone 2: Navigation Links (single-line, 1-2 words) */}
        {currentView === 'engineer' ? (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <button
              onClick={() => {
                setActiveProjectId(null);
                setEngineerTab('projects');
                window.location.hash = '#/projects';
              }}
              className={`hover:text-white transition-colors pb-0.5 cursor-pointer ${
                !activeProjectId && engineerTab === 'projects' ? 'text-white border-b-2 border-emerald-400 font-semibold' : ''
              }`}
              aria-current={!activeProjectId && engineerTab === 'projects' ? 'page' : undefined}
            >
              Projects
            </button>
            <button
              onClick={() => {
                setActiveProjectId(null);
                setEngineerTab('clients');
                window.location.hash = '#/clients';
              }}
              className={`hover:text-white transition-colors pb-0.5 cursor-pointer flex items-center gap-1.5 ${
                !activeProjectId && engineerTab === 'clients' ? 'text-white border-b-2 border-emerald-400 font-semibold' : ''
              }`}
              aria-current={!activeProjectId && engineerTab === 'clients' ? 'page' : undefined}
            >
              <span>Clients</span>
            </button>
            <button
              onClick={() => {
                setActiveProjectId(null);
                setEngineerTab('invoices');
                window.location.hash = '#/invoices';
              }}
              className={`hover:text-white transition-colors pb-0.5 cursor-pointer ${
                !activeProjectId && engineerTab === 'invoices' ? 'text-white border-b-2 border-emerald-400 font-semibold' : ''
              }`}
              aria-current={!activeProjectId && engineerTab === 'invoices' ? 'page' : undefined}
            >
              Invoices
            </button>
            <button
              onClick={() => {
                setActiveProjectId(null);
                setEngineerTab('settings');
                window.location.hash = '#/settings';
              }}
              className={`hover:text-white transition-colors pb-0.5 cursor-pointer ${
                !activeProjectId && engineerTab === 'settings' ? 'text-white border-b-2 border-emerald-400 font-semibold' : ''
              }`}
              aria-current={!activeProjectId && engineerTab === 'settings' ? 'page' : undefined}
            >
              Settings
            </button>
          </nav>
        ) : (
          <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-400">
            <span>Client Secure Review</span>
            <span aria-hidden="true">·</span>
            <span className="text-zinc-300 font-medium">{currentClientProject.title}</span>
          </div>
        )}

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {currentView === 'engineer' ? (
            <>
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    if (!showNotifications && unreadCount > 0) {
                      markNotificationsRead();
                    }
                  }}
                  className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors relative"
                  aria-label="View notifications"
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center font-mono">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Activity Alerts</span>
                      <button 
                        onClick={() => setShowNotifications(false)}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-emerald-400">{n.title}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">{n.time}</span>
                          </div>
                          <p className="text-zinc-300 leading-relaxed">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Download Source Code Button */}
              <button
                onClick={downloadProjectSourceZip}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-medium border border-zinc-800 transition-colors"
                title="Download full project source code as .ZIP"
              >
                <Download size={14} className="text-emerald-400" />
                <span className="hidden md:inline">Download Code</span>
              </button>

              {/* View as Client Quick Switcher */}
              <button
                onClick={() => {
                  const targetToken = activeProject?.shareToken || currentClientProject.shareToken;
                  openClientReview(targetToken);
                }}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-medium border border-zinc-800 transition-colors"
                title="Preview what your client sees"
              >
                <UserCheck size={14} className="text-emerald-400" />
                <span>Test Client Link</span>
              </button>

              {/* New Project Action */}
              <button
                onClick={() => setIsNewProjectOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-xs transition-colors shadow-sm"
              >
                <Plus size={16} />
                <span>New Project</span>
              </button>

              {/* User Profile & Role Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                  aria-label="User account menu"
                >
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center justify-center font-mono">
                    {initials}
                  </div>
                  <span className="hidden md:inline text-xs font-medium text-zinc-200 max-w-[100px] truncate">
                    {userDisplayName}
                  </span>
                  <ChevronDown size={13} className="text-zinc-500" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in duration-100 space-y-3">
                    <div className="px-2 py-1.5 border-b border-zinc-800 space-y-1">
                      <p className="font-bold text-xs text-white truncate">{userDisplayName}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{user?.email}</p>
                      <div className="flex items-center gap-1.5 pt-1 text-[10px] font-mono">
                        <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {roleDisplay}
                        </span>
                        <span className="text-zinc-400 truncate max-w-[120px]">
                          {orgDisplayName}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setActiveProjectId(null);
                          setEngineerTab('clients');
                          window.location.hash = '#/clients';
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                          !activeProjectId && engineerTab === 'clients'
                            ? 'text-emerald-400 bg-emerald-500/10 font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        <Users size={14} className="text-emerald-400" />
                        <span>Clients</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setActiveProjectId(null);
                          setEngineerTab('settings');
                          window.location.hash = '#/settings/team';
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Users size={14} className="text-zinc-500" />
                        <span>Team Members</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setActiveProjectId(null);
                          setEngineerTab('settings');
                          window.location.hash = '#/settings';
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Building size={14} className="text-zinc-500" />
                        <span>Studio Settings</span>
                      </button>

                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogOut size={14} />
                        <span>Sign Out of MixFlow</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Client View Header Action */
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentView('engineer')}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-medium border border-zinc-800 transition-colors"
              >
                Exit to Engineer Console
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Bar for small screens */}
      {currentView === 'engineer' && (
        <nav 
          aria-label="Mobile Navigation"
          className="md:hidden flex items-center justify-around border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md px-3 py-2 text-xs"
        >
          <button
            onClick={() => {
              setActiveProjectId(null);
              setEngineerTab('projects');
              window.location.hash = '#/projects';
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              !activeProjectId && engineerTab === 'projects'
                ? 'text-white bg-zinc-800 font-bold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Disc3 size={13} />
            <span>Projects</span>
          </button>

          <button
            onClick={() => {
              setActiveProjectId(null);
              setEngineerTab('clients');
              window.location.hash = '#/clients';
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              !activeProjectId && engineerTab === 'clients'
                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users size={13} />
            <span>Clients</span>
          </button>

          <button
            onClick={() => {
              setActiveProjectId(null);
              setEngineerTab('invoices');
              window.location.hash = '#/invoices';
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              !activeProjectId && engineerTab === 'invoices'
                ? 'text-white bg-zinc-800 font-bold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CreditCard size={13} />
            <span>Invoices</span>
          </button>

          <button
            onClick={() => {
              setActiveProjectId(null);
              setEngineerTab('settings');
              window.location.hash = '#/settings';
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              !activeProjectId && engineerTab === 'settings'
                ? 'text-white bg-zinc-800 font-bold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Building size={13} />
            <span>Settings</span>
          </button>
        </nav>
      )}
    </header>
  );
};
