import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';

interface MobileProjectFileUploadViewProps {
  projectId: string;
}

export const MobileProjectFileUploadView: React.FC<MobileProjectFileUploadViewProps> = ({
  projectId,
}) => {
  const [sessionReady, setSessionReady] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState('Preparing secure upload…');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [songId, setSongId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    setSongId(params.get('songId'));

    let cancelled = false;
    getSupabase().auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError || !data.session?.access_token) {
        setError('Your session could not be restored. Please sign in again.');
        return;
      }
      setSessionReady(true);
      setStatus('Ready — choose a file to upload.');
    }).catch(() => {
      if (!cancelled) setError('Your session could not be restored. Please sign in again.');
    });

    return () => { cancelled = true; };
  }, []);

  const goBack = () => {
    window.location.href = `/#/project/${projectId}`;
  };

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError(null);
    setDone(false);
    setProgress(null);
    setStatus(file ? `Ready to upload ${file.name}` : 'Ready — choose a file to upload.');
  };

  const startUpload = async () => {
    if (!selectedFile || !sessionReady || progress !== null) return;

    setError(null);
    setDone(false);
    setProgress(1);
    setStatus('Preparing secure upload…');

    try {
      const { data } = await getSupabase().auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Your session expired. Please sign in again.');

      const prepareRes = await fetch(`/api/projects/${projectId}/files/upload-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileType: selectedFile.type || 'application/octet-stream',
          fileSize: selectedFile.size,
          songId,
        }),
      });

      if (!prepareRes.ok) {
        const body = await prepareRes.json().catch(() => ({}));
        throw new Error(body.error || `Could not prepare upload (HTTP ${prepareRes.status}).`);
      }

      const { fileId, storagePath, token } = await prepareRes.json();
      if (!token) throw new Error('The secure upload token was not returned.');

      setProgress(2);
      setStatus('Uploading directly to private storage…');

      const projectRef = new URL(getSupabase().supabaseUrl).hostname.split('.')[0];
      const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
      const { Upload } = await import('tus-js-client');

      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(selectedFile, {
          endpoint,
          headers: { 'x-signature': token },
          metadata: {
            bucketName: 'project-files',
            objectName: storagePath,
            contentType: selectedFile.type || 'application/octet-stream',
          },
          chunkSize: 6 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          uploadDataDuringCreation: true,
          storeFingerprintForResuming: false,
          removeFingerprintOnSuccess: true,
          onProgress: (uploaded, total) => {
            setProgress(Math.max(2, Math.min(94, Math.round((uploaded / total) * 94))));
          },
          onError: (uploadError) => reject(uploadError),
          onSuccess: () => resolve(),
        });
        upload.start();
      });

      setProgress(96);
      setStatus('Finalizing file record…');

      const confirmRes = await fetch(`/api/projects/${projectId}/files/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          storagePath,
          fileName: selectedFile.name,
          fileType: selectedFile.type || 'application/octet-stream',
          fileSize: selectedFile.size,
          songId,
        }),
      });

      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}));
        throw new Error(body.error || `Could not finalize upload (HTTP ${confirmRes.status}).`);
      }

      setProgress(100);
      setStatus('Upload complete.');
      setDone(true);
    } catch (err: any) {
      console.error('[MixFlow Mobile Upload]', err);
      setProgress(null);
      setError(err?.message || 'Upload failed.');
      setStatus('Upload stopped.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={progress !== null && progress < 100}
              className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40"
            >
              <ArrowLeft size={17} />
            </button>
            <div>
              <h1 className="text-base font-bold text-white">Upload Project File</h1>
              <p className="text-[11px] text-zinc-500">Mobile large-file upload</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {done ? (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 size={42} className="mx-auto text-emerald-400" />
              <div>
                <h2 className="text-sm font-bold text-white">File uploaded successfully</h2>
                <p className="text-xs text-zinc-500 mt-1">{selectedFile?.name}</p>
              </div>
              <button
                type="button"
                onClick={goBack}
                className="w-full py-2.5 bg-emerald-500 text-black rounded-xl text-xs font-bold"
              >
                Return to Project
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={!sessionReady || progress !== null}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-zinc-700 hover:border-emerald-500/60 bg-zinc-950 rounded-2xl p-8 text-center disabled:opacity-50"
                >
                  <Upload size={24} className="mx-auto text-emerald-400 mb-3" />
                  <span className="block text-xs font-semibold text-zinc-200">
                    {selectedFile ? selectedFile.name : 'Choose file'}
                  </span>
                  {selectedFile && (
                    <span className="block mt-1 text-[11px] text-zinc-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{status}</span>
                  {progress !== null && <span className="font-mono text-emerald-400">{progress}%</span>}
                </div>
                {progress !== null && (
                  <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                    <div className="h-full bg-emerald-400 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!selectedFile || !sessionReady || progress !== null}
                onClick={startUpload}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {progress !== null ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {progress !== null ? 'Uploading…' : 'Start Upload'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileProjectFileUploadView;
