import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth from '../context/AuthContext';
import { ProjectFileRecord } from '../types/file';
import { getSupabase } from '../lib/supabase';

export function useProjectFiles(projectId?: string | null) {
  const { session, organization, role } = useAuth();
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const canUpload = role === 'owner' || role === 'admin' || role === 'engineer' || role === 'producer';
  const canManageFiles = role === 'owner' || role === 'admin';

  // 1. Fetch files for project
  const fetchFiles = useCallback(async () => {
    if (!projectId || !session?.access_token) {
      setFiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch files (Status ${res.status})`);
      }

      const data = await res.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error('[MixFlow Files] Fetch error:', err);
      setError(err?.message || 'Failed to load project files.');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, session?.access_token]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // 2. Upload file
  const uploadFile = async (
    file: File,
    songId?: string | null
  ): Promise<{ file: ProjectFileRecord | null; error: Error | null }> => {
    if (!projectId) {
      return { file: null, error: new Error('No active project specified.') };
    }
    if (!session?.access_token) {
      return { file: null, error: new Error('Authentication required.') };
    }
    if (!file) {
      return { file: null, error: new Error('No file selected for upload.') };
    }

    setIsUploading(true);
    setUploadProgress(10);
    setError(null);

    try {
      // Step A: Request signed upload URL from backend
      const urlRes = await fetch(`/api/projects/${projectId}/files/upload-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          songId: songId || null,
        }),
      });

      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to prepare upload.');
      }

      const { fileId, storagePath, signedUrl, token } = await urlRes.json();
      setUploadProgress(40);

      // Step B: Upload directly to Supabase Storage using resumable TUS chunks.
      // Large audio files (such as 850MB WAVs) should not use the standard single-request
      // upload path. Supabase recommends TUS for files larger than 6MB.
      if (!token) {
        throw new Error('Large file upload could not be prepared securely.');
      }

      const { Upload } = await import('tus-js-client');
      const projectRef = new URL(getSupabase().supabaseUrl).hostname.split('.')[0];
      const resumableEndpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;

      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: resumableEndpoint,
          headers: {
            'x-signature': token,
          },
          metadata: {
            bucketName: 'project-files',
            objectName: storagePath,
            contentType: file.type || 'application/octet-stream',
          },
          chunkSize: 6 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          onProgress: (bytesUploaded, bytesTotal) => {
            const percent = Math.min(84, Math.max(1, Math.round((bytesUploaded / bytesTotal) * 84)));
            setUploadProgress(percent);
          },
          onError: (error) => reject(error),
          onSuccess: () => resolve(),
        });
        upload.start();
      });

      setUploadProgress(85);

      // Step C: Confirm upload with backend & register file metadata
      const confirmRes = await fetch(`/api/projects/${projectId}/files/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          storagePath,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          songId: songId || null,
        }),
      });

      if (!confirmRes.ok) {
        const cErr = await confirmRes.json().catch(() => ({}));
        throw new Error(cErr.error || 'Failed to confirm file upload metadata.');
      }

      const { file: newFile } = await confirmRes.json();
      setUploadProgress(100);

      // Optimistically update local files state
      setFiles((prev) => [newFile, ...prev.filter((f) => f.id !== newFile.id)]);
      return { file: newFile, error: null };
    } catch (err: any) {
      console.error('[MixFlow Files] Upload exception:', err);
      const msg = err?.message || 'File upload failed.';
      setError(msg);
      return { file: null, error: new Error(msg) };
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 1000);
    }
  };

  // 3. Download / Open file with short-lived signed URL
  const downloadFile = async (fileId: string): Promise<{ error: Error | null }> => {
    if (!projectId || !session?.access_token) {
      return { error: new Error('Authentication required.') };
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/files/${fileId}/download-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate download URL.');
      }

      const { signedUrl, fileName } = await res.json();
      if (!signedUrl) {
        throw new Error('No signed URL returned from server.');
      }

      // Trigger browser download safely
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = fileName || 'download';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      return { error: null };
    } catch (err: any) {
      console.error('[MixFlow Files] Download error:', err);
      return { error: new Error(err?.message || 'Failed to download file.') };
    }
  };

  // 4. Delete file
  const deleteFile = async (fileId: string): Promise<{ error: Error | null }> => {
    if (!projectId || !session?.access_token) {
      return { error: new Error('Authentication required.') };
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to delete file.');
      }

      // Optimistically remove from state
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      return { error: null };
    } catch (err: any) {
      console.error('[MixFlow Files] Delete error:', err);
      return { error: new Error(err?.message || 'Failed to delete file.') };
    }
  };

  return {
    files,
    loading,
    error,
    uploadProgress,
    isUploading,
    canUpload,
    canManageFiles,
    fetchFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    userId: session?.user?.id || null,
  };
}
