import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  MessageSquare, 
  CheckCircle2, 
  Download, 
  CreditCard, 
  FileText, 
  Send, 
  Layers, 
  Clock, 
  Lock, 
  Unlock, 
  Music, 
  Sparkles,
  Check,
  Disc3,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WaveformPlayer } from '../WaveformPlayer';

export const ClientReviewView: React.FC = () => {
  const { 
    clientActiveProject, 
    activeVersionId, 
    switchActiveVersion,
    addComment,
    currentTime,
    seek,
    approveProject,
    setIsPaymentModalOpen,
    setActiveInvoiceProject,
    setIsInvoiceModalOpen,
    engineer,
    downloadFile,
    setCurrentView
  } = useApp();

  const [commentText, setCommentText] = useState('');
  const [clientNameInput, setClientNameInput] = useState(clientActiveProject?.clientName || 'Client');
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'feedback' | 'versions'>('feedback');

  if (!clientActiveProject) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
          <Disc3 size={40} className="mx-auto text-zinc-600 mb-4 animate-spin-slow" />
          <h2 className="text-xl font-bold text-white mb-2">Invalid or Expired Review Link</h2>
          <p className="text-xs text-zinc-400 mb-6">
            Please ask your mixing engineer for an updated secure review link.
          </p>
          <button
            onClick={() => {
              window.location.hash = '';
              setCurrentView('engineer');
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs"
          >
            Go to Engineer Console
          </button>
        </div>
      </div>
    );
  }

  const currentVersion = clientActiveProject.versions.find(v => v.id === activeVersionId) || clientActiveProject.versions[0];
  const balanceDue = clientActiveProject.totalAmount - clientActiveProject.paidAmount;
  const isPaid = balanceDue === 0;
  const isReadyForDelivery = clientActiveProject.isApproved && isPaid;
  const currencySymbol = engineer.currency === 'INR' ? '₹' : '$';

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handlePostComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim()) return;

    addComment(
      clientActiveProject.id,
      currentVersion.id,
      commentText.trim(),
      currentTime,
      clientNameInput || 'Client',
      'client'
    );
    setCommentText('');
  };

  const handleApprove = () => {
    approveProject(clientActiveProject.id);
    setShowApprovalSuccess(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Demo Banner for Preview Navigation */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 sm:px-6 py-2 text-xs flex items-center justify-between gap-3 sticky top-0 z-50">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline text-zinc-400">Preview Mode:</span>
          <span className="text-zinc-200 font-medium">Client Review Link</span>
          <span className="hidden md:inline text-zinc-500">(Clients access this without login)</span>
        </div>

        <button
          onClick={() => {
            window.location.hash = '';
            setCurrentView('engineer');
          }}
          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <span>← Back to Engineer Console</span>
        </button>
      </div>

      {/* Client Mode Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md sticky top-[37px] z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Disc3 size={18} />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white leading-tight">
                {clientActiveProject.title}
              </h2>
              <p className="text-xs text-zinc-400">
                Mixed by {engineer.studioName}
              </p>
            </div>
          </div>

          {/* Client Action Buttons (Responsive) */}
          <div className="flex items-center gap-2">
            {!clientActiveProject.isApproved ? (
              <button
                onClick={handleApprove}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/10"
              >
                <CheckCircle2 size={15} />
                <span>Approve Mix</span>
              </button>
            ) : !isPaid ? (
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all shadow-md"
              >
                <CreditCard size={15} />
                <span>Pay Balance ({currencySymbol}{balanceDue})</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-xl">
                <Check size={14} />
                <span>Approved & Paid</span>
              </div>
            )}

            <button
              onClick={() => {
                window.location.hash = '';
                setCurrentView('engineer');
              }}
              className="hidden sm:inline-flex px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs border border-zinc-800 transition-colors"
            >
              Engineer View
            </button>
          </div>
        </div>
      </header>

      {/* Main Review Viewport */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        {/* Approval Banner Notification */}
        {clientActiveProject.isApproved && !isPaid && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-400">Mix Approved by You</h4>
                <p className="text-xs text-zinc-300">
                  Please settle the remaining balance of {currencySymbol}{balanceDue} to immediately unlock full 24-bit WAV masters & stems.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center justify-center gap-2"
            >
              <CreditCard size={14} />
              <span>Pay Outstanding Balance</span>
            </button>
          </div>
        )}

        {/* Master Player Component */}
        <WaveformPlayer
          version={currentVersion}
          allVersions={clientActiveProject.versions}
          comments={clientActiveProject.comments}
          isClientMode={true}
          onAddCommentAtCurrentTime={(t) => {
            seek(t);
            setCommentText(`At ${formatSeconds(t)}: `);
          }}
        />

        {/* Timestamped Feedback Input Box */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <MessageSquare size={14} className="text-emerald-400" />
              <span>Leave Feedback at Playhead ({formatSeconds(currentTime)})</span>
            </span>
            <span className="text-zinc-500">Tap anywhere on the waveform above to pinpoint a timestamp</span>
          </div>

          <form onSubmit={handlePostComment} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Your Name (e.g. Sarah)"
                value={clientNameInput}
                onChange={(e) => setClientNameInput(e.target.value)}
                className="w-full sm:w-44 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder={`Tell engineer what to adjust at ${formatSeconds(currentTime)} (e.g. vocal level, snare reverb, bass punch)...`}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center justify-center gap-1.5"
              >
                <Send size={13} />
                <span>Post Note</span>
              </button>
            </div>
          </form>
        </div>

        {/* Two Column Layout: Versions & Comments (Left) + Billing & Delivery (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Comments List & Version Notes */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('feedback')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'feedback' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Feedback ({clientActiveProject.comments.length})
                </button>
                <button
                  onClick={() => setActiveTab('versions')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'versions' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Version Changelog ({clientActiveProject.versions.length})
                </button>
              </div>
            </div>

            {activeTab === 'feedback' ? (
              <div className="space-y-3">
                {clientActiveProject.comments.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-xs text-zinc-400">
                    No notes yet. Click the waveform or use the input box above to send revision feedback.
                  </div>
                ) : (
                  clientActiveProject.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-200">{comment.author}</span>
                          <button
                            onClick={() => seek(comment.timestampSeconds)}
                            className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded hover:bg-emerald-500/20"
                          >
                            {formatSeconds(comment.timestampSeconds)}
                          </button>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">{comment.createdAt}</span>
                      </div>

                      <p className="text-zinc-300 leading-relaxed pl-3 border-l-2 border-zinc-800">
                        {comment.text}
                      </p>

                      {comment.replyText && (
                        <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 mt-2">
                          <span className="font-semibold text-emerald-400 block text-[11px] mb-0.5">
                            Engineer Response:
                          </span>
                          <p className="text-zinc-300 text-[11px]">{comment.replyText}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {clientActiveProject.versions.map((ver) => (
                  <div
                    key={ver.id}
                    onClick={() => switchActiveVersion(ver.id)}
                    className={`bg-zinc-900 border rounded-2xl p-4 cursor-pointer text-xs space-y-2 transition-all ${
                      ver.id === currentVersion.id ? 'border-emerald-500/50 bg-zinc-900/90' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">
                        V{ver.versionNumber}: {ver.versionName}
                      </span>
                      <span className="text-zinc-500 font-mono text-[10px]">{ver.createdAt}</span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/80">
                      {ver.notes}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Billing, Approval Status & Final Files */}
          <div className="lg:col-span-5 space-y-5">
            {/* Approval & Billing Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h4 className="font-bold text-sm text-zinc-100">
                Project Sign-off & Billing
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Mix & Master Total</span>
                  <span className="font-mono text-zinc-200 font-bold tabular-nums">
                    {currencySymbol}{clientActiveProject.totalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-zinc-400">
                  <span>Paid to Date</span>
                  <span className="font-mono text-emerald-400 font-bold tabular-nums">
                    {currencySymbol}{clientActiveProject.paidAmount.toLocaleString()}
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
                  <span className="font-semibold text-zinc-200">Balance Due</span>
                  <span className="font-mono font-bold text-base text-zinc-100 tabular-nums">
                    {currencySymbol}{balanceDue.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {!clientActiveProject.isApproved && (
                  <button
                    onClick={handleApprove}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors shadow-md"
                  >
                    <CheckCircle2 size={16} />
                    <span>Approve V{currentVersion.versionNumber} as Final Mix</span>
                  </button>
                )}

                {balanceDue > 0 && (
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-100 hover:bg-white text-black font-bold rounded-xl text-xs transition-colors shadow-md"
                  >
                    <CreditCard size={15} />
                    <span>Pay Balance ({currencySymbol}{balanceDue})</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveInvoiceProject(clientActiveProject);
                    setIsInvoiceModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
                >
                  <FileText size={14} />
                  <span>View Official Invoice</span>
                </button>
              </div>
            </div>

            {/* Final File Delivery Card (Unlocked only when Approved + Paid) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-zinc-100">
                  Final Master Files
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  {isReadyForDelivery ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Unlock size={12} /> UNLOCKED
                    </span>
                  ) : (
                    <span className="text-zinc-500 flex items-center gap-1">
                      <Lock size={12} /> LOCKED
                    </span>
                  )}
                </div>
              </div>

              {isReadyForDelivery ? (
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs mb-3">
                    Your final 24-bit masters and stem archives are ready for download.
                  </div>

                  {clientActiveProject.deliveries.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-xl border border-zinc-800"
                    >
                      <div className="truncate mr-2">
                        <span className="font-mono text-zinc-200 block truncate">{file.name}</span>
                        <span className="text-[10px] text-zinc-500">{file.format} · {file.size}</span>
                      </div>
                      <button
                        onClick={() => downloadFile(file.name, file.format)}
                        className="px-2.5 py-1 bg-emerald-500 text-black font-semibold text-xs rounded-lg hover:bg-emerald-400 transition-colors shrink-0 flex items-center gap-1"
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 text-xs text-zinc-400 space-y-2">
                  <p className="leading-relaxed">
                    High-resolution 24-bit WAV masters, instrumental tracks, and stem archives will be unlocked automatically upon:
                  </p>
                  <ul className="space-y-1 pl-4 list-disc text-zinc-400">
                    <li className={clientActiveProject.isApproved ? 'text-emerald-400 font-semibold' : ''}>
                      Client Mix Approval {clientActiveProject.isApproved && '✓'}
                    </li>
                    <li className={isPaid ? 'text-emerald-400 font-semibold' : ''}>
                      Full Balance Settlement ({currencySymbol}{balanceDue} remaining) {isPaid && '✓'}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 mt-12 text-center text-xs text-zinc-400">
        <p>MixFlow · Professional Music Engineering Client Portal</p>
      </footer>
    </div>
  );
};
