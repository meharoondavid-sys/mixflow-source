import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ProjectFileRecord } from '../types/file';

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

      // Step B: Upload directly to Supabase Storage with a browser-native TUS uploader.
      // Important: do NOT hand the entire File to a third-party uploader. Android browsers
      // can throw "low memory" when a library inspects/holds a very large File. We only ever
      // create a small Blob with File.slice(), then PATCH that chunk to Supabase.
      if (!token) {
        throw new Error('Large file upload could not be prepared securely.');
      }

      const projectRef = new URL(getSupabase().supabaseUrl).hostname.split('.')[0];
      const resumableEndpoint =
        `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
      const chunkSize = 6 * 1024 * 1024;

      const encodeMetadata = (value: string) => {
        const bytes = new TextEncoder().encode(value);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      };

      const tusHeaders = {
        'Tus-Resumable': '1.0.0',
        'x-signature': token,
      };

      // Create one unique TUS upload resource. Supabase then gives us a URL to which
      // each small chunk is PATCHed. The original File never gets buffered in memory.
      const createRes = await fetch(resumableEndpoint, {
        method: 'POST',
        headers: {
          ...tusHeaders,
          'Upload-Length': String(file.size),
          'Upload-Metadata': [
            `bucketName ${encodeMetadata('project-files')}`,
            `objectName ${encodeMetadata(storagePath)}`,
            `contentType ${encodeMetadata(file.type || 'application/octet-stream')}`,
          ].join(','),
        },
      });

      if (!createRes.ok) {
        const detail = await createRes.text().catch(() => '');
        throw new Error(detail || `Unable to start large-file upload (HTTP ${createRes.status}).`);
      }

      const locationHeader = createRes.headers.get('Location');
      if (!locationHeader) {
        throw new Error('Supabase did not return a resumable upload URL.');
      }
      const uploadUrl = new URL(locationHeader, resumableEndpoint).toString();

      let offset = 0;
      const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

      while (offset < file.size) {
        const chunkEnd = Math.min(offset + chunkSize, file.size);
        const chunk = file.slice(offset, chunkEnd);
        let uploaded = false;

        for (let attempt = 0; attempt < 5 && !uploaded; attempt++) {
          try {
            const patchRes = await fetch(uploadUrl, {
              method: 'PATCH',
              headers: {
                ...tusHeaders,
                'Content-Type': 'application/offset+octet-stream',
                'Upload-Offset': String(offset),
              },
              body: chunk,
            });

            if (patchRes.ok) {
              const nextOffset = Number(patchRes.headers.get('Upload-Offset'));
              if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
                throw new Error('Supabase returned an invalid upload offset.');
              }
              offset = Math.min(file.size, nextOffset);
              uploaded = true;
              const percent = Math.min(84, Math.max(1, Math.round((offset / file.size) * 84)));
              setUploadProgress(percent);
              break;
            }

            if (patchRes.status === 409 || patchRes.status === 412 || patchRes.status >= 500) {
              // Recover the authoritative offset after a transient/interrupted PATCH.
              const headRes = await fetch(uploadUrl, {
                method: 'HEAD',
                headers: tusHeaders,
              });
              if (headRes.ok) {
                const serverOffset = Number(headRes.headers.get('Upload-Offset'));
                if (Number.isFinite(serverOffset) && serverOffset >= 0 && serverOffset <= file.size) {
                  offset = serverOffset;
                  if (offset >= file.size) {
                    uploaded = true;
                    break;
                  }
                }
              }
            } else {
              const detail = await patchRes.text().catch(() => '');
              throw new Error(detail || `Upload chunk failed (HTTP ${patchRes.status}).`);
            }
          } catch (chunkErr: any) {
            if (attempt === 4) throw chunkErr;
          }

          if (!uploaded) {
            await new Promise((resolve) => setTimeout(resolve, [1000, 2000, 4000, 8000, 12000][attempt]));
          }
        }

        if (!uploaded && offset < file.size) {
          throw new Error(`Upload stopped around ${Math.round((offset / file.size) * 100)}%. Please try again.`);
        }
      }

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
