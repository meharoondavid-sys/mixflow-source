import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Plus, 
  Upload, 
  Music, 
  Layers, 
  Loader2, 
  AlertCircle,
  Check,
  RotateCcw,
  History,
  FileAudio,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { ProjectFileVersionRecord, ProjectFeedbackRecord } from '../../types/versionFeedback';
import { getSupabase } from '../../lib/supabase';

interface ProjectFeedbackTabProps {
  projectId: string;
  songs: Array<{ id: string; title: string; track_number: number }>;
}

export const ProjectFeedbackTab: React.FC<ProjectFeedbackTabProps> = ({ projectId, songs }) => {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(songs[0]?.id || null);
  const [versions, setVersions] = useState<ProjectFileVersionRecord[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [feedbackList, setFeedbackList] = useState<ProjectFeedbackRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Audio Playback
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // New Version Upload Modal State
  const [isUploadingVersion, setIsUploadingVersion] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const getAuthToken = async () => {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    return data.session?.access_token || null;
  };

  const loadVersions = async () => {
    try {
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
      const vList: ProjectFileVersionRecord[] = data.versions || [];
      setVersions(vList);
      
      // Auto-select latest version if none selected or if switching tracks
      if (vList.length > 0) {
        const latest = vList[vList.length - 1];
        if (!selectedVersionId || !vList.some(v => v.id === selectedVersionId)) {
          setSelectedVersionId(latest.id);
        }
      } else {
        setSelectedVersionId(null);
      }
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [projectId, selectedSongId]);

  useEffect(() => {
    if (!selectedVersionId) {
      setFeedbackList([]);
      setPlaybackUrl(null);
      return;
    }

    let isCancelled = false;

    const loadFeedback = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;

        const res = await fetch(`/api/projects/${projectId}/feedback?versionId=${selectedVersionId}`, {
          headers: { Authorization: `Bearer ${token}` },
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
      try {
        const token = await getAuthToken();
        if (!token) return;

        const res = await fetch(`/api/projects/${projectId}/versions/${selectedVersionId}/playback-url`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok && !isCancelled) {
          const data = await res.json();
          setPlaybackUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Playback URL error:', err);
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
  }, [projectId, selectedVersionId]);

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
  };

  const handleToggleStatus = async (feedbackId: string, currentStatus: string) => {
    setTogglingId(feedbackId);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const nextStatus = currentStatus === 'open' ? 'resolved' : 'open';
      const res = await fetch(`/api/projects/${projectId}/feedback/${feedbackId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        const { feedback: updated } = await res.json();
        setFeedbackList((prev) =>
          prev.map((item) => (item.id === feedbackId ? { ...item, status: updated.status, resolved_at: updated.resolved_at, resolved_by: updated.resolved_by } : item))
        );
        // Refresh version counts
        await loadVersions();
      }
    } catch (err) {
      console.error('Toggle status error:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleUploadNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required.');

      // 1. Request signed upload URL
      const reqRes = await fetch(`/api/projects/${projectId}/versions/upload-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          songId: selectedSongId,
          fileName: uploadFile.name,
          fileType: uploadFile.type || 'audio/wav',
          fileSize: uploadFile.size,
          notes: versionNotes.trim() || undefined,
        }),
      });

      if (!reqRes.ok) {
        const err = await reqRes.json();
        throw new Error(err.error || 'Failed to request upload URL.');
      }

      const { versionId, storagePath, signedUrl } = await reqRes.json();

      // 2. Upload file binary directly to signed URL
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadFile.type || 'audio/wav' },
        body: uploadFile,
      });

      if (!uploadRes.ok) {
        throw new Error('Storage upload failed.');
      }

      // 3. Confirm version upload
      const confirmRes = await fetch(`/api/projects/${projectId}/versions/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          versionId,
          songId: selectedSongId,
          fileName: uploadFile.name,
          storagePath,
          fileType: uploadFile.type || 'audio/wav',
          fileSize: uploadFile.size,
          notes: versionNotes.trim() || undefined,
        }),
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json();
        throw new Error(err.error || 'Failed to confirm version.');
      }

      const { version: newVersion } = await confirmRes.json();
      setVersions((prev) => [...prev, newVersion]);
      setSelectedVersionId(newVersion.id);
      setIsUploadingVersion(false);
      setUploadFile(null);
      setVersionNotes('');
      // Reload versions to get full latest flags and counts
      await loadVersions();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const selectedSong = songs.find((s) => s.id === selectedSongId);
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;
  const isSelectedLatest = selectedVersion?.id === latestVersion?.id;
  const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

  // Filtered feedback
  const filteredFeedback = feedbackList.filter((fb) => {
    if (feedbackFilter === 'open') return fb.status === 'open';
    if (feedbackFilter === 'resolved') return fb.status === 'resolved';
    return true;
  });

  const openCount = feedbackList.filter((f) => f.status === 'open').length;
  const resolvedCount = feedbackList.filter((f) => f.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-emerald-400" />
            <span>Mix Revision Workflow & Client Feedback</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Review client feedback per mix pass, resolve notes, and upload immutable revision passes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {songs.length > 1 && (
            <select
              value={selectedSongId || ''}
              onChange={(e) => {
                setSelectedSongId(e.target.value);
                setSelectedVersionId(null);
              }}
              className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {songs.map((s) => (
                <option key={s.id} value={s.id}>
                  Track {s.track_number}: {s.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsUploadingVersion(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
          >
            <Plus size={14} />
            <span>Upload Mix v{nextVersionNumber}</span>
          </button>
        </div>
      </div>

      {/* Revision Context Banner */}
      <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-900 rounded-xl border border-zinc-800 text-emerald-400">
            <Music size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">
                {selectedSong ? `Track ${selectedSong.track_number}: ${selectedSong.title}` : 'Project Track'}
              </span>
              {selectedVersion && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                    isSelectedLatest
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isSelectedLatest ? 'Latest Mix Pass' : 'Historical Mix Pass'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Reviewing <strong className="text-zinc-200">Mix v{selectedVersion?.version_number || 1}</strong> • {openCount} open feedback {openCount === 1 ? 'item' : 'items'} to address
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isSelectedLatest && latestVersion && (
            <button
              onClick={() => setSelectedVersionId(latestVersion.id)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium cursor-pointer transition"
            >
              Switch to Latest (v{latestVersion.version_number})
            </button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
          >
            <History size={13} className="text-zinc-400" />
            <span>Version History ({versions.length})</span>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Version History Table / Drawer */}
      {showHistory && (
        <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <History size={15} className="text-emerald-400" />
              <span>Version History & Revision Timeline</span>
            </h3>
            <span className="text-[11px] text-zinc-500">Derived authoritatively from database</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800/60 pb-2">
                  <th className="py-2 font-medium">Pass</th>
                  <th className="py-2 font-medium">File Name</th>
                  <th className="py-2 font-medium">Uploaded By</th>
                  <th className="py-2 font-medium">Uploaded At</th>
                  <th className="py-2 font-medium">Size</th>
                  <th className="py-2 font-medium">Feedback Notes</th>
                  <th className="py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {versions.map((ver) => {
                  const isCurrent = ver.id === selectedVersionId;
                  const isLatest = ver.id === latestVersion?.id;
                  return (
                    <tr key={ver.id} className={`hover:bg-zinc-900/40 transition ${isCurrent ? 'bg-zinc-900/30' : ''}`}>
                      <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                        <span>v{ver.version_number}</span>
                        {isLatest && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30">
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
                              ? 'bg-emerald-500 text-black font-semibold'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {isCurrent ? 'Reviewing' : 'Review'}
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

      {/* Version Tabs Bar */}
      {versions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-zinc-400 font-medium shrink-0">Select Mix Pass:</span>
          {versions.map((ver) => {
            const isSelected = ver.id === selectedVersionId;
            const isLatest = ver.id === latestVersion?.id;
            return (
              <button
                key={ver.id}
                onClick={() => setSelectedVersionId(ver.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                }`}
              >
                <span>Mix v{ver.version_number}</span>
                {isLatest && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${isSelected ? 'bg-black/20 text-black' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    Latest
                  </span>
                )}
                {ver.feedback_count ? (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {ver.feedback_count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Audio Player Strip */}
      {playbackUrl && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <audio
            ref={audioRef}
            src={playbackUrl}
            onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
            onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
            onEnded={() => setIsPlaying(false)}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!audioRef.current) return;
                if (isPlaying) {
                  audioRef.current.pause();
                  setIsPlaying(false);
                } else {
                  audioRef.current.play().then(() => setIsPlaying(true));
                }
              }}
              className="p-2.5 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition cursor-pointer"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <div>
              <p className="text-xs font-bold text-white">Mix v{selectedVersion?.version_number}: {selectedVersion?.name}</p>
              <p className="text-[11px] font-mono text-zinc-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-md">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (audioRef.current) audioRef.current.currentTime = val;
                setCurrentTime(val);
              }}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Feedback Section with Filters and Resolution Controls */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Clock size={14} className="text-zinc-400" />
              <span>Client Feedback Notes for Mix v{selectedVersion?.version_number || 1}</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Permanently attached to this immutable mix version.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setFeedbackFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                feedbackFilter === 'all'
                  ? 'bg-zinc-800 text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({feedbackList.length})
            </button>
            <button
              onClick={() => setFeedbackFilter('open')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                feedbackFilter === 'open'
                  ? 'bg-emerald-500 text-black font-bold'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <span>Open ({openCount})</span>
            </button>
            <button
              onClick={() => setFeedbackFilter('resolved')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                feedbackFilter === 'resolved'
                  ? 'bg-zinc-800 text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        </div>

        {feedbackList.length === 0 ? (
          <div className="py-10 text-center space-y-1.5 border border-dashed border-zinc-800 rounded-xl">
            <MessageSquare size={20} className="text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400 font-medium">No client feedback on Mix v{selectedVersion?.version_number || 1} yet.</p>
            <p className="text-[11px] text-zinc-500">When the client listens in their portal and leaves notes, they will appear here.</p>
          </div>
        ) : filteredFeedback.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            No {feedbackFilter} feedback items on this version.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFeedback.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 text-xs space-y-2 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = Number(item.timestamp_seconds);
                          setCurrentTime(Number(item.timestamp_seconds));
                          audioRef.current.play().then(() => setIsPlaying(true));
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-semibold hover:bg-emerald-500/20 transition cursor-pointer flex items-center gap-1"
                      title="Seek audio to this timestamp"
                    >
                      <Play size={10} />
                      <span>{formatTime(Number(item.timestamp_seconds))}</span>
                    </button>
                    <span className="font-semibold text-zinc-200">{item.author_name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-zinc-300 leading-relaxed text-xs">{item.comment}</p>

                  {item.status === 'resolved' && item.resolved_at && (
                    <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-emerald-400" />
                      <span>Resolved on {new Date(item.resolved_at).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>

                {/* Status Toggle Button */}
                <button
                  onClick={() => handleToggleStatus(item.id, item.status)}
                  disabled={togglingId === item.id}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                    item.status === 'resolved'
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {togglingId === item.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : item.status === 'resolved' ? (
                    <>
                      <RotateCcw size={12} />
                      <span>Reopen Note</span>
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      <span>Mark Resolved</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload New Version Modal with Revision Context */}
      {isUploadingVersion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload size={18} className="text-emerald-400" />
                  <span>Upload Revision: Mix v{nextVersionNumber}</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Addressing feedback for <strong className="text-zinc-200">{selectedSong?.title || 'Selected Track'}</strong>.
                </p>
              </div>
            </div>

            {/* Context of version being revised */}
            {selectedVersion && (
              <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                  <span>Current Pass: Mix v{selectedVersion.version_number}</span>
                  <span>{openCount} Open Notes</span>
                </div>
                <div className="text-[11px] text-zinc-300">
                  {openCount > 0 ? (
                    <p className="text-amber-400 font-medium">
                      ⚠️ Note: Uploading Mix v{nextVersionNumber} will not auto-resolve notes. Feedback remains anchored to Mix v{selectedVersion.version_number}.
                    </p>
                  ) : (
                    <p className="text-emerald-400 font-medium">
                      ✓ All client feedback on Mix v{selectedVersion.version_number} is currently marked resolved.
                    </p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleUploadNewVersion} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Audio File (WAV, MP3, AIFF):</label>
                <input
                  type="file"
                  accept="audio/*,.wav,.mp3,.aif,.aiff"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-emerald-400 hover:file:bg-zinc-700 cursor-pointer"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Revision Notes (Visible to Client):</label>
                <textarea
                  rows={2}
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="e.g. Addressed vocal reverb, tightened 808 sub bass, and adjusted chorus automation."
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {uploadError && (
                <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-xl border border-red-900/50">
                  {uploadError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadingVersion(false)}
                  disabled={uploading}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-xl text-zinc-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Creating Mix v{nextVersionNumber}...</span>
                    </>
                  ) : (
                    <span>Create Mix v{nextVersionNumber}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
