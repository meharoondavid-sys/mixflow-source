import React, { useEffect, useState } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getSupabase, getSupabaseAnonKey } from '../../lib/supabase';

export const UploadMixModal: React.FC = () => {
  const { isUploadMixOpen, setIsUploadMixOpen, activeProject, activeUploadSongId, setActiveUploadSongId, uploadMixVersion } = useApp();
  const [nextVer, setNextVer] = useState((activeProject?.versions.length || 0) + 1);
  const [versionName, setVersionName] = useState('Mix V1 - Revised Balance');
  const [notes, setNotes] = useState('');
  const [lufs, setLufs] = useState(-10.2);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isUploadMixOpen || !activeProject) return;
    let cancelled = false;

    const loadNextVersion = async () => {
      try {
        const supabase = getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) return;

        const query = activeUploadSongId ? `?songId=${encodeURIComponent(activeUploadSongId)}` : '';
        const res = await fetch(`/api/projects/${activeProject.id}/versions${query}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;

        const body = await res.json();
        const latest = (body.versions || []).reduce(
          (max: number, version: any) => Math.max(max, Number(version.version_number) || 0),
          0
        );

        if (!cancelled) {
          const next = latest + 1;
          setNextVer(next);
          setVersionName(`Mix V${next} - Revised Balance`);
        }
      } catch {}
    };

    loadNextVersion();
    return () => { cancelled = true; };
  }, [isUploadMixOpen, activeProject?.id, activeUploadSongId]);

  if (!isUploadMixOpen || !activeProject) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!audioFile) {
      setError('Choose the rendered audio file before publishing this mix.');
      return;
    }

    setIsSubmitting(true);
    setProgress(1);
    setError(null);
    setSuccess(false);

    try {
      const supabase = getSupabase();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error('Your session expired. Please sign in again.');
      }

      setStatus('Checking project access…');
      const { data: projectRow, error: projectError } = await supabase
        .from('projects')
        .select('id, organization_id')
        .eq('id', activeProject.id)
        .maybeSingle();
      if (projectError || !projectRow) {
        throw new Error('Could not find this project in the live workspace. Open the project from the Projects page and try again.');
      }

      let latestVersionQuery = supabase
        .from('project_file_versions')
        .select('version_number')
        .eq('project_id', activeProject.id);

      if (activeUploadSongId) {
        latestVersionQuery = latestVersionQuery.eq('song_id', activeUploadSongId);
      } else {
        latestVersionQuery = latestVersionQuery.is('song_id', null);
      }

      const { data: latestVersion, error: versionError } = await latestVersionQuery
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (versionError) throw new Error(`Could not check existing mix versions: ${versionError.message}`);
      const versionNumber = (latestVersion?.version_number || 0) + 1;
      const cleanName = versionName.trim() || `Mix V${versionNumber}`;
      const fileType = audioFile.type || 'application/octet-stream';

      setStatus('Preparing secure upload…');
      const prepareRes = await fetch(`/api/projects/${activeProject.id}/versions/upload-url`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: audioFile.name,
          fileType,
          fileSize: audioFile.size,
          songId: activeUploadSongId || null,
          notes: notes.trim() || 'Addressed client feedback and refined balance.',
        }),
      });
      const prepareBody = await prepareRes.json().catch(() => ({}));
      if (!prepareRes.ok) {
        throw new Error(`Upload setup rejected (HTTP ${prepareRes.status}): ${prepareBody.error || 'Could not prepare upload.'}`);
      }
      const { versionId, storagePath, token } = prepareBody;
      if (!versionId || !token) throw new Error('The secure version upload token was not returned.');

      setProgress(2);
      setStatus('Starting secure audio upload…');
      const projectRef = new URL(supabase.supabaseUrl).hostname.split('.')[0];
      const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
      const { Upload: TusUpload } = await import('tus-js-client');

      await new Promise<void>((resolve, reject) => {
        const upload = new TusUpload(audioFile, {
          endpoint,
          headers: {
            apikey: getSupabaseAnonKey(),
            authorization: `Bearer ${accessToken}`,
            'x-signature': token,
          },
          metadata: {
            bucketName: 'project-files',
            objectName: storagePath,
            contentType: fileType,
          },
          chunkSize: 6 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          uploadDataDuringCreation: true,
          storeFingerprintForResuming: false,
          removeFingerprintOnSuccess: true,
          onProgress: (uploaded, total) => {
            setProgress(Math.max(2, Math.min(88, Math.round((uploaded / total) * 88))));
            setStatus('Uploading mix audio…');
          },
          onError: (uploadError: any) => {
            const response = uploadError?.originalResponse;
            const code = response?.getStatus?.();
            const body = response?.getBody?.();
            const detail = typeof body === 'string' ? body.slice(0, 220) : '';
            reject(new Error(`Storage upload failed (HTTP ${code || 'unknown'}).${detail ? ` ${detail}` : ''}`));
          },
          onSuccess: () => resolve(),
        });
        upload.start();
      });

      setProgress(91);
      setStatus('Registering uploaded file…');
      const confirmRes = await fetch(`/api/projects/${activeProject.id}/versions/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId,
          storagePath,
          fileName: cleanName,
          fileType,
          fileSize: audioFile.size,
          songId: activeUploadSongId || null,
          notes: notes.trim() || 'Addressed client feedback and refined balance.',
        }),
      });
      const confirmBody = await confirmRes.json().catch(() => ({}));
      if (!confirmRes.ok) {
        throw new Error(`Mix version registration failed (HTTP ${confirmRes.status}): ${confirmBody.error || 'Could not publish this mix version.'}`);
      }

      setProgress(96);
      setStatus('Publishing mix version…');

      // Keep the current studio preview responsive while the durable version is saved in Supabase.
      if (!activeUploadSongId) {
        uploadMixVersion(
          activeProject.id,
          cleanName,
          notes.trim() || 'Addressed client feedback and refined balance.',
          audioFile,
          Number(lufs)
        );
      }
      setProgress(100);
      setStatus('Mix published successfully.');
      setSuccess(true);
    } catch (err: any) {
      console.error('[MixFlow Upload Mix]', err);
      setError(err?.message || 'Could not publish this mix.');
      setStatus('Upload stopped.');
      setProgress(null);
    } finally {
      setIsSubmitting(false);
    }
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
              <h3 className="text-lg font-bold text-white">{activeUploadSongId ? 'Upload for Client Review' : `Upload Mix V${nextVer}`}</h3>
              <p className="text-xs text-zinc-400">{activeProject.title}</p>
            </div>
          </div>
          <button type="button" disabled={isSubmitting} onClick={() => {
              setIsUploadMixOpen(false);
              setActiveUploadSongId(null);
            }}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        {error && <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>}
        {success && <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex gap-2">
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" /><span>Mix uploaded and saved for this song's client review.</span>
        </div>}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 mb-1 font-medium">Version Name / Descriptor</label>
            <input type="text" required value={versionName} onChange={(e) => setVersionName(e.target.value)}
              placeholder="e.g. Mix V2 - Snare Up 2dB & De-ess Vocal"
              disabled={isSubmitting}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 disabled:opacity-60" />
          </div>

          <div>
            <label className="block text-zinc-300 mb-1 font-medium">Revision Notes & Changelog</label>
            <textarea rows={3} required value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Detail what changed in this revision…"
              disabled={isSubmitting}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 leading-relaxed disabled:opacity-60" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 mb-1 font-medium">Loudness Target (LUFS)</label>
              <input type="number" step="0.1" value={lufs} onChange={(e) => setLufs(Number(e.target.value))}
                disabled={isSubmitting}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-zinc-300 mb-1 font-medium">Audio Specs</label>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-400 font-mono">Original file format</div>
            </div>
          </div>

          <div className="border border-dashed border-zinc-700 hover:border-emerald-500 rounded-2xl p-5 text-center transition-colors">
            <input type="file" id="revisionAudioUpload" accept="audio/*,.wav,.mp3,.aif,.aiff,.flac,.m4a,.aac"
              disabled={isSubmitting}
              onChange={(e) => { setAudioFile(e.target.files?.[0] || null); setError(null); setSuccess(false); }}
              className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" />
            <p className="font-semibold text-zinc-200 mt-2">{audioFile ? audioFile.name : 'Choose rendered WAV, AIFF, or MP3'}</p>
            {audioFile && <p className="text-[11px] text-zinc-500 mt-1">{(audioFile.size / (1024 * 1024)).toFixed(1)} MB selected</p>}
          </div>

          {isSubmitting && <div className="space-y-2">
            <div className="flex items-center justify-between text-xs"><span className="text-zinc-400">{status}</span><span className="font-mono text-emerald-400">{progress ?? 0}%</span></div>
            <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
              <div className="h-full bg-emerald-400 transition-all duration-300" style={{ width: `${progress ?? 0}%` }} />
            </div>
          </div>}

          <div className="flex gap-2.5 pt-2">
            <button type="button" disabled={isSubmitting} onClick={() => setIsUploadMixOpen(false)}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={isSubmitting || success || !audioFile}
              className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {isSubmitting ? 'Publishing…' : success ? 'Published' : `Publish Mix V${nextVer}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
