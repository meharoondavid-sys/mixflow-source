import React, { useState } from 'react';
import { 
  X, 
  Disc3, 
  Music, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  DollarSign, 
  Layers, 
  FileText,
  User,
  ExternalLink,
  Sliders,
  Check
} from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { useProjects } from '../../hooks/useProjects';
import { useServices } from '../../hooks/useServices';
import { useApp } from '../../context/AppContext';
import { ProjectType, SongInput } from '../../types/project';

interface NewProjectModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (newProjectId: string) => void;
  onNavigateToClients?: () => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onSuccess,
  onNavigateToClients: propOnNavigateToClients
}) => {
  const { isNewProjectOpen, setIsNewProjectOpen, setActiveProjectId, setEngineerTab } = useApp();
  const isOpen = propIsOpen !== undefined ? propIsOpen : isNewProjectOpen;
  const handleClose = propOnClose || (() => setIsNewProjectOpen(false));
  const handleNavigateToClients = propOnNavigateToClients || (() => {
    handleClose();
    setActiveProjectId(null);
    setEngineerTab('clients');
    window.location.hash = '#/clients';
  });

  const { clients, loading: clientsLoading } = useClients();
  const { createProject, canManageProjects } = useProjects();
  const { availableServices, addServiceToProject } = useServices(undefined, isOpen);

  const [projectType, setProjectType] = useState<ProjectType>('single');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [deposit, setDeposit] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Single Song Title
  const [singleSongTitle, setSingleSongTitle] = useState('');

  // EP / Album Tracks
  const [songs, setSongs] = useState<SongInput[]>([
    { title: '', track_number: 1 },
    { title: '', track_number: 2 },
    { title: '', track_number: 3 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddTrack = () => {
    setSongs((prev) => [
      ...prev,
      { title: '', track_number: prev.length + 1 }
    ]);
  };

  const handleRemoveTrack = (index: number) => {
    if (songs.length <= 1) return;
    setSongs((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((song, i) => ({ ...song, track_number: i + 1 }));
    });
  };

  const handleTrackTitleChange = (index: number, title: string) => {
    setSongs((prev) =>
      prev.map((song, i) => (i === index ? { ...song, title } : song))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setFormError('Project Name is required.');
      return;
    }

    if (!clientId) {
      setFormError('Please select a client for this project.');
      return;
    }

    if (price !== '' && Number(price) < 0) {
      setFormError('Project price cannot be negative.');
      return;
    }

    if (deposit !== '' && Number(deposit) < 0) {
      setFormError('Deposit amount cannot be negative.');
      return;
    }

    const priceNum = price !== '' ? Number(price) || 0 : 0;
    const depositNum = deposit !== '' ? Number(deposit) || 0 : 0;

    if (depositNum > priceNum) {
      setFormError('Deposit amount cannot exceed total project price.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    // Prepare songs
    let formattedSongs: SongInput[] = [];
    if (projectType === 'single') {
      const title = singleSongTitle.trim() || name.trim();
      formattedSongs = [{ title, track_number: 1 }];
    } else {
      formattedSongs = songs
        .filter((s) => s.title.trim() !== '')
        .map((s, idx) => ({
          title: s.title.trim(),
          track_number: idx + 1,
        }));

      if (formattedSongs.length === 0) {
        formattedSongs = [{ title: `${name.trim()} (Track 1)`, track_number: 1 }];
      }
    }

    const res = await createProject({
      client_id: clientId,
      name: name.trim(),
      project_type: projectType,
      description: description.trim() || null,
      project_price: priceNum,
      deposit_amount: depositNum,
      deadline: deadline || null,
      status: 'inquiry',
      songs: formattedSongs,
    });

    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error.message);
    } else if (res.project) {
      if (selectedServiceIds.length > 0) {
        await Promise.all(
          selectedServiceIds.map((sId) => addServiceToProject(res.project!.id, sId, 'Not Started'))
        );
      }
      handleClose();
      if (onSuccess) {
        onSuccess(res.project.id);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-none sm:rounded-3xl p-4 sm:p-8 max-w-xl w-full min-h-screen sm:min-h-0 shadow-2xl space-y-4 sm:space-y-6 sm:my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Disc3 size={20} className="text-emerald-400" />
              <span>Create New Project</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">
              Set up a production contract with tracklist and financial terms.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {formError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 text-xs">
          {/* 1. Project Type Selector */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Project Type</label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setProjectType('single')}
                className={`py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 sm:gap-1 cursor-pointer ${
                  projectType === 'single'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Music size={16} className={projectType === 'single' ? 'text-emerald-400' : 'text-zinc-500'} />
                <span>Single</span>
                <span className="text-[10px] font-mono text-zinc-500">1 Track</span>
              </button>

              <button
                type="button"
                onClick={() => setProjectType('ep')}
                className={`py-2.5 px-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  projectType === 'ep'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Layers size={16} className={projectType === 'ep' ? 'text-emerald-400' : 'text-zinc-500'} />
                <span>EP</span>
                <span className="text-[10px] font-mono text-zinc-500">3 - 6 Tracks</span>
              </button>

              <button
                type="button"
                onClick={() => setProjectType('album')}
                className={`py-2.5 px-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  projectType === 'album'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Disc3 size={16} className={projectType === 'album' ? 'text-emerald-400' : 'text-zinc-500'} />
                <span>Album</span>
                <span className="text-[10px] font-mono text-zinc-500">Full Record</span>
              </button>
            </div>
          </div>

          {/* 2. Project Name */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Project Name <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={projectType === 'single' ? 'e.g. Midnight City' : 'e.g. Worship EP or Horizons LP'}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (projectType === 'single' && !singleSongTitle) {
                  setSingleSongTitle(e.target.value);
                }
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>

          {/* 3. Client Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-zinc-300 font-medium">
                Client / Artist <span className="text-emerald-400">*</span>
              </label>
              {handleNavigateToClients && (
                <button
                  type="button"
                  onClick={handleNavigateToClients}
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>+ Add New Client</span>
                  <ExternalLink size={10} />
                </button>
              )}
            </div>

            {clientsLoading ? (
              <div className="py-2.5 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-500 font-mono text-xs">
                Loading client roster...
              </div>
            ) : clients.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs space-y-1.5">
                <p>No clients exist in your studio workspace yet.</p>
                {handleNavigateToClients && (
                  <button
                    type="button"
                    onClick={handleNavigateToClients}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[11px] font-semibold text-amber-200 transition-colors cursor-pointer"
                  >
                    Go to Clients to add your first client
                  </button>
                )}
              </div>
            ) : (
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} {c.company_name ? `(${c.company_name})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 5. Description */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Description / Project Scope</label>
            <textarea
              rows={2}
              placeholder="e.g. Mixing & mastering pass with dynamic stems, references, and deadline notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Financials, Deadline & Status Row */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Project Price ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="850.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Deposit ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="425.00"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Target Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Production Services Scope Selector */}
          <div className="pt-2 border-t border-zinc-800">
            <label className="block text-zinc-300 font-medium mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sliders size={13} className="text-emerald-400" />
                <span>Services Required</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-normal">Select the services needed for this project</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-zinc-950/70 border border-zinc-800 rounded-xl">
              {availableServices.length === 0 ? (
                <span className="text-[11px] text-zinc-500">Loading services...</span>
              ) : (
                availableServices.map((svc) => {
                  const isSelected = selectedServiceIds.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceIds((prev) =>
                          isSelected ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
                        );
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm font-semibold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      {isSelected && <Check size={11} className="text-emerald-400" />}
                      <span>{svc.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 8. Song Management Section */}
          <div className="pt-2 border-t border-zinc-800">
            {projectType === 'single' ? (
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Song Title</label>
                <input
                  type="text"
                  placeholder="e.g. Yeshua or leave blank to match project name"
                  value={singleSongTitle}
                  onChange={(e) => setSingleSongTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-zinc-300 font-medium">
                    {projectType === 'ep' ? 'EP Tracklist' : 'Album Tracklist'} ({songs.length} tracks)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTrack}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Track</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {songs.map((song, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-7 text-center font-mono text-zinc-500 text-xs">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <input
                        type="text"
                        placeholder={`Track ${index + 1} title (e.g. ${index === 0 ? 'Yeshua' : index === 1 ? 'Holy Spirit' : 'Your Presence'})`}
                        value={song.title}
                        onChange={(e) => handleTrackTitleChange(index, e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                      {songs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTrack(index)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Remove track"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || clients.length === 0}
              className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Creating Project...</span>
                </>
              ) : (
                <span>Create Project</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
