import React from 'react';
import { 
  PackageCheck, 
  Download, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  FileCheck, 
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { useProjectDeliveries } from '../../hooks/useProjectDeliveries';
import { DeliverableType } from '../../types/delivery';

interface ClientPortalDeliveriesSectionProps {
  projectId: string;
}

const TYPE_CONFIG: Record<DeliverableType, { label: string; color: string; bg: string; border: string }> = {
  master: { label: 'Final Master', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  instrumental: { label: 'Instrumental', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  stems: { label: 'Stems Package', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  other: { label: 'Deliverable', color: 'text-zinc-300', bg: 'bg-zinc-800', border: 'border-zinc-700' },
};

export const ClientPortalDeliveriesSection: React.FC<ClientPortalDeliveriesSectionProps> = ({ projectId }) => {
  const { deliveries, loading, downloadingId, getDownloadUrl } = useProjectDeliveries(projectId);

  const handleDownload = async (deliveryId: string) => {
    const result = await getDownloadUrl(deliveryId);
    if (result?.downloadUrl) {
      // Trigger browser download via temporary anchor
      const a = document.createElement('a');
      a.href = result.downloadUrl;
      a.download = result.fileName || 'final-master';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
    <section className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10">
            <PackageCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Final Deliverables</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                {deliveries.length} {deliveries.length === 1 ? 'Master Release' : 'Master Releases'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Official high-resolution approved audio masters and delivery packages ready for download
            </p>
          </div>
        </div>
      </div>

      {/* Distinction Callout */}
      <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex items-start gap-3 text-xs">
        <Info size={16} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-zinc-400 leading-relaxed text-[11px]">
          <span className="text-zinc-200 font-medium block">Audio Workflow Distinction:</span>
          <span>
            <strong>Working Versions</strong> in the audio player above are for listening and leaving timestamped revision feedback notes.
            <strong> Final Deliverables</strong> below are the engineer-certified master files for distribution and release.
          </span>
        </div>
      </div>

      {/* Deliverables List */}
      {loading ? (
        <div className="py-10 flex flex-col items-center justify-center text-zinc-500 gap-2 border border-dashed border-zinc-800 rounded-2xl">
          <Loader2 size={20} className="animate-spin text-emerald-400" />
          <span className="text-xs font-mono">Checking final deliverables...</span>
        </div>
      ) : deliveries.length === 0 ? (
        <div className="py-10 text-center text-xs text-zinc-400 border border-dashed border-zinc-800 rounded-2xl space-y-2 bg-zinc-950/30 p-6">
          <div className="w-10 h-10 rounded-xl bg-zinc-800/60 flex items-center justify-center text-zinc-500 mx-auto">
            <FileCheck size={20} />
          </div>
          <h3 className="font-semibold text-zinc-300">Deliverables Being Prepared</h3>
          <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
            Your audio is currently in production / review. Once you approve a mix version, your studio engineer will release your official high-resolution master deliverables here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/60 rounded-2xl border border-zinc-800/60 overflow-hidden bg-zinc-950/50">
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
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {isDelivered ? <CheckCircle2 size={11} /> : <Sparkles size={11} />}
                      <span>{isDelivered ? 'Downloaded' : 'Ready for Download'}</span>
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
                    {delivery.file_size ? (
                      <span>Size: {(delivery.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                    ) : null}
                    {delivery.file_type ? <span>Format: {delivery.file_type}</span> : null}
                  </div>
                </div>

                {/* Right: Download Action */}
                <div className="shrink-0">
                  <button
                    onClick={() => handleDownload(delivery.id)}
                    disabled={downloadingId === delivery.id}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {downloadingId === delivery.id ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Preparing Download...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span>Download Master File</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
