import React, { useEffect, useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Music,
  Filter,
  FileCode,
  FileArchive,
  FileAudio,
  FileImage,
  AlertCircle,
  Loader2,
  CheckCircle2,
  X,
  HardDrive,
  User,
  Calendar,
  Layers,
  Search,
  ExternalLink,
} from 'lucide-react';
import { useProjectFiles } from '../../hooks/useProjectFiles';
import { ProjectSongRecord } from '../../types/project';
import { ProjectFileRecord } from '../../types/file';

interface ProjectFilesSectionProps {
  projectId: string;
  songs?: ProjectSongRecord[];
}

export const ProjectFilesSection: React.FC<ProjectFilesSectionProps> = ({
  projectId,
  songs = [],
}) => {
  const {
    files,
    loading,
    error: filesError,
    uploadProgress,
    isUploading,
    canUpload,
    canManageFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    userId,
  } = useProjectFiles(projectId);

  const [selectedSongFilter, setSelectedSongFilter] = useState<string>('all');

  useEffect(() => {
    const handleSongFileFilter = (event: Event) => {
      const songId = (event as CustomEvent<{ songId?: string }>).detail?.songId;
      if (!songId) return;
      setSelectedSongFilter(songId);
      setSelectedSourceFilter('all');
    };
    window.addEventListener('mixflow:project-file-filter', handleSongFileFilter);
    return () => window.removeEventListener('mixflow:project-file-filter', handleSongFileFilter);
  }, []);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<'all' | 'client' | 'studio'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadSongId, setUploadSongId] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<ProjectFileRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format file size
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Helper to format dates
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Helper to get matching file icon
  const getFileIcon = (fileType: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (fileType.startsWith('audio/') || ['wav', 'mp3', 'aif', 'aiff', 'flac', 'm4a', 'aac'].includes(ext)) {
      return <FileAudio size={18} className="text-emerald-400" />;
    }
    if (fileType.includes('zip') || fileType.includes('tar') || fileType.includes('rar') || ['zip', 'rar', '7z', 'gz'].includes(ext)) {
      return <FileArchive size={18} className="text-amber-400" />;
    }
    if (fileType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
      return <FileImage size={18} className="text-sky-400" />;
    }
    if (['pdf', 'txt', 'doc', 'docx', 'rtf'].includes(ext) || fileType.includes('pdf') || fileType.includes('text')) {
      return <FileText size={18} className="text-indigo-400" />;
    }
    return <FileCode size={18} className="text-zinc-400" />;
  };

  // Map song ID to Title
  const getSongTitle = (songId?: string | null): string | null => {
    if (!songId) return null;
    const song = songs.find((s) => s.id === songId);
    return song ? `Track ${song.track_number}: ${song.title}` : 'Associated Track';
  };

  // Filtering files
  const filteredFiles = files.filter((f) => {
    const matchesSong =
      selectedSongFilter === 'all'
        ? true
        : selectedSongFilter === 'project-root'
        ? !f.song_id
        : f.song_id === selectedSongFilter;

    const matchesSource =
      selectedSourceFilter === 'all' ||
      (selectedSourceFilter === 'client' && f.uploader_role === 'client') ||
      (selectedSourceFilter === 'studio' && f.uploader_role !== 'client');

    const q = searchQuery.toLowerCase().trim();
    const songTitle = getSongTitle(f.song_id)?.toLowerCase() || '';
    const uploader = (f.uploader_name || f.uploader_email || '').toLowerCase();
    const matchesSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.file_type.toLowerCase().includes(q) ||
      songTitle.includes(q) ||
      uploader.includes(q);

    return matchesSong && matchesSource && matchesSearch;
  });

  const handleOpenUpload = (preselectedSongId?: string) => {
    setSelectedUploadFile(null);
    setUploadSongId(preselectedSongId || '');
    setModalError(null);
    setIsUploadModalOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setSelectedUploadFile(selected);
      setModalError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadFile) {
      setModalError('Please select a file to upload.');
      return;
    }

    setModalError(null);
    const { error } = await uploadFile(selectedUploadFile, uploadSongId || null);

    if (error) {
      setModalError(error.message);
    } else {
      setIsUploadModalOpen(false);
      setSelectedUploadFile(null);
      setUploadSongId('');
    }
  };

  const handleDownload = async (file: ProjectFileRecord) => {
    setIsDownloadingId(file.id);
    const { error } = await downloadFile(file.id);
    setIsDownloadingId(null);
    if (error) {
      alert(`Download failed: ${error.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingFile) return;
    setIsDeleting(true);
    const { error } = await deleteFile(deletingFile.id);
    setIsDeleting(false);
    if (!error) {
      setDeletingFile(null);
    } else {
      alert(`Delete failed: ${error.message}`);
    }
  };

  return (
    <div id="project-files-section" className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl">
      {/* Header & Upload Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HardDrive size={18} className="text-emerald-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Project & Track Files
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Secure private audio multi-tracks, stems, session documents, and project media.
          </p>
        </div>

        {canUpload && (
          <button
            onClick={() => handleOpenUpload()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/40 cursor-pointer self-start sm:self-auto"
          >
            <Upload size={14} />
            <span>Upload File</span>
          </button>
        )}
      </div>

      {/* Client file shortcut */}
      {files.some((file) => file.uploader_role === 'client') && (
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Upload size={16} className="text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">Client Files</p>
              <p className="text-[11px] text-zinc-500">
                {files.filter((file) => file.uploader_role === 'client').length} file{files.filter((file) => file.uploader_role === 'client').length === 1 ? '' : 's'} sent by the client
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSourceFilter('client')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <Download size={13} />
            <span>View Client Files</span>
          </button>
        </div>
      )}

      {/* Upload Progress Bar if active */}
      {isUploading && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" />
              <span>Uploading to private storage...</span>
            </span>
            <span className="font-mono">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-1.5 transition-all duration-300"
              style={{ width: `${uploadProgress || 10}%` }}
            />
          </div>
        </div>
      )}

      {/* Global Error Banner if any */}
      {filesError && (
        <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-2xl text-xs text-red-300 flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
          <span>{filesError}</span>
        </div>
      )}

      {/* Search and Song Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search files by name, type, uploader..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* File Source Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedSourceFilter}
            onChange={(e) => setSelectedSourceFilter(e.target.value as 'all' | 'client' | 'studio')}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">All Files</option>
            <option value="client">Client Files ({files.filter((f) => f.uploader_role === 'client').length})</option>
            <option value="studio">Studio Files ({files.filter((f) => f.uploader_role !== 'client').length})</option>
          </select>
        </div>

        {/* Song Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={13} className="text-zinc-500 hidden sm:inline" />
          <select
            value={selectedSongFilter}
            onChange={(e) => setSelectedSongFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">All Files ({files.length})</option>
            <option value="project-root">Project Root (General)</option>
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                Track {song.track_number}: {song.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Files List / Table / Empty States */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500 font-mono text-xs bg-zinc-950/40 rounded-2xl border border-zinc-800/60">
          <Loader2 size={20} className="animate-spin text-emerald-400" />
          <span>Loading project files from secure storage...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="py-12 px-4 text-center space-y-3 bg-zinc-950/40 rounded-2xl border border-dashed border-zinc-800">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-600">
            <HardDrive size={22} />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-zinc-300">
              {searchQuery || selectedSongFilter !== 'all'
                ? 'No files matching current search/filter'
                : 'No files uploaded to this project yet'}
            </h4>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              {searchQuery || selectedSongFilter !== 'all'
                ? 'Try adjusting your search terms or song filter dropdown.'
                : 'Upload mix passes, raw stems, reference audio, or project documents securely.'}
            </p>
          </div>
          {canUpload && !searchQuery && selectedSongFilter === 'all' && (
            <button
              onClick={() => handleOpenUpload()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              <Upload size={13} className="text-emerald-400" />
              <span>Upload First File</span>
            </button>
          )}
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800/80 bg-zinc-950/60">
          {filteredFiles.map((file) => {
            const songTitle = getSongTitle(file.song_id);
            const canDeleteThisFile =
              canManageFiles || (userId && file.uploaded_by === userId);

            return (
              <div
                key={file.id}
                className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-850/40 transition-colors group"
              >
                {/* File Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                    {getFileIcon(file.file_type, file.name)}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-xs text-white truncate max-w-md" title={file.name}>
                        {file.name}
                      </span>

                      {file.uploader_role === 'client' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                          From Client
                        </span>
                      )}

                      {songTitle ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                          {songTitle}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-500 uppercase bg-zinc-900 border border-zinc-800 shrink-0">
                          Project Root
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-500">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>·</span>
                      <span className="capitalize">{file.file_type.split('/')[1] || file.file_type}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {formatDate(file.created_at)}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-zinc-400">
                        <User size={11} />
                        {file.uploader_name || file.uploader_email || (file.uploader_role === 'client' ? 'Client' : 'Studio Member')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleDownload(file)}
                    disabled={isDownloadingId === file.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                    title="Download / Open with temporary signed URL"
                  >
                    {isDownloadingId === file.id ? (
                      <Loader2 size={13} className="animate-spin text-emerald-400" />
                    ) : (
                      <Download size={13} className="text-emerald-400" />
                    )}
                    <span>Download</span>
                  </button>

                  {canDeleteThisFile && (
                    <button
                      onClick={() => setDeletingFile(file)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                      title="Delete File"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload File Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload size={16} className="text-emerald-400" />
                  <span>Upload Project File</span>
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Stored securely in the private project storage bucket.
                </p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            {isUploading && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 size={15} className="animate-spin text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-300">Uploading file...</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        Large files upload in small chunks and can take some time.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                    {uploadProgress ?? 0}%
                  </span>
                </div>
                <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-300"
                    style={{ width: String(uploadProgress ?? 0) + '%' }}
                  />
                </div>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {/* File Dropzone / Picker */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">
                  Select File <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-950/80 rounded-2xl p-6 text-center cursor-pointer transition-colors space-y-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center mx-auto text-emerald-400 border border-zinc-800">
                    <Upload size={18} />
                  </div>
                  {selectedUploadFile ? (
                    <div>
                      <span className="font-semibold text-zinc-100 block truncate max-w-xs mx-auto">
                        {selectedUploadFile.name}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {formatFileSize(selectedUploadFile.size)} · {selectedUploadFile.type || 'Binary'}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-medium text-zinc-300 block">
                        Click to browse file
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        WAV, MP3, ZIP Stems, PDF, or Session Assets
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Song Assignment */}
              {songs.length > 0 && (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Music size={13} className="text-emerald-400" />
                      <span>Associate with Track (Optional)</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-normal">Optional</span>
                  </label>
                  <select
                    value={uploadSongId}
                    onChange={(e) => setUploadSongId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">General Project Root (No specific track)</option>
                    {songs.map((song) => (
                      <option key={song.id} value={song.id}>
                        Track {song.track_number}: {song.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedUploadFile || isUploading}
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Confirm Upload</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Trash2 size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Delete File?</h4>
              <p className="text-xs text-zinc-400">
                Are you sure you want to permanently delete{' '}
                <span className="font-semibold text-zinc-200">"{deletingFile.name}"</span>?
                This action will delete the file from the storage bucket.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFile(null)}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <span>Delete File</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
