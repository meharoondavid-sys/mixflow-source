import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { 
  Project, 
  Client, 
  EngineerProfile, 
  Notification, 
  MixVersion, 
  Comment, 
  DeliveryFile,
  ActivityItem,
  UserProfile,
  Organization,
  OrganizationRole
} from '../types';
import { 
  INITIAL_CLIENTS, 
  INITIAL_PROJECTS, 
  INITIAL_NOTIFICATIONS 
} from '../data/initialData';
import { globalAudioEngine, generateWaveformPeaks } from '../utils/audioEngine';
import { useAuth } from './AuthContext';
import { useProjectsContext } from './ProjectsContext';
import { getSupabase } from '../lib/supabase';

interface AppContextType {
  // Supabase Auth & Organization Identity
  user: User | null;
  profile: UserProfile | null;
  organization: Organization | null;
  role: OrganizationRole | null;
  signOut: () => Promise<void>;

  // Navigation & Role
  currentView: 'engineer' | 'client';
  setCurrentView: (view: 'engineer' | 'client') => void;
  engineerTab: 'projects' | 'clients' | 'invoices' | 'settings';
  setEngineerTab: (tab: 'projects' | 'clients' | 'invoices' | 'settings') => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeClientToken: string | null;
  setActiveClientToken: (token: string | null) => void;

  // Data
  engineer: EngineerProfile;
  clients: Client[];
  projects: Project[];
  notifications: Notification[];
  activeProject: Project | null;
  clientActiveProject: Project | null;

  // Audio Playback
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  activeVersionId: string | null;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  switchActiveVersion: (versionId: string) => void;

  // Actions
  createProject: (data: {
    title: string;
    artist: string;
    genre: string;
    clientId: string;
    brief: string;
    referenceTracks: string[];
    totalAmount: number;
    initialMixName: string;
    audioFile?: File | null;
  }) => void;
  uploadMixVersion: (
    projectId: string, 
    versionName: string, 
    notes: string, 
    audioFile?: File | null,
    lufs?: number
  ) => void;
  addComment: (
    projectId: string, 
    versionId: string, 
    text: string, 
    timestampSeconds: number, 
    author: string, 
    authorRole: 'client' | 'engineer'
  ) => void;
  toggleCommentResolved: (projectId: string, commentId: string) => void;
  replyComment: (projectId: string, commentId: string, replyText: string) => void;
  approveProject: (projectId: string) => void;
  processPayment: (
    projectId: string, 
    amount: number, 
    provider: 'razorpay' | 'stripe' | 'manual', 
    transactionId?: string
  ) => void;
  addClient: (clientData: Omit<Client, 'id' | 'projectCount' | 'totalBilled' | 'createdAt'>) => Client;
  updateEngineerProfile: (updates: Partial<EngineerProfile>) => void;
  markNotificationsRead: () => void;
  openClientReview: (token: string) => void;
  openEngineerProject: (projectId: string) => void;
  downloadFile: (filename: string, fileType: string) => void;

  // Modals
  isNewProjectOpen: boolean;
  setIsNewProjectOpen: (open: boolean) => void;
  isUploadMixOpen: boolean;
  setIsUploadMixOpen: (open: boolean) => void;
  activeUploadSongId: string | null;
  setActiveUploadSongId: (songId: string | null) => void;
  isPaymentModalOpen: boolean;
  setIsPaymentModalOpen: (open: boolean) => void;
  isInvoiceModalOpen: boolean;
  setIsInvoiceModalOpen: (open: boolean) => void;
  isShareModalOpen: boolean;
  setIsShareModalOpen: (open: boolean) => void;
  activeInvoiceProject: Project | null;
  setActiveInvoiceProject: (proj: Project | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'mixflow_app_state_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, organization, role, signOut, refreshProfileAndOrg } = useAuth();

  // Dynamic Engineer Profile derived from real Supabase user, profile, and organization
  const engineer: EngineerProfile = useMemo(() => {
    const rawRole = role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Studio Engineer';
    return {
      id: user?.id || 'anonymous',
      name: profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Studio Engineer'),
      studioName: organization?.name || 'Studio Workspace',
      email: user?.email || '',
      role: rawRole,
      avatarUrl: profile?.avatar_url || '',
      hourlyRate: 85,
      currency: 'USD',
      razorpayKeyId: '',
      stripeConnected: true,
      phone: profile?.phone || '',
      bio: organization?.slug ? `Organization: ${organization.slug}` : 'Commercial Audio Studio'
    };
  }, [user, profile, organization, role]);

  const [clients, setClients] = useState<Client[]>([]);

  // Sync real clients from Supabase for current organization
  useEffect(() => {
    // Clear old localStorage if exists
    try {
      localStorage.removeItem(`${STORAGE_KEY}_clients`);
    } catch {}

    if (!organization?.id) {
      setClients([]);
      return;
    }

    const supabase = getSupabase();
    supabase
      .from('clients')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setClients(
            data.map((c) => ({
              id: c.id,
              name: c.full_name,
              email: c.email || '',
              phone: c.phone || '',
              company: c.company_name || 'Independent Artist',
              projectCount: 0,
              totalBilled: 0,
              createdAt: new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            }))
          );
        } else {
          setClients([]);
        }
      });
  }, [organization?.id]);

  const [projects, setProjects] = useState<Project[]>([]);

  const projectsCtx = useProjectsContext();

  // Sync real projects from ProjectsContext for current organization
  useEffect(() => {
    // Clear old localStorage if exists
    try {
      localStorage.removeItem(`${STORAGE_KEY}_projects`);
    } catch {}

    if (projectsCtx?.projects) {
      setProjects(
        projectsCtx.projects.map((p) => ({
          id: p.id,
          title: p.name,
          artist: p.client?.full_name || 'Artist',
          genre: p.project_type.toUpperCase(),
          clientId: p.client_id,
          clientName: p.client?.full_name || 'Client',
          clientEmail: p.client?.email || '',
          clientPhone: p.client?.phone || '',
          status: p.status,
          brief: p.description || '',
          referenceTracks: [],
          totalAmount: Number(p.project_price) || 0,
          paidAmount: Number(p.deposit_amount) || 0,
          shareToken: p.id.slice(0, 8),
          activeVersionId: 'v1',
          isApproved: p.status === 'approved',
          versions: [],
          comments: [],
          activities: [],
          deliveries: [],
          invoiceNumber: `INV-${p.id.slice(0, 6).toUpperCase()}`,
          invoiceDate: new Date(p.created_at).toISOString().split('T')[0],
          dueDate: p.deadline || new Date().toISOString().split('T')[0],
          createdAt: new Date(p.created_at).toISOString().split('T')[0],
        }))
      );
    } else {
      setProjects([]);
    }
  }, [projectsCtx?.projects]);

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_notifs`);
      return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });

  // Navigation states
  const [currentView, setCurrentView] = useState<'engineer' | 'client'>('engineer');
  const [engineerTab, setEngineerTab] = useState<'projects' | 'clients' | 'invoices' | 'settings'>('projects');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeClientToken, setActiveClientToken] = useState<string | null>(null);

  // Audio Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(184);
  const [volume, setVolumeState] = useState(0.8);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  // Modals
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isUploadMixOpen, setIsUploadMixOpen] = useState(false);
  const [activeUploadSongId, setActiveUploadSongId] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [activeInvoiceProject, setActiveInvoiceProject] = useState<Project | null>(null);

  // Save changes (only for demo notifs, NEVER for business data, clients, projects, or auth)
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_notifs`, JSON.stringify(notifications));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }, [notifications]);

  // Connect Audio Engine Callbacks
  useEffect(() => {
    globalAudioEngine.setCallbacks(
      (time) => setCurrentTime(time),
      (playing) => setIsPlaying(playing)
    );
  }, []);

  // Compute active project
  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const clientActiveProject = projects.find(p => p.shareToken === activeClientToken) || projects[0];

  // Sync active audio version when project changes
  useEffect(() => {
    const proj = currentView === 'engineer' ? activeProject : clientActiveProject;
    if (proj && proj.versions.length > 0) {
      const targetVersion = proj.versions.find(v => v.id === proj.activeVersionId) || proj.versions[0];
      setActiveVersionId(targetVersion.id);
      setDuration(targetVersion.durationSeconds);
      globalAudioEngine.loadTrack(targetVersion.audioUrl, targetVersion.durationSeconds);
    }
  }, [activeProjectId, activeClientToken, currentView]);

  // Audio actions
  const play = () => globalAudioEngine.play();
  const pause = () => globalAudioEngine.pause();
  const togglePlay = () => globalAudioEngine.togglePlay();
  const seek = (time: number) => globalAudioEngine.seek(time);
  const setVolume = (vol: number) => {
    setVolumeState(vol);
    globalAudioEngine.setVolume(vol);
  };

  const switchActiveVersion = (versionId: string) => {
    const proj = currentView === 'engineer' ? activeProject : clientActiveProject;
    if (!proj) return;
    const version = proj.versions.find(v => v.id === versionId);
    if (version) {
      setActiveVersionId(versionId);
      setDuration(version.durationSeconds);
      // Remember current position for smooth A/B previewing
      const cur = currentTime;
      globalAudioEngine.loadTrack(version.audioUrl, version.durationSeconds);
      globalAudioEngine.seek(cur);
      if (isPlaying) {
        globalAudioEngine.play();
      }
    }
  };

  // Actions
  const createProject = (data: {
    title: string;
    artist: string;
    genre: string;
    clientId: string;
    brief: string;
    referenceTracks: string[];
    totalAmount: number;
    initialMixName: string;
    audioFile?: File | null;
  }) => {
    const client = clients.find(c => c.id === data.clientId) || clients[0];
    const newId = `proj_${Date.now()}`;
    const token = `rev-${Math.random().toString(36).substring(2, 7)}-${Date.now().toString().slice(-4)}`;
    
    let audioUrl = '#';
    if (data.audioFile) {
      audioUrl = URL.createObjectURL(data.audioFile);
    }

    const version1: MixVersion = {
      id: `v_${Date.now()}`,
      projectId: newId,
      versionNumber: 1,
      versionName: data.initialMixName || 'Mix V1 - Initial Balance',
      notes: 'Initial high-resolution multi-track mix pass.',
      audioUrl,
      durationSeconds: 195,
      sampleRate: '48.0 kHz',
      bitDepth: '24-bit',
      lufs: -12.5,
      createdAt: new Date().toISOString().split('T')[0],
      waveformPeaks: generateWaveformPeaks(Math.floor(Math.random() * 100), 85, 1.0)
    };

    const initialDeliveries: DeliveryFile[] = [
      {
        id: `del_master_${Date.now()}`,
        name: `${data.title.replace(/\s+/g, '_')}_Master_24bit_48k.wav`,
        format: 'WAV 24-bit / 48kHz',
        size: '56.2 MB',
        type: 'master',
        downloadUrl: '#'
      },
      {
        id: `del_mp3_${Date.now()}`,
        name: `${data.title.replace(/\s+/g, '_')}_320k.mp3`,
        format: 'MP3 320 kbps',
        size: '7.8 MB',
        type: 'master',
        downloadUrl: '#'
      },
      {
        id: `del_inst_${Date.now()}`,
        name: `${data.title.replace(/\s+/g, '_')}_Instrumental.wav`,
        format: 'WAV 24-bit / 48kHz',
        size: '54.9 MB',
        type: 'instrumental',
        downloadUrl: '#'
      }
    ];

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const invNumber = `INV-${new Date().getFullYear()}-${String(projects.length + 42).padStart(4, '0')}`;

    const newProject: Project = {
      id: newId,
      title: data.title,
      artist: data.artist,
      genre: data.genre,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      status: 'in-review',
      brief: data.brief || 'Commercial studio mix for digital streaming distribution.',
      referenceTracks: data.referenceTracks.length > 0 ? data.referenceTracks : ['Commercial standard reference'],
      totalAmount: data.totalAmount,
      paidAmount: 0,
      shareToken: token,
      activeVersionId: version1.id,
      isApproved: false,
      invoiceNumber: invNumber,
      invoiceDate: today,
      dueDate: dueDate,
      createdAt: today,
      versions: [version1],
      comments: [],
      activities: [
        {
          id: `act_${Date.now()}`,
          timestamp: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          actor: engineer.name,
          type: 'created',
          description: `Created project and uploaded ${version1.versionName}.`
        }
      ],
      deliveries: initialDeliveries
    };

    setProjects(prev => [newProject, ...prev]);

    // Update client count
    setClients(prev => prev.map(c => c.id === client.id ? { 
      ...c, 
      projectCount: c.projectCount + 1,
      totalBilled: c.totalBilled + data.totalAmount 
    } : c));

    // Open project right away
    setActiveProjectId(newId);
    setIsNewProjectOpen(false);
  };

  const uploadMixVersion = (
    projectId: string, 
    versionName: string, 
    notes: string, 
    audioFile?: File | null,
    lufs = -10.5
  ) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;

    let audioUrl = '#';
    if (audioFile) {
      audioUrl = URL.createObjectURL(audioFile);
    }

    const nextVerNumber = proj.versions.length + 1;
    const newVersionId = `v_${Date.now()}`;
    const newVersion: MixVersion = {
      id: newVersionId,
      projectId,
      versionNumber: nextVerNumber,
      versionName: versionName || `Mix V${nextVerNumber} - Revision`,
      notes: notes || 'Revision addressing client notes.',
      audioUrl,
      durationSeconds: proj.versions[0]?.durationSeconds || 184,
      sampleRate: '48.0 kHz',
      bitDepth: '24-bit',
      lufs,
      createdAt: new Date().toISOString().split('T')[0],
      waveformPeaks: generateWaveformPeaks(nextVerNumber * 27, 85, 1.15 + nextVerNumber * 0.1)
    };

    const newActivity: ActivityItem = {
      id: `act_${Date.now()}`,
      timestamp: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      actor: engineer.name,
      type: 'version_uploaded',
      description: `Uploaded Mix V${nextVerNumber}: "${newVersion.versionName}".`
    };

    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          status: 'in-review',
          activeVersionId: newVersionId,
          versions: [newVersion, ...p.versions],
          activities: [newActivity, ...p.activities]
        };
      }
      return p;
    }));

    setActiveVersionId(newVersionId);
    setIsUploadMixOpen(false);
  };

  const addComment = (
    projectId: string, 
    versionId: string, 
    text: string, 
    timestampSeconds: number, 
    author: string, 
    authorRole: 'client' | 'engineer'
  ) => {
    if (!text.trim()) return;

    const newComment: Comment = {
      id: `c_${Date.now()}`,
      versionId,
      author,
      authorRole,
      text: text.trim(),
      timestampSeconds: Math.round(timestampSeconds),
      resolved: false,
      createdAt: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    };

    const activity: ActivityItem = {
      id: `act_${Date.now()}`,
      timestamp: newComment.createdAt,
      actor: author,
      type: 'comment_added',
      description: `Left timestamped feedback at ${Math.floor(timestampSeconds / 60)}:${String(Math.round(timestampSeconds % 60)).padStart(2, '0')}: "${text.slice(0, 45)}..."`
    };

    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          status: authorRole === 'client' ? 'revision-requested' : p.status,
          comments: [newComment, ...p.comments],
          activities: [activity, ...p.activities]
        };
      }
      return p;
    }));

    if (authorRole === 'client') {
      const proj = projects.find(p => p.id === projectId);
      const newNotif: Notification = {
        id: `notif_${Date.now()}`,
        projectId,
        projectTitle: proj?.title || 'Project',
        title: 'New Client Feedback',
        message: `${author} added a note at ${Math.floor(timestampSeconds / 60)}:${String(Math.round(timestampSeconds % 60)).padStart(2, '0')}: "${text}"`,
        time: 'Just now',
        read: false,
        type: 'comment'
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  };

  const toggleCommentResolved = (projectId: string, commentId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        const updated = p.comments.map(c => {
          if (c.id === commentId) {
            return { ...c, resolved: !c.resolved };
          }
          return c;
        });
        return { ...p, comments: updated };
      }
      return p;
    }));
  };

  const replyComment = (projectId: string, commentId: string, replyText: string) => {
    if (!replyText.trim()) return;
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        const updated = p.comments.map(c => {
          if (c.id === commentId) {
            return { ...c, replyText: replyText.trim() };
          }
          return c;
        });
        return { ...p, comments: updated };
      }
      return p;
    }));
  };

  const approveProject = (projectId: string) => {
    const now = `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const proj = projects.find(p => p.id === projectId);

    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        const isFullyPaid = p.paidAmount >= p.totalAmount;
        const nextStatus = isFullyPaid ? 'completed' : 'approved';
        return {
          ...p,
          isApproved: true,
          approvedAt: now,
          status: nextStatus,
          activities: [
            {
              id: `act_${Date.now()}`,
              timestamp: now,
              actor: `${p.clientName} (Client)`,
              type: 'approved',
              description: 'Client approved the mix as Final Master.'
            },
            ...p.activities
          ]
        };
      }
      return p;
    }));

    // Add notification
    setNotifications(prev => [
      {
        id: `notif_${Date.now()}`,
        projectId,
        projectTitle: proj?.title || 'Project',
        title: '🎉 Mix Approved by Client!',
        message: `${proj?.clientName} just approved ${proj?.title} as final master.`,
        time: 'Just now',
        read: false,
        type: 'approval'
      },
      ...prev
    ]);
  };

  const processPayment = (
    projectId: string, 
    amount: number, 
    provider: 'razorpay' | 'stripe' | 'manual',
    transactionId?: string
  ) => {
    const now = `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const proj = projects.find(p => p.id === projectId);

    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        const newPaid = Math.min(p.totalAmount, p.paidAmount + amount);
        const isComplete = newPaid >= p.totalAmount && p.isApproved;
        return {
          ...p,
          paidAmount: newPaid,
          status: isComplete ? 'completed' : (p.isApproved ? 'approved' : p.status),
          activities: [
            {
              id: `act_${Date.now()}`,
              timestamp: now,
              actor: `${p.clientName} (Client)`,
              type: 'payment_received',
              description: `Payment of ${engineer.currency === 'INR' ? '₹' : '$'}${amount.toFixed(2)} received via ${provider.toUpperCase()}${transactionId ? ` (ID: ${transactionId})` : ''}.`
            },
            ...p.activities
          ]
        };
      }
      return p;
    }));

    setNotifications(prev => [
      {
        id: `notif_${Date.now()}`,
        projectId,
        projectTitle: proj?.title || 'Project',
        title: 'Payment Received',
        message: `Received ${engineer.currency === 'INR' ? '₹' : '$'}${amount.toFixed(2)} for ${proj?.title} via ${provider.toUpperCase()}.`,
        time: 'Just now',
        read: false,
        type: 'payment'
      },
      ...prev
    ]);

    setIsPaymentModalOpen(false);
  };

  const addClient = (clientData: Omit<Client, 'id' | 'projectCount' | 'totalBilled' | 'createdAt'>) => {
    const newId = crypto.randomUUID();
    const newClient: Client = {
      ...clientData,
      id: newId,
      projectCount: 0,
      totalBilled: 0,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    if (organization?.id) {
      const supabase = getSupabase();
      supabase
        .from('clients')
        .insert({
          id: newId,
          organization_id: organization.id,
          full_name: clientData.name,
          email: clientData.email || null,
          phone: clientData.phone || null,
          company_name: clientData.company || null,
        })
        .then(({ error }) => {
          if (error) {
            console.error('[MixFlow Clients] addClient sync notice:', error.message);
          }
        });
    }

    setClients(prev => [newClient, ...prev]);
    return newClient;
  };

  const updateEngineerProfile = async (updates: Partial<EngineerProfile>) => {
    if (user) {
      const supabase = getSupabase();
      if (updates.name !== undefined || updates.phone !== undefined) {
        await supabase
          .from('profiles')
          .update({
            ...(updates.name !== undefined ? { full_name: updates.name } : {}),
            ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
      if (updates.studioName !== undefined && organization) {
        await supabase
          .from('organizations')
          .update({
            name: updates.studioName,
            updated_at: new Date().toISOString()
          })
          .eq('id', organization.id);
      }
      await refreshProfileAndOrg();
    }
  };

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const openClientReview = (token: string) => {
    pause();
    setActiveClientToken(token);
    setCurrentView('client');
  };

  const openEngineerProject = (projectId: string) => {
    pause();
    setActiveProjectId(projectId);
    setCurrentView('engineer');
  };

  const downloadFile = (filename: string, fileType: string) => {
    // Generate clean client-side audio/text blob download
    const blob = new Blob([`MixFlow Audio Master Package: ${filename}\nFormat: ${fileType}\nCertified by Sonic Horizon Studios`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        organization,
        role,
        signOut,

        currentView,
        setCurrentView,
        engineerTab,
        setEngineerTab,
        activeProjectId,
        setActiveProjectId,
        activeClientToken,
        setActiveClientToken,
        engineer,
        clients,
        projects,
        notifications,
        activeProject,
        clientActiveProject,

        isPlaying,
        currentTime,
        duration,
        volume,
        activeVersionId,
        play,
        pause,
        togglePlay,
        seek,
        setVolume,
        switchActiveVersion,

        createProject,
        uploadMixVersion,
        addComment,
        toggleCommentResolved,
        replyComment,
        approveProject,
        processPayment,
        addClient,
        updateEngineerProfile,
        markNotificationsRead,
        openClientReview,
        openEngineerProject,
        downloadFile,

        isNewProjectOpen,
        setIsNewProjectOpen,
        isUploadMixOpen,
        setIsUploadMixOpen,
        activeUploadSongId,
        setActiveUploadSongId,
        isPaymentModalOpen,
        setIsPaymentModalOpen,
        isInvoiceModalOpen,
        setIsInvoiceModalOpen,
        isShareModalOpen,
        setIsShareModalOpen,
        activeInvoiceProject,
        setActiveInvoiceProject
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
