import React, { useState } from 'react';
import { X, Upload, Layers, Disc3, Sliders } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const UploadMixModal: React.FC = () => {
  const { isUploadMixOpen, setIsUploadMixOpen, activeProject, uploadMixVersion } = useApp();

  const nextVer = (activeProject?.versions.length || 0) + 1;
  const [versionName, setVersionName] = useState(`Mix V${nextVer} - Revised Balance`);
  const [notes, setNotes] = useState('');
  const [lufs, setLufs] = useState(-10.2);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  if (!isUploadMixOpen || !activeProject) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMixVersion(
      activeProject.id,
      versionName.trim() || `Mix V${nextVer}`,
      notes.trim() || 'Addressed client feedback and refined balance.',
      audioFile,
      Number(lufs)
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-mono font-bold text-xs">
              V{nextVer}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Upload Mix V{nextVer}</h3>
              <p className="text-xs text-zinc-400">
                {activeProject.title}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsUploadMixOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 mb-1 font-medium">Version Name / Descriptor</label>
            <input
              type="text"
              required
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="e.g. Mix V2 - Snare Up 2dB & De-ess Vocal"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-zinc-300 mb-1 font-medium">Revision Notes & Changelog</label>
            <textarea
              rows={3}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detail what was tweaked: e.g. Tamed vocal harshness at 7kHz, automated delay throw in pre-chorus, compressed bass bus..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 mb-1 font-medium">Loudness Target (LUFS)</label>
              <input
                type="number"
                step="0.1"
                value={lufs}
                onChange={(e) => setLufs(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-300 mb-1 font-medium">Audio Specs</label>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-400 font-mono">
                24-bit / 48.0 kHz
              </div>
            </div>
          </div>

          {/* Audio File Dropzone */}
          <div className="border border-dashed border-zinc-700 hover:border-emerald-500 rounded-2xl p-5 text-center transition-colors">
            <input
              type="file"
              id="revisionAudioUpload"
              accept="audio/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setAudioFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <label htmlFor="revisionAudioUpload" className="cursor-pointer block">
              <Upload size={22} className="mx-auto text-zinc-400 mb-1.5" />
              <p className="font-semibold text-zinc-200">
                {audioFile ? audioFile.name : `Attach Rendered V${nextVer} Audio File`}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {audioFile ? `${(audioFile.size / (1024 * 1024)).toFixed(1)} MB selected` : 'Drag and drop WAV, AIFF, or MP3 (or simulate render)'}
              </p>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsUploadMixOpen(false)}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl shadow-lg shadow-emerald-500/20"
            >
              Publish Mix V{nextVer}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
