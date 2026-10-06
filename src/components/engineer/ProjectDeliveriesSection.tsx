import React, { useState, useEffect } from 'react';
import { 
  PackageCheck, 
  Plus, 
  Download, 
  CheckCircle2, 
  Clock, 
  Music, 
  Layers, 
  AlertCircle, 
  Loader2, 
  X,
  FileCheck,
  Disc3,
  Calendar,
  User,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useProjectDeliveries } from '../../hooks/useProjectDeliveries';
import { DeliverableType, ProjectDeliveryRecord } from '../../types/delivery';
import { ProjectFileVersionRecord } from '../../types/versionFeedback';
import { getSupabase } from '../../lib/supabase';

interface ProjectDeliveriesSectionProps {
  projectId: string;
  projectName: string;
  songs: Array<{ id: string; title: string; track_number: number }>;
}

const TYPE_CONFIG: Record<DeliverableType, { label: string; color: string; bg: string; border: string }> = {
  master: { label: 'Final Master', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  instrumental: { label: 'Instrumental', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  stems: { label: 'Stems Package', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  other: { label: 'Deliverable', color: 'text-zinc-300', bg: 'bg-zinc-800', border: 'border-zinc-700' },
};

export const ProjectDeliveriesSection: React.FC<ProjectDeliveriesSectionProps> = ({
  projectId,
  projectName,
  songs,
}) => {
  const {
    deliveries,
    loading,
    error,
    releasing,
    releaseError,
    downloadingId,
    canReleaseDelivery,
    releaseDelivery,
    getDownloadUrl,
  } = useProjectDeliveries(projectId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(songs[0]?.id || null);
  const [availableVersions, setAvailableVersions] = useState<ProjectFileVersionRecord[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [deliverableType, setDeliverableType] = useState<DeliverableType>('master');
  const [deliverableName, setDeliverableName] = useState<string>('');
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch versions when modal opens or song changes
  useEffect(() => {
    if (!isModalOpen) return;

    let isMounted = true;
    const fetchVersions = async () => {
      setLoadingVersions(true);
      try {
        const sb = getSupabase();
        const { data } = await sb.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const url = selectedSongId
          ? `/api/projects/${projectId}/versions?songId=${selectedSongId}`
          : `/api/projects/${projectId}/versions`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;
        const resData = await res.json();
        if (isMounted) {
          const vList: ProjectFileVersionRecord[] = resData.versions || [];
          setAvailableVersions(vList);
          if (vList.length > 0) {
            // Pick latest version by default
            const latest = vList[vList.length - 1];
            setSelectedVersionId(latest.id);
            setDeliverableName(`${projectName} - Final Master (v${latest.version_number})`);
          } else {
            setSelectedVersionId('');
            setDeliverableName('');
          }
        }
      } catch (e) {
        console.error('Failed to load candidate versions:', e);
      } finally {
        if (isMounted) setLoadingVersions(false);
      }
    };

    fetchVersions();
    return () => {
      isMounted = false;
    };
  }, [isModalOpen, projectId, selectedSongId, projectName]);

  const selectedVersion = availableVersions.find((v) => v.id === selectedVersionId);
  const hasOpenFeedback = Boolean(selectedVersion && (selectedVersion.open_feedback_count || 0) > 0);

  const handleOpenModal = () => {
    setFormError(null);
    setConfirmed(false);
    setSelectedSongId(songs[0]?.id || null);
    setDeliverableType('master');
    setIsModalOpen(true);
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    const ver = availableVersions.find((v) => v.id === versionId);
    if (ver) {
      const typeLabel = TYPE_CONFIG[deliverableType]?.label || 'Deliverable';
      setDeliverableName(`${projectName} - ${typeLabel} (v${ver.version_number})`);
    }
  };

  const handleTypeChange = (t: DeliverableType) => {
    setDeliverableType(t);
    if (selectedVersion) {
      const typeLabel = TYPE_CONFIG[t]?.label || 'Deliverable';
      setDeliverableName(`${projectName} - ${typeLabel} (v${selectedVersion.version_number})`);
    }
  };

  const handleReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedVersionId) {
      setFormError('Please select a mix version to release as the deliverable.');
      return;
    }

    if (!deliverableName.trim()) {
      setFormError('Deliverable name is required.');
      return;
    }

    if (hasOpenFeedback) {
      setFormError(
        `Cannot release Version ${selectedVersion?.version_number}: it has ${selectedVersion?.open_feedback_count} open revision request(s). Please resolve all feedback before releasing as final.`
      );
      return;
    }

    if (!confirmed) {
      setFormError('Please check the confirmation box to confirm this release.');
      return;
    }

    const res = await releaseDelivery({
      version_id: selectedVersionId,
      deliverable_type: deliverableType,
      name: deliverableName.trim(),
      song_id: selectedSongId || undefined,
    });

    if (res.success) {
      setIsModalOpen(false);
    } else {
      setFormError(res.error || 'Failed to release deliverable.');
    }
  };

  const handleDownload = async (deliveryId: string) => {
    const result = await getDownloadUrl(deliveryId);
    if (result?.downloadUrl) {
      window.open(result.downloadUrl, '_blank');
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <section className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10">
            <PackageCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Final Delivery</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                {deliveries.length} {deliveries.length === 1 ? 'Release' : 'Releases'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Release approved mix versions as official client deliverables for secure high-res download
            </p>
          </div>
        </div>

        {canReleaseDelivery && (
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer shrink-0"
          >
            <Plus size={15} />
            <span>Release Final Deliverable</span>
          </button>
        )}
      </div>

      {/* Deliverables List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-zinc-500 gap-3 border border-dashed border-zinc-800/80 rounded-2xl">
          <Disc3 size={24} className="animate-spin-slow text-emerald-400" />
          <span className="text-xs font-mono">Loading final deliverables...</span>
        </div>
      ) : deliveries.length === 0 ? (
        <div className="py-12 text-center text-xs text-zinc-400 border border-dashed border-zinc-800/80 rounded-2xl space-y-3 bg-zinc-950/20 p-6">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center text-zinc-500 mx-auto">
            <FileCheck size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-200">No Final Deliverables Released Yet</h3>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-md mx-auto">
              When a mix version is approved and ready, release it as a final deliverable to allow the client to download official master files.
            </p>
          </div>
          {canReleaseDelivery && (
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition cursor-pointer"
            >
              <Plus size={13} />
              <span>Release First Deliverable</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/60 rounded-2xl border border-zinc-800/60 overflow-hidden bg-zinc-950/40">
          {deliveries.map((delivery) => {
            const typeInfo = TYPE_CONFIG[delivery.deliverable_type] || TYPE_CONFIG.other;
            const isDelivered = delivery.status === 'delivered';

            return (
              <div
                key={delivery.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/30 transition-colors"
              >
                {/* Left: Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${typeInfo.bg} ${typeInfo.color} ${typeInfo.border}`}
                    >
                      {typeInfo.label}
                    </span>
                    {delivery.version_number && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                        Version {delivery.version_number}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${
                        isDelivered
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {isDelivered ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      <span>{isDelivered ? 'Downloaded by Client' : 'Ready for Download'}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white truncate">{delivery.name}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400 font-mono">
                    {delivery.released_at && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-zinc-500" />
                        <span>Released: {formatDate(delivery.released_at)}</span>
                      </span>
                    )}
                    {delivery.released_by_name && (
                      <span className="flex items-center gap-1">
                        <User size={11} className="text-zinc-500" />
                        <span>By: {delivery.released_by_name}</span>
                      </span>
                    )}
                    {delivery.file_size ? (
                      <span>Size: {(delivery.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                    ) : null}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(delivery.id)}
                    disabled={downloadingId === delivery.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                    title="Download master file via secure signed URL"
                  >
                    {downloadingId === delivery.id ? (
                      <Loader2 size={13} className="animate-spin text-emerald-400" />
                    ) : (
                      <Download size={13} className="text-emerald-400" />
                    )}
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Release Final Deliverable Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <PackageCheck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Release Final Deliverable</h3>
                  <p className="text-[11px] text-zinc-500">Designate an approved mix version as the official master file</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleReleaseSubmit} className="space-y-4 text-xs">
              {/* Error Banner */}
              {(formError || releaseError) && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{formError || releaseError}</span>
                </div>
              )}

              {/* Song Selection (if project has songs) */}
              {songs.length > 0 && (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Target Song / Track</label>
                  <select
                    value={selectedSongId || ''}
                    onChange={(e) => setSelectedSongId(e.target.value || null)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    {songs.map((song) => (
                      <option key={song.id} value={song.id}>
                        Track {song.track_number}: {song.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Version Selection */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Approved Mix Version to Release *
                </label>
                {loadingVersions ? (
                  <div className="py-2.5 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-500 font-mono text-[11px] flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-emerald-400" />
                    <span>Loading available versions...</span>
                  </div>
                ) : availableVersions.length === 0 ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                    <span>No audio versions exist for this selection yet. Please upload a mix version first.</span>
                  </div>
                ) : (
                  <select
                    value={selectedVersionId}
                    onChange={(e) => handleVersionChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    {availableVersions.map((ver) => (
                      <option key={ver.id} value={ver.id}>
                        Version {ver.version_number} — {ver.name} ({ver.file_type || 'audio'}, {(ver.file_size / (1024 * 1024)).toFixed(1)} MB)
                        {(ver.open_feedback_count || 0) > 0 ? ` [⚠️ ${ver.open_feedback_count} OPEN FEEDBACK]` : ' [READY]'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Unresolved Feedback Warning */}
              {hasOpenFeedback && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <span className="font-bold block">Unresolved Feedback Notice:</span>
                    <span>
                      This version has {selectedVersion?.open_feedback_count} open revision request(s). The system requires all feedback to be resolved or acknowledged before releasing as a final master.
                    </span>
                  </div>
                </div>
              )}

              {/* Deliverable Type */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Deliverable Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['master', 'instrumental', 'stems', 'other'] as DeliverableType[]).map((type) => {
                    const cfg = TYPE_CONFIG[type];
                    const isSelected = deliverableType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleTypeChange(type)}
                        className={`py-2 px-2.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer text-center ${
                          isSelected
                            ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-1 ring-emerald-500/30`
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Deliverable Name */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Deliverable Display Name *</label>
                <input
                  type="text"
                  required
                  value={deliverableName}
                  onChange={(e) => setDeliverableName(e.target.value)}
                  placeholder="e.g. Electric Horizon - Final Master 24-bit"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Explicit Release Confirmation Prompt */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 text-emerald-500 focus:ring-0 focus:outline-none"
                  />
                  <div className="text-[11px] leading-relaxed text-zinc-300">
                    <span className="font-bold text-white block">Release this version as the final deliverable?</span>
                    <span>
                      I confirm that this version is approved and will become the client's official downloadable final file.
                    </span>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releasing || hasOpenFeedback || availableVersions.length === 0 || !confirmed}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {releasing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Releasing Deliverable...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Confirm & Release</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
