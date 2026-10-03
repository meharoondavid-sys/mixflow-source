import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  Upload, 
  CheckCircle2, 
  CreditCard, 
  FileText, 
  Download, 
  Clock, 
  MessageSquare, 
  Check, 
  Copy, 
  ExternalLink, 
  Layers, 
  Plus, 
  Activity, 
  AlertCircle,
  FileAudio,
  Send,
  Sparkles,
  Phone,
  Mail,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WaveformPlayer } from '../WaveformPlayer';
import { MixVersion, Comment, ProjectStatus } from '../../types';

export const ProjectWorkspace: React.FC = () => {
  const { 
    activeProject, 
    setActiveProjectId, 
    openClientReview, 
    activeVersionId, 
    switchActiveVersion,
    addComment,
    toggleCommentResolved,
    replyComment,
    currentTime,
    seek,
    setIsUploadMixOpen,
    setIsInvoiceModalOpen,
    setActiveInvoiceProject,
    setIsPaymentModalOpen,
    engineer,
    downloadFile,
    processPayment
  } = useApp();

  const [commentInput, setCommentInput] = useState('');
  const [activeTab, setActiveTab] = useState<'feedback' | 'versions' | 'brief' | 'history'>('feedback');
  const [commentFilter, setCommentFilter] = useState<'all' | 'current' | 'unresolved'>('all');
  const [replyInputId, setReplyInputId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  if (!activeProject) {
    return (
      <div className="p-12 text-center">
        <p className="text-zinc-400">No project selected.</p>
        <button
          onClick={() => setActiveProjectId(null)}
          className="mt-4 px-4 py-2 bg-zinc-800 text-zinc-200 rounded-xl text-xs"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentVersion = activeProject.versions.find(v => v.id === activeVersionId) || activeProject.versions[0];
  const balanceDue = activeProject.totalAmount - activeProject.paidAmount;
  const currencySymbol = engineer.currency === 'INR' ? '₹' : '$';

  const copyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/review/${activeProject.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareViaWhatsApp = () => {
    const url = `${window.location.origin}${window.location.pathname}#/review/${activeProject.shareToken}`;
    const text = `Hey ${activeProject.clientName}! Your latest mix for "${activeProject.title}" is ready for review on MixFlow: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePostComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentInput.trim()) return;
    addComment(
      activeProject.id,
      currentVersion.id,
      commentInput.trim(),
      currentTime,
      engineer.name,
      'engineer'
    );
    setCommentInput('');
  };

  const handlePostReply = (commentId: string) => {
    if (!replyText.trim()) return;
    replyComment(activeProject.id, commentId, replyText.trim());
    setReplyInputId(null);
    setReplyText('');
  };

  const filteredComments = activeProject.comments.filter(c => {
    if (commentFilter === 'current') return c.versionId === currentVersion.id;
    if (commentFilter === 'unresolved') return !c.resolved;
    return true;
  });

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveProjectId(null)}
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>{activeProject.artist}</span>
              <span aria-hidden="true">·</span>
              <span>{activeProject.genre}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-mono">Invoice {activeProject.invoiceNumber}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {activeProject.title}
            </h1>
          </div>
        </div>

        {/* Client Share & Review Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Share Link Banner */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-zinc-500 font-mono hidden sm:inline">Client Link:</span>
            <span className="font-mono text-emerald-400 text-[11px] truncate max-w-[130px] sm:max-w-[200px]">
              mixflow.io/review/{activeProject.shareToken}
            </span>
            <button
              onClick={copyShareLink}
              className="p-1 hover:text-white text-zinc-400 transition-colors"
              title="Copy client review link"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          <button
            onClick={shareViaWhatsApp}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
            title="Send link via WhatsApp"
          >
            WhatsApp
          </button>

          <button
            onClick={() => openClientReview(activeProject.shareToken)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-xs transition-colors"
          >
            <ExternalLink size={14} />
            <span>Open Client View</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Waveform & Audio Workstation (Left) + Project Management Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Audio Player & Detailed Panels */}
        <div className="lg:col-span-8 space-y-6">
          {/* Master Waveform Player */}
          <WaveformPlayer
            version={currentVersion}
            allVersions={activeProject.versions}
            comments={activeProject.comments}
            onAddCommentAtCurrentTime={(t) => {
              seek(t);
              setCommentInput(`At ${formatSeconds(t)}: `);
            }}
          />

          {/* Comment Quick Input at Current Playhead */}
          <form
            onSubmit={handlePostComment}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center px-3 py-2 text-xs focus-within:border-emerald-500 transition-colors">
              <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded mr-2 shrink-0">
                {formatSeconds(currentTime)}
              </span>
              <input
                type="text"
                placeholder="Type engineering note or client response at current timestamp..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="w-full bg-transparent text-zinc-200 placeholder:text-zinc-500 focus:outline-none text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5"
              >
                <Send size={13} />
                <span>Post Note</span>
              </button>

              <button
                type="button"
                onClick={() => setIsUploadMixOpen(true)}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5"
                title="Upload new mix version"
              >
                <Upload size={14} />
                <span>Upload V{activeProject.versions.length + 1}</span>
              </button>
            </div>
          </form>

          {/* Workspace Tabs */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'feedback'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquare size={14} />
              <span>Feedback & Notes ({activeProject.comments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('versions')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'versions'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers size={14} />
              <span>Mix Versions ({activeProject.versions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('brief')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'brief'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText size={14} />
              <span>Project Brief</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity size={14} />
              <span>Activity History</span>
            </button>
          </div>

          {/* Tab 1: Feedback & Revisions */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              {/* Feedback Sub-filters */}
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCommentFilter('all')}
                    className={`hover:text-white ${commentFilter === 'all' ? 'text-emerald-400 font-semibold' : ''}`}
                  >
                    All Notes ({activeProject.comments.length})
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    onClick={() => setCommentFilter('current')}
                    className={`hover:text-white ${commentFilter === 'current' ? 'text-emerald-400 font-semibold' : ''}`}
                  >
                    Current Version V{currentVersion.versionNumber} ({activeProject.comments.filter(c => c.versionId === currentVersion.id).length})
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    onClick={() => setCommentFilter('unresolved')}
                    className={`hover:text-white ${commentFilter === 'unresolved' ? 'text-emerald-400 font-semibold' : ''}`}
                  >
                    Open Only ({activeProject.comments.filter(c => !c.resolved).length})
                  </button>
                </div>
              </div>

              {filteredComments.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                  <MessageSquare size={28} className="mx-auto text-zinc-600 mb-2" />
                  <p className="text-zinc-300 font-medium text-sm">No feedback notes match this filter</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Play the audio and tap anywhere on the waveform to pin a timestamped note.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredComments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-all ${
                        comment.resolved ? 'opacity-60 bg-zinc-900/60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${comment.authorRole === 'client' ? 'bg-sky-400' : 'bg-emerald-400'}`} />
                          <span className="font-bold text-xs text-white">{comment.author}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {comment.authorRole === 'client' ? '(Client)' : '(Engineer)'}
                          </span>
                          <button
                            onClick={() => seek(comment.timestampSeconds)}
                            className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
                            title="Jump playhead to this second"
                          >
                            {formatSeconds(comment.timestampSeconds)}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-zinc-400 font-mono">{comment.createdAt}</span>
                          <button
                            onClick={() => toggleCommentResolved(activeProject.id, comment.id)}
                            className={`p-1 rounded-lg border transition-colors ${
                              comment.resolved
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                            }`}
                            title={comment.resolved ? 'Mark as unresolved' : 'Mark as addressed'}
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-200 leading-relaxed pl-4 border-l-2 border-zinc-800">
                        {comment.text}
                      </p>

                      {/* Reply section */}
                      {comment.replyText && (
                        <div className="mt-3 ml-4 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-xs">
                          <span className="font-semibold text-emerald-400 block mb-0.5">
                            Studio Response:
                          </span>
                          <p className="text-zinc-300">{comment.replyText}</p>
                        </div>
                      )}

                      {!comment.replyText && replyInputId !== comment.id && (
                        <button
                          onClick={() => setReplyInputId(comment.id)}
                          className="mt-2 text-[11px] text-zinc-400 hover:text-emerald-400 transition-colors ml-4"
                        >
                          Reply to note...
                        </button>
                      )}

                      {replyInputId === comment.id && (
                        <div className="mt-2 ml-4 flex gap-2">
                          <input
                            type="text"
                            placeholder="Add explanation or revision update..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            onClick={() => handlePostReply(comment.id)}
                            className="px-2.5 py-1 bg-emerald-500 text-black text-xs font-semibold rounded-lg"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => setReplyInputId(null)}
                            className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Mix Versions */}
          {activeTab === 'versions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">All submitted mix renders</span>
                <button
                  onClick={() => setIsUploadMixOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-black font-semibold rounded-xl text-xs"
                >
                  <Plus size={14} />
                  <span>Upload New Version</span>
                </button>
              </div>

              <div className="space-y-3">
                {activeProject.versions.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => switchActiveVersion(v.id)}
                    className={`bg-zinc-900 border rounded-2xl p-4 transition-all cursor-pointer ${
                      v.id === currentVersion.id
                        ? 'border-emerald-500/50 bg-zinc-900/90'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                            v.id === currentVersion.id
                              ? 'bg-emerald-500 text-black'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          V{v.versionNumber}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                            <span>{v.versionName}</span>
                            {v.id === currentVersion.id && (
                              <span className="text-[10px] text-emerald-400 font-mono">
                                [ACTIVE WORKSPACE TRACK]
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                            <span>{v.sampleRate}</span>
                            <span aria-hidden="true">·</span>
                            <span>{v.bitDepth}</span>
                            <span aria-hidden="true">·</span>
                            <span>{v.lufs.toFixed(1)} LUFS</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">{v.createdAt}</span>
                    </div>

                    <p className="text-xs text-zinc-300 bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/80 leading-relaxed">
                      {v.notes}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Project Brief */}
          {activeTab === 'brief' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Client Sound Direction
                </h4>
                <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                  {activeProject.brief}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Reference Tracks
                </h4>
                <div className="space-y-2">
                  {activeProject.referenceTracks.map((ref, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800 text-zinc-300"
                    >
                      <FileAudio size={14} className="text-emerald-400" />
                      <span>{ref}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Client Contact
                </h4>
                <div className="text-xs text-zinc-300 space-y-1">
                  <p>Contact: {activeProject.clientName}</p>
                  <p className="text-zinc-400">Email: {activeProject.clientEmail}</p>
                  <p className="text-zinc-400">Phone: {activeProject.clientPhone}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Activity History */}
          {activeTab === 'history' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Audit Trail & History
              </h4>
              <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-800">
                {activeProject.activities.map((act) => (
                  <div key={act.id} className="relative pl-6 text-xs">
                    <div className="absolute left-1 top-1.5 w-2 h-2 rounded-full bg-emerald-500 -translate-x-1/2" />
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-zinc-200">{act.actor}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{act.timestamp}</span>
                    </div>
                    <p className="text-zinc-400">{act.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Lifecycle Milestones, Financials & Final Deliveries */}
        <div className="lg:col-span-4 space-y-6">
          {/* Milestone Status Tracker */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h4 className="font-bold text-sm text-zinc-200 mb-4">
              Workflow Status
            </h4>

            <div className="space-y-4 text-xs">
              {/* Step 1: Upload Mix */}
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Check size={12} />
                </div>
                <div>
                  <span className="font-semibold text-zinc-200 block">1. Mix Uploaded</span>
                  <span className="text-[11px] text-zinc-400">Active version: V{currentVersion.versionNumber}</span>
                </div>
              </div>

              {/* Step 2: Client Review & Feedback */}
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                  activeProject.comments.length > 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}>
                  <MessageSquare size={12} />
                </div>
                <div>
                  <span className="font-semibold text-zinc-200 block">2. Client Feedback</span>
                  <span className="text-[11px] text-zinc-400">{activeProject.comments.length} total comments logged</span>
                </div>
              </div>

              {/* Step 3: Client Approval */}
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                  activeProject.isApproved
                    ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                }`}>
                  {activeProject.isApproved ? <Check size={12} /> : '3'}
                </div>
                <div>
                  <span className={`font-semibold block ${activeProject.isApproved ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    3. Client Approval
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {activeProject.isApproved ? `Approved on ${activeProject.approvedAt}` : 'Pending final client sign-off'}
                  </span>
                </div>
              </div>

              {/* Step 4: Balance Payment */}
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                  balanceDue === 0
                    ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                }`}>
                  {balanceDue === 0 ? <Check size={12} /> : '4'}
                </div>
                <div>
                  <span className={`font-semibold block ${balanceDue === 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    4. Balance Payment
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {balanceDue === 0 ? 'Fully settled' : `${currencySymbol}${balanceDue} outstanding`}
                  </span>
                </div>
              </div>

              {/* Step 5: Master File Delivery */}
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                  activeProject.isApproved && balanceDue === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                }`}>
                  <Download size={12} />
                </div>
                <div>
                  <span className={`font-semibold block ${activeProject.isApproved && balanceDue === 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    5. Final Delivery
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {activeProject.isApproved && balanceDue === 0 ? 'Unlocked for client download' : 'Locks until approved & paid'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Project Billing & Invoice Summary */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h4 className="font-bold text-sm text-zinc-200 mb-4">
              Financial Summary
            </h4>

            <div className="space-y-3 text-xs mb-5">
              <div className="flex justify-between items-center text-zinc-400">
                <span>Total Project Fee</span>
                <span className="font-mono text-zinc-200 font-bold tabular-nums">
                  {currencySymbol}{activeProject.totalAmount.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-zinc-400">
                <span>Deposit / Paid</span>
                <span className="font-mono text-emerald-400 font-bold tabular-nums">
                  {currencySymbol}{activeProject.paidAmount.toLocaleString()}
                </span>
              </div>

              <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
                <span className="font-semibold text-zinc-200">Balance Due</span>
                <span className="font-mono font-bold text-base text-zinc-100 tabular-nums">
                  {currencySymbol}{balanceDue.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setActiveInvoiceProject(activeProject);
                  setIsInvoiceModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors"
              >
                <FileText size={14} />
                <span>Invoice PDF</span>
              </button>

              {balanceDue > 0 && (
                <button
                  onClick={() => processPayment(activeProject.id, balanceDue, 'manual')}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium transition-colors"
                  title="Mark balance as received manually"
                >
                  <CreditCard size={14} />
                  <span>Mark Paid</span>
                </button>
              )}
            </div>
          </div>

          {/* Master Delivery Package */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-sm text-zinc-200">
                Master Delivery Package
              </h4>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                activeProject.isApproved && balanceDue === 0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400'
              }`}>
                {activeProject.isApproved && balanceDue === 0 ? 'DELIVERY READY' : 'LOCKED'}
              </span>
            </div>

            <div className="space-y-2">
              {activeProject.deliveries.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-xl border border-zinc-800/80 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileAudio size={14} className="text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <span className="font-mono text-zinc-200 block truncate">{file.name}</span>
                      <span className="text-[10px] text-zinc-400">{file.format} · {file.size}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadFile(file.name, file.format)}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg shrink-0 ml-2"
                    title={`Download ${file.name}`}
                  >
                    <Download size={13} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                activeProject.deliveries.forEach(f => downloadFile(f.name, f.format));
              }}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors"
            >
              <Download size={14} />
              <span>Download All Deliverables (.ZIP)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
