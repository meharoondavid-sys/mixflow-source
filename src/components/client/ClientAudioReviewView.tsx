import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  MessageSquarePlus, 
  CheckCircle2, 
  Clock, 
  Music, 
  Layers, 
  Send,
  Loader2,
  AlertCircle,
  History,
  FileAudio,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Info,
  ListMusic
} from 'lucide-react';
import { ProjectFileVersionRecord, ProjectFeedbackRecord } from '../../types/versionFeedback';
import { getSupabase } from '../../lib/supabase';

interface ClientAudioReviewViewProps {
  projectId: string;
  songs: Array<{ id: string; title: string; track_number: number }>;
  initialSongId?: string | null;
  publicReviewToken?: string | null;
}

export const ClientAudioReviewView: React.FC<ClientAudioReviewViewProps> = ({ projectId, songs, initialSongId, publicReviewToken }) => {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(initialSongId && songs.some((song) => song.id === initialSongId) ? initialSongId : (songs[0]?.id || null));
  const [versions, setVersions] = useState<ProjectFileVersionRecord[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [feedbackList, setFeedbackList] = useState<ProjectFeedbackRecord[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [showHistory, setShowHistory] = useState<boolean>(false);
  
  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Feedback Form State
  const [commentText, setCommentText] = useState<string>('');
  const [showFeedbackForm, setShowFeedbackForm] = useState<boolean>(false);
  const [feedbackTimestamp, setFeedbackTimestamp] = useState<number>(0);
  const [feedbackMinutes, setFeedbackMinutes] = useState<number>(0);
  const [feedbackSeconds, setFeedbackSeconds] = useState<number>(0);
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'revision_requested' | 'mix_approved' | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAuthToken = async () => {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    return data.session?.access_token || null;
  };

  // Load project status for the review workflow.
  // Preview/demo projects are intentionally self-contained and must not depend on Supabase.
  useEffect(() => {
    let isCancelled = false;
    if (projectId.startsWith('preview-')) {
      setProjectStatus('in_review');
      return () => { isCancelled = true; };
    }
    const loadProjectStatus = async () => {
      const sb = getSupabase();
      const { data, error } = await sb.from('projects').select('status').eq('id', projectId).single();
      if (!isCancelled && !error) setProjectStatus(data?.status || null);
    };
    loadProjectStatus();
    return () => { isCancelled = true; };
  }, [projectId]);

  // 1. Fetch versions when selectedSongId changes
  useEffect(() => {
    let isCancelled = false;
    const loadVersions = async () => {
      try {
        if (publicReviewToken && selectedSongId) {
          const publicRes = await fetch(`/api/public-review/${projectId}/${selectedSongId}?token=${encodeURIComponent(publicReviewToken)}`);
          if (!publicRes.ok) return;
          const publicData = await publicRes.json();
          if (!isCancelled) {
            const vList: ProjectFileVersionRecord[] = publicData.versions || [];
            setVersions(vList);
            setFeedbackList(publicData.feedback || []);
            setProjectStatus(publicData.project?.status || 'in_review');
            if (vList.length > 0) {
              const latest = vList[vList.length - 1];
              if (!selectedVersionId || !vList.some(v => v.id === selectedVersionId)) setSelectedVersionId(latest.id);
            } else {
              setSelectedVersionId(null);
              setPlaybackUrl(null);
            }
          }
          return;
        }

        const token = await getAuthToken();
        if (!token) return;

        const url = selectedSongId
          ? `/api/projects/${projectId}/versions?songId=${selectedSongId}`
          : `/api/projects/${projectId}/versions`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled) {
          const vList: ProjectFileVersionRecord[] = data.versions || [];
          setVersions(vList);
          if (vList.length > 0) {
            // Auto-select the latest version by default
            const latest = vList[vList.length - 1];
            if (!selectedVersionId || !vList.some(v => v.id === selectedVersionId)) {
              setSelectedVersionId(latest.id);
            }
          } else {
            setSelectedVersionId(null);
            setPlaybackUrl(null);
          }
        }
      } catch (err) {
        console.error('Failed to load versions:', err);
      }
    };

    loadVersions();
    return () => {
      isCancelled = true;
    };
  }, [projectId, selectedSongId, publicReviewToken]);

  // 2. Fetch feedback and audio stream when selectedVersionId changes
  useEffect(() => {
    if (!selectedVersionId) {
      setFeedbackList([]);
      setPlaybackUrl(null);
      return;
    }

    let isCancelled = false;

    const loadFeedback = async () => {
      try {
        const token = publicReviewToken ? null : await getAuthToken();
        const feedbackUrl = publicReviewToken
          ? `/api/public-review/${projectId}/${selectedSongId}/feedback?token=${encodeURIComponent(publicReviewToken)}`
          : `/api/projects/${projectId}/feedback?versionId=${selectedVersionId}`;
        const res = await fetch(feedbackUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setFeedbackList(data.feedback || []);
        }
      } catch (err) {
        console.error('Failed to load feedback:', err);
      }
    };

    const loadPlaybackUrl = async () => {
      setLoadingAudio(true);
      setAudioError(null);
      try {
        const token = publicReviewToken ? null : await getAuthToken();
        const playbackUrlEndpoint = publicReviewToken
          ? `/api/public-review/${projectId}/${selectedSongId}/versions/${selectedVersionId}/playback-url?token=${encodeURIComponent(publicReviewToken)}`
          : `/api/projects/${projectId}/versions/${selectedVersionId}/playback-url`;
        const res = await fetch(playbackUrlEndpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!res.ok) {
          throw new Error('Failed to load audio stream.');
        }

        const data = await res.json();
        if (!isCancelled) {
          setPlaybackUrl(data.signedUrl);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setAudioError(err.message || 'Audio playback error.');
        }
      } finally {
        if (!isCancelled) {
          setLoadingAudio(false);
        }
      }
    };

    loadFeedback();
    loadPlaybackUrl();

    return () => {
      isCancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      setCurrentTime(0);
    };
  }, [projectId, selectedVersionId, publicReviewToken]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  };  const handlePlayPause = () => {
    if (!audioRef.current || !playbackUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.error('Audio play error:', err);
      });
    }
  };

  const handleSeek = (newTime: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const syncTimestampFields = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs));
    setFeedbackTimestamp(safe);
    setFeedbackMinutes(Math.floor(safe / 60));
    setFeedbackSeconds(safe % 60);
  };

  const updateTimestampFields = (minutes: number, seconds: number) => {
    const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
    const safeSeconds = Math.min(59, Math.max(0, Math.floor(Number(seconds) || 0)));
    setFeedbackMinutes(safeMinutes);
    setFeedbackSeconds(safeSeconds);
    setFeedbackTimestamp((safeMinutes * 60) + safeSeconds);
  };

  const handleCaptureCurrentTime = () => syncTimestampFields(currentTime);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersionId || !commentText.trim()) return;

    setSubmittingFeedback(true);
    setFeedbackError(null);

    try {
      const token = publicReviewToken ? null : await getAuthToken();
      if (!publicReviewToken && !token) throw new Error('Authentication required.');
      const feedbackEndpoint = publicReviewToken
        ? `/api/public-review/${projectId}/${selectedSongId}/feedback?token=${encodeURIComponent(publicReviewToken)}`
        : `/api/projects/${projectId}/feedback`;
      const res = await fetch(feedbackEndpoint, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          versionId: selectedVersionId,
          songId: selectedSongId,
          timestampSeconds: feedbackTimestamp,
          comment: commentText.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to submit feedback.');
      }

      const { feedback: newFb } = await res.json();
      setFeedbackList((prev) => [...prev, newFb].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setCommentText('');
    } catch (err: any) {
      setFeedbackError(err.message || 'Error saving feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const selectedSong = songs.find((s) => s.id === selectedSongId);
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;
  const changeCount = selectedVersion?.feedback_count || 0;
  const jumpToNextChange = () => {
    const next = feedbackList.find((fb) => Number(fb.timestamp_seconds) > currentTime && fb.status !== 'resolved');
    if (next) handleSeek(Number(next.timestamp_seconds));
  };
  const isSelectedLatest = selectedVersion?.id === latestVersion?.id;

  const canTakeReviewAction = projectStatus === 'in_review' && isSelectedLatest && !!selectedVersionId;

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!window.confirm('Remove this feedback? This cannot be undone.')) return;
    try {
      const token = publicReviewToken;
      if (!token || !selectedSongId) return;
      const response = await fetch(`/api/public-review/${projectId}/${selectedSongId}/feedback/${feedbackId}?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to remove feedback.');
      }
      setFeedbackList((items) => items.filter((item) => item.id !== feedbackId));
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : 'Failed to remove feedback.');
    }
  };

  const handleReviewAction = async (action: 'revision_requested' | 'mix_approved') => {
    if (!selectedVersionId || !canTakeReviewAction || reviewActionLoading) return;
    if (action === 'mix_approved' && openCount > 0) {
      setReviewActionError('Resolve all open feedback before approving the mix.');
      return;
    }
    setReviewActionLoading(true);
    setReviewActionError(null);
    try {
      if (publicReviewToken) {
        const res = await fetch(`/api/public-review/${projectId}/${selectedSongId}/action?token=${encodeURIComponent(publicReviewToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId: selectedVersionId, action }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Unable to update the review status.');
      } else {
        const sb = getSupabase();
        const { error } = await sb.rpc('client_review_action', {
          p_project_id: projectId,
          p_version_id: selectedVersionId,
          p_action: action,
          p_note: null,
        });
        if (error) throw error;
      }
      setProjectStatus(action === 'revision_requested' ? 'needs_revision' : 'approved');
      setReviewAction(action);
      setVersions(prev => prev.map(v => v.id === selectedVersionId
        ? { ...v, status: action === 'revision_requested' ? 'revision_requested' : 'approved' }
        : v
      ));
    } catch (err: any) {
      setReviewActionError(err.message || 'Unable to update the review status.');
    } finally {
      setReviewActionLoading(false);
    }
  };

  // Filter feedback
  const versionFeedback = feedbackList.filter((fb) => fb.version_id === selectedVersionId);

  const filteredFeedback = versionFeedback.filter((fb) => {
    if (feedbackFilter === 'open') return fb.status === 'open';
    if (feedbackFilter === 'resolved') return fb.status === 'resolved';
    return true;
  });

  const openCount = versionFeedback.filter((f) => f.status === 'open').length;
  const resolvedCount = versionFeedback.filter((f) => f.status === 'resolved').length;

  return (
    <div className="bg-[#080b10] border border-[#1c2430] rounded-[28px] p-3 sm:p-6 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {songs.find((song) => song.id === selectedSongId)?.title || 'Mix Review'}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Mix V{selectedVersion?.version_number || '—'} <span className="mx-1.5 text-zinc-700">•</span> {selectedVersion?.created_at ? new Date(selectedVersion.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : 'Review'}
          </p>
        </div>

        {/* Review status and sign-off actions */}
        <div className="bg-[#10141b] border border-[#202938] rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Project status</p>
              <p className="text-sm font-bold text-white mt-0.5">{projectStatus === 'in_review' ? 'Ready for your review' : projectStatus === 'needs_revision' ? 'Revision requested' : projectStatus === 'approved' ? 'Mix approved' : projectStatus || 'Loading status...'}</p>
            </div>
            {canTakeReviewAction && (
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={() => handleReviewAction('revision_requested')} disabled={reviewActionLoading} className="px-3 sm:px-4 py-2 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 disabled:opacity-50 text-orange-300 text-xs font-bold transition cursor-pointer">
                  {reviewActionLoading && reviewAction === 'revision_requested' ? 'Sending...' : 'Request Revision'}
                </button>
                <button type="button" onClick={() => handleReviewAction('mix_approved')} disabled={reviewActionLoading || openCount > 0} title={openCount > 0 ? 'Resolve all open feedback before approving' : 'Approve this mix as final'} className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-black text-xs font-bold transition cursor-pointer">
                  {reviewActionLoading && reviewAction === 'mix_approved' ? 'Approving...' : 'Approve Mix'}
                </button>
              </div>
            )}
          </div>
          {!isSelectedLatest && latestVersion && <p className="text-[11px] text-amber-300">Switch to the latest version before approving or requesting changes.</p>}
          {projectStatus === 'in_review' && openCount > 0 && <p className="text-[11px] text-zinc-500">Approve is locked until all open feedback on this version is resolved.</p>}
          {reviewActionError && <p className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl px-3 py-2">{reviewActionError}</p>}
          {reviewAction === 'revision_requested' && <p className="text-[11px] text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2">Revision requested. Your engineer has been notified.</p>}
          {reviewAction === 'mix_approved' && <p className="text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">Mix approved. The engineer can now prepare the final delivery.</p>}
        </div>

        {/* Song Selector */}
        {songs.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Song:</span>
            <select
              value={selectedSongId || ''}
              onChange={(e) => setSelectedSongId(e.target.value)}
              className="bg-[#171d27] border border-zinc-700 text-xs text-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {songs.map((s) => (
                <option key={s.id} value={s.id}>
                  Track {s.track_number}: {s.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Version Selector Tabs & History Toggle */}
      {versions.length === 0 ? (
        <div className="py-12 text-center space-y-2 border border-dashed border-zinc-800 rounded-2xl">
          <Layers size={24} className="text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400 font-medium">No audio review versions uploaded for this track yet.</p>
          <p className="text-[11px] text-zinc-500">Your audio engineer will upload mix passes here for your review.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Version History */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1.5 bg-[#171d27] hover:bg-[#171d27] text-zinc-300 border border-zinc-700/60 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition shrink-0"
            >
              <History size={13} className="text-zinc-400" />
              <span>Version History ({versions.length})</span>
              {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Historical Version Notice */}
          {!isSelectedLatest && latestVersion && (
            <div className="bg-amber-950/40 border border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-300">
                <Info size={16} className="shrink-0 text-amber-400" />
                <span>
                  You are currently reviewing <strong>V{selectedVersion?.version_number}</strong> (earlier pass). A newer mix revision (<strong>V{latestVersion.version_number}</strong>) is available.
                </span>
              </div>
              <button
                onClick={() => setSelectedVersionId(latestVersion.id)}
                className="px-3 py-1.5 bg-amber-500 text-black font-bold text-xs rounded-xl hover:bg-amber-400 transition cursor-pointer shrink-0"
              >
                Switch to Latest V{latestVersion.version_number}
              </button>
            </div>
          )}

          {/* Version History Table / Drawer */}
          {showHistory && (
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-[22px] p-4 sm:p-4 sm:p-5 space-y-4 shadow-inner">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <History size={15} className="text-blue-400" />
                  <span>Mix Version History & Revision Log</span>
                </h3>
                <span className="text-[11px] text-zinc-500">All passes are securely archived</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-zinc-400 border-b border-zinc-800/60 pb-2">
                      <th className="py-2 font-medium">Version</th>
                      <th className="py-2 font-medium">Mix File</th>
                      <th className="py-2 font-medium">Engineer</th>
                      <th className="py-2 font-medium">Uploaded</th>
                      <th className="py-2 font-medium">Size</th>
                      <th className="py-2 font-medium">Feedback Notes</th>
                      <th className="py-2 font-medium text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {versions.map((ver) => {
                      const isCurrent = ver.id === selectedVersionId;
                      const isLatest = ver.id === latestVersion?.id;
                      return (
                        <tr key={ver.id} className={`hover:bg-zinc-900/40 transition ${isCurrent ? 'bg-zinc-900/30' : ''}`}>
                          <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                            <span>V{ver.version_number}</span>
                            {isLatest && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/30">
                                LATEST
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-zinc-300 font-mono text-[11px] max-w-xs truncate">
                            {ver.name}
                          </td>
                          <td className="py-2.5 text-zinc-400">
                            {ver.uploader_name || 'Studio Engineer'}
                          </td>
                          <td className="py-2.5 text-zinc-400 font-mono text-[11px]">
                            {new Date(ver.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-2.5 text-zinc-400 font-mono text-[11px]">
                            {formatFileSize(ver.file_size)}
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1 text-[11px] font-mono">
                              <span className="text-zinc-300 font-semibold">{ver.feedback_count || 0}</span>
                              <span className="text-zinc-500">
                                ({ver.open_feedback_count || 0} open, {ver.resolved_feedback_count || 0} resolved)
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => setSelectedVersionId(ver.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                                isCurrent
                                  ? 'bg-blue-500 text-black font-semibold'
                                  : 'bg-[#171d27] hover:bg-zinc-700 text-zinc-300'
                              }`}
                            >
                              {isCurrent ? 'Listening' : 'Listen'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Clean version switcher */}
          <div className="bg-[#111720] border border-[#222b38] rounded-[20px] p-1.5 shadow-inner">
            <div className="flex items-stretch overflow-x-auto">
              {versions.map((ver) => {
                const isSelected = ver.id === selectedVersionId;
                const isLatest = ver.id === latestVersion?.id;
                return (
                  <button
                    key={ver.id}
                    type="button"
                    onClick={() => setSelectedVersionId(ver.id)}
                    className={`flex-1 min-w-[92px] px-4 py-2.5 rounded-xl transition cursor-pointer text-center ${isSelected ? 'bg-[#4f7cff] text-white shadow-lg shadow-blue-500/20' : 'text-zinc-400 hover:text-white hover:bg-[#171d27]'}`}
                  >
                    <div className="text-xs font-extrabold">V{ver.version_number}</div>
                    <div className={`text-[9px] mt-0.5 font-medium ${isSelected ? 'text-white/75' : 'text-zinc-600'}`}>
                      {isSelected ? 'Current' : (isLatest ? 'Latest' : ver.version_number === 1 ? 'Previous' : 'Previous')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Player Card */}
          <div className="bg-[#10141b] border border-[#202938] rounded-2xl p-5 space-y-4 shadow-inner">
            <audio
              ref={audioRef}
              src={playbackUrl || undefined}
              onTimeUpdate={() => {
                if (audioRef.current) {
                  setCurrentTime(audioRef.current.currentTime);
                }
              }}
              onLoadedMetadata={() => {
                if (audioRef.current) {
                  setDuration(audioRef.current.duration);
                }
              }}
              onEnded={() => setIsPlaying(false)}

            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white truncate">
                    {selectedVersion?.name || 'Audio Track'}
                  </p>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                    isSelectedLatest
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      : 'bg-[#171d27] text-zinc-400 border border-zinc-700'
                  }`}>
                    {isSelectedLatest ? 'Latest Version' : `Version ${selectedVersion?.version_number}`}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  V{selectedVersion?.version_number}
                  {selectedVersion?.notes && <span className="text-zinc-400 ml-2">“{selectedVersion.notes}”</span>}
                </p>
              </div>

              {/* Player Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSeek(0)}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-[#171d27] text-zinc-400 hover:text-white transition cursor-pointer border border-zinc-800"
                  title="Rewind to start"
                >
                  <RotateCcw size={14} />
                </button>

                <button
                  onClick={handlePlayPause}
                  disabled={loadingAudio || !playbackUrl}
                  className="px-4 py-2 rounded-xl bg-[#4f7cff] hover:bg-[#5c86ff] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-blue-500/20 rounded-full cursor-pointer"
                >
                  {loadingAudio ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : isPlaying ? (
                    <>
                      <Pause size={14} />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      <span>Play</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.muted = !isMuted;
                      setIsMuted(!isMuted);
                    }
                  }}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-[#171d27] text-zinc-400 hover:text-white transition cursor-pointer border border-zinc-800"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
            </div>

            {/* Interactive waveform timeline with timestamped feedback markers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-500"><span className="font-medium text-zinc-300">Track timeline</span><span>Tap waveform to jump</span></div>
              <div role="slider" aria-label="Audio timeline" aria-valuemin={0} aria-valuemax={duration || 0} aria-valuenow={currentTime} aria-valuetext={formatTime(currentTime) + ' of ' + formatTime(duration)} tabIndex={0}
                onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); if (duration > 0 && rect.width > 0) handleSeek(Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration))); }}
                onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); handleSeek(Math.min(duration, currentTime + 5)); } if (e.key === 'ArrowLeft') { e.preventDefault(); handleSeek(Math.max(0, currentTime - 5)); } if (e.key === 'Home') { e.preventDefault(); handleSeek(0); } if (e.key === 'End') { e.preventDefault(); handleSeek(duration); } }}
                className="relative flex h-20 sm:h-28 items-center gap-px overflow-hidden rounded-xl border border-zinc-800 bg-[#111720] px-2 sm:px-3 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                {Array.from({ length: 64 }, (_, index) => { const height = 16 + Math.abs(Math.sin(index * 12.9898) * Math.cos(index * 0.37)) * 76; const played = duration > 0 && index <= (currentTime / duration) * 63; return <div key={index} className={`flex-1 rounded-full ${played ? 'bg-[#4f7cff]' : 'bg-[#343b49]'}`} style={{ height: `${height}%`, minWidth: '1px' }} />; })}
                {duration > 0 && feedbackList.map((item) => <button key={item.id} type="button" title={`Feedback at ${formatTime(Number(item.timestamp_seconds))}`} onClick={(e) => { e.stopPropagation(); handleSeek(Number(item.timestamp_seconds)); }} className={`absolute bottom-1 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-zinc-950 ${item.status === 'resolved' ? 'bg-[#8b93a3]' : 'bg-[#4f7cff]'}`} style={{ left: `${(Number(item.timestamp_seconds) / duration) * 100}%` }} />)}
                <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] pointer-events-none" style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-zinc-500"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
            </div>
            {/* Compact review context under the waveform */}
            <div className="space-y-3">
              {versionFeedback.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {versionFeedback.slice().sort((a, b) => Number(a.timestamp_seconds) - Number(b.timestamp_seconds)).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSeek(Number(item.timestamp_seconds))}
                      className="shrink-0 min-w-[132px] rounded-[14px] border border-[#202938] bg-[#111720] px-3 py-2.5 text-left hover:border-zinc-700 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-blue-400">
                        <span>{formatTime(Number(item.timestamp_seconds))}</span>
                        <span className="text-zinc-700">•</span>
                        <span className="text-zinc-500 truncate">{item.author_name}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-300 truncate">{item.comment}</div>
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-[14px] border border-[#202938] bg-[#0d1118] px-3.5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-blue-400">Changes in V{selectedVersion?.version_number}</span>
                  {selectedVersion?.id === latestVersion?.id && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">Latest</span>}
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">{selectedVersion?.notes?.trim() || 'No change notes were added for this version.'}</p>
              </div>
            </div>
            {audioError && (
              <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-xl border border-red-900/50">
                {audioError}
              </p>
            )}
          </div>

          {/* Feedback Section */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div><h3 className="text-xl sm:text-[21px] font-bold text-white">Feedback & Comments</h3><p className="text-xs text-zinc-500 mt-1">Each note is pinned to a moment in the audio.</p></div>
              <button type="button" onClick={() => { syncTimestampFields(currentTime); setShowFeedbackForm((open) => !open); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-transparent px-2 py-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"><MessageSquarePlus size={14} /> {showFeedbackForm ? 'Cancel comment' : '+ Add comment'}</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Feedback Input Form */}
            {showFeedbackForm && <div className="lg:col-span-5 bg-[#0d1118] border border-[#1c2430] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MessageSquarePlus size={14} className="text-blue-400" />
                  <span>Leave Note on Mix v{selectedVersion?.version_number}</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCaptureCurrentTime}
                  className="text-[10px] font-mono text-blue-400 hover:underline cursor-pointer"
                  title="Set timestamp to current playback position"
                >
                  Sync to Player ({formatTime(currentTime)})
                </button>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-medium">Timestamp:</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="1" value={feedbackMinutes} onChange={(e) => updateTimestampFields(Number(e.target.value), feedbackSeconds)} className="w-16 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-white text-center focus:outline-none focus:border-blue-500" aria-label="Minutes" />
                    <span className="text-[10px] text-zinc-500">min</span>
                    <input type="number" min="0" max="59" step="1" value={feedbackSeconds} onChange={(e) => updateTimestampFields(feedbackMinutes, Number(e.target.value))} className="w-16 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-white text-center focus:outline-none focus:border-blue-500" aria-label="Seconds" />
                    <span className="text-[10px] text-zinc-500">sec</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-medium">Your Note / Feedback:</label>
                  <textarea
                    rows={3}
                    value={commentText}
                    onChange={(e) => {
                      setCommentText(e.target.value);
                      if (feedbackTimestamp === 0 && currentTime > 0) {
                        syncTimestampFields(currentTime);
                      }
                    }}
                    placeholder="e.g. Vocal feels slightly buried behind the lead guitar here..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition resize-none"
                  />
                </div>

                {feedbackError && (
                  <p className="text-[11px] text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-900/50">
                    {feedbackError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submittingFeedback || !commentText.trim()}
                  className="w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
                >
                  {submittingFeedback ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving Note...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Post Note on V{selectedVersion?.version_number}</span>
                    </>
                  )}
                </button>
              </form>
            </div>}

            {/* Version Feedback List */}
            <div className={`${showFeedbackForm ? 'lg:col-span-7' : 'lg:col-span-12'} bg-[#0d1118] border border-[#1c2430] rounded-2xl p-4 sm:p-5 space-y-3`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/60">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock size={14} className="text-zinc-400" />
                  <span>Notes on V{selectedVersion?.version_number}</span>
                </h3>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[11px]">
                  <button
                    onClick={() => setFeedbackFilter('all')}
                    className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                      feedbackFilter === 'all'
                        ? 'bg-[#171d27] text-white font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    All ({feedbackList.length})
                  </button>
                  <button
                    onClick={() => setFeedbackFilter('open')}
                    className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                      feedbackFilter === 'open'
                        ? 'bg-blue-500 text-black font-bold'
                        : 'text-blue-400 hover:text-blue-300'
                    }`}
                  >
                    Open ({openCount})
                  </button>
                  <button
                    onClick={() => setFeedbackFilter('resolved')}
                    className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                      feedbackFilter === 'resolved'
                        ? 'bg-[#171d27] text-white font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Resolved ({resolvedCount})
                  </button>
                </div>
              </div>

              {feedbackList.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800/80 rounded-xl">
                  No notes on this version yet. Play the audio and submit your feedback!
                </div>
              ) : filteredFeedback.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800/80 rounded-xl">
                  No {feedbackFilter} notes on this version.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {filteredFeedback.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#111720] border border-zinc-800/70 rounded-xl p-3 text-xs space-y-1.5 hover:border-zinc-700 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSeek(Number(item.timestamp_seconds))}
                            className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[11px] font-semibold hover:bg-blue-500/20 transition cursor-pointer flex items-center gap-1"
                            title="Jump audio player to this timestamp"
                          >
                            <Play size={10} />
                            <span>{formatTime(Number(item.timestamp_seconds))}</span>
                          </button>
                          <span className="font-semibold text-zinc-200">{item.author_name}</span>
                        </div>

                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-semibold flex items-center gap-1 ${
                            item.status === 'resolved'
                              ? 'bg-[#171d27] text-zinc-400 border border-zinc-700'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {item.status === 'resolved' && <CheckCircle2 size={10} />}
                          <span>{item.status}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(item.id)}
                          className="text-[10px] text-zinc-500 hover:text-red-400 transition cursor-pointer"
                          title="Remove this feedback"
                        >
                          Remove
                        </button>
                      </div>

                      <p className="text-zinc-300 leading-relaxed text-xs">{item.comment}</p>

                      {item.status === 'resolved' && item.resolved_at && (
                        <p className="text-[10px] text-zinc-500 font-mono">
                          Resolved on {new Date(item.resolved_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Client sign-off actions */}
          {canTakeReviewAction && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleReviewAction('revision_requested')}
                disabled={reviewActionLoading}
                className="flex-1 rounded-full border border-[#2a3342] bg-[#151b24] px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-[#1b2330] disabled:opacity-50 transition cursor-pointer"
              >
                {reviewActionLoading && reviewAction === 'revision_requested' ? 'Sending...' : 'Request Revision'}
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction('mix_approved')}
                disabled={reviewActionLoading || openCount > 0}
                className="flex-1 rounded-full bg-[#4f7cff] hover:bg-[#5c86ff] px-5 py-3 text-sm font-bold text-white disabled:opacity-50 transition cursor-pointer shadow-lg shadow-blue-500/20"
              >
                {reviewActionLoading && reviewAction === 'mix_approved' ? 'Approving...' : 'Approve Mix'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};