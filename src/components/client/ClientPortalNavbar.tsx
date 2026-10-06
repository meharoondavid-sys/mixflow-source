import React, { useState } from 'react';
import { Disc3, LogOut, User as UserIcon, Bell, X } from 'lucide-react';
import { ClientPortalProfile } from '../../types/clientPortal';
import { useNotifications } from '../../hooks/useNotifications';

interface ClientPortalNavbarProps {
  profile: ClientPortalProfile | null;
  onSignOut: () => void;
}

export const ClientPortalNavbar: React.FC<ClientPortalNavbarProps> = ({ profile, onSignOut }) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);

  const formatNotifTime = (iso?: string | null) => {
    if (!iso) return 'Just now';
    try {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return 'Recent';
    }
  };

  const handleNotificationClick = async (notifId: string, linkUrl?: string | null) => {
    await markAsRead(notifId);
    setShowNotifications(false);
    if (linkUrl) {
      window.location.hash = linkUrl;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10">
            <Disc3 size={20} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-tight">MixFlow</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold uppercase tracking-wider">
                Client Portal
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono hidden sm:block">Studio Audio Production Access</p>
          </div>
        </div>

        {/* User Profile, Notifications & Sign Out */}
        <div className="flex items-center gap-3">
          {/* Client Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors relative cursor-pointer"
              aria-label="View notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center font-mono animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Project Alerts</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] text-zinc-400 hover:text-emerald-400 transition-colors font-medium cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No project notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isUnread = !n.read_at;
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n.id, n.link_url)}
                          className={`p-3 rounded-xl border text-xs transition-colors cursor-pointer ${
                            isUnread
                              ? 'bg-zinc-950 border-emerald-500/30 hover:border-emerald-500/60'
                              : 'bg-zinc-950/40 border-zinc-800/80 hover:border-zinc-700 opacity-80'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isUnread && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              )}
                              <span className={`truncate font-semibold ${isUnread ? 'text-emerald-300' : 'text-zinc-300'}`}>
                                {n.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">
                              {formatNotifTime(n.created_at)}
                            </span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed text-[11px] line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {profile && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                <UserIcon size={14} />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-medium text-zinc-200 leading-tight">{profile.full_name}</p>
                <p className="text-[10px] text-zinc-500 truncate max-w-[160px] leading-tight">{profile.email || profile.company_name || 'Client Account'}</p>
              </div>
            </div>
          )}

          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-xl transition-all cursor-pointer"
            title="Sign out of MixFlow"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
