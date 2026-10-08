import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import {
  ClientPortalProfile,
  ClientPortalProjectSummary,
  ClientPortalProjectDetail,
} from '../types/clientPortal';

export function useClientPortal() {
  const [profile, setProfile] = useState<ClientPortalProfile | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [projects, setProjects] = useState<ClientPortalProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<ClientPortalProjectDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [projectLoading, setProjectLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token || null;
  }, []);

  // Fetch client identity and projects list
  const fetchPortalData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setIsClient(false);
        setProjects([]);
        setLoading(false);
        return;
      }

      // 1. Fetch client profile
      const meRes = await fetch('/api/client-portal/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) {
        throw new Error('Failed to verify client identity.');
      }
      const meData = await meRes.json();
      setIsClient(Boolean(meData.isClient));
      setProfile(meData.client || null);

      if (!meData.isClient) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // 2. Fetch projects
      const projRes = await fetch('/api/client-portal/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!projRes.ok) {
        throw new Error('Failed to load client projects.');
      }
      const projData = await projRes.json();
      setProjects(projData.projects || []);
    } catch (err: any) {
      console.error('[MixFlow Client Portal] Error loading portal data:', err);
      setError(err?.message || 'Failed to connect to client portal.');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  // Add a project to My Music using the unique code supplied by an engineer.
  const claimProject = useCallback(async (projectCode: string) => {
    try {
      const token = await getAuthToken();
      if (!token) return { error: new Error('Please sign in to your client account first.') };

      const res = await fetch('/api/client-portal/projects/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectCode: projectCode.trim().toUpperCase() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not add this project.');

      await fetchPortalData();
      return { error: null as Error | null, project: data.project };
    } catch (err: any) {
      return { error: new Error(err?.message || 'We could not add this project.') };
    }
  }, [getAuthToken, fetchPortalData]);

  // Fetch specific project details (including songs and files)
  const fetchProjectDetail = useCallback(async (projectId: string) => {
    setProjectLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required.');
      }

      const res = await fetch(`/api/client-portal/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied: You do not have permission to view this project.');
        }
        if (res.status === 404) {
          throw new Error('Project not found or no longer available.');
        }
        throw new Error('Failed to retrieve project details.');
      }

      const data: ClientPortalProjectDetail = await res.json();
      setActiveProject(data);
      return data;
    } catch (err: any) {
      console.error('[MixFlow Client Portal] Project detail error:', err);
      setError(err?.message || 'Error loading project.');
      setActiveProject(null);
      return null;
    } finally {
      setProjectLoading(false);
    }
  }, [getAuthToken]);

  // Upload a file from the client to the studio using resumable storage chunks
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFileToStudio = useCallback(async (projectId: string, file: File, songId?: string | null) => {
    setIsUploading(true);
    setUploadProgress(1);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required.');

      const prep = await fetch(`/api/client-portal/projects/${projectId}/files/upload-url`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          songId: songId || null,
        }),
      });
      if (!prep.ok) {
        const data = await prep.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to prepare file upload.');
      }

      const { fileId, storagePath, token: uploadToken } = await prep.json();
      if (!uploadToken) throw new Error('Upload could not be prepared securely.');

      const { Upload } = await import('tus-js-client');
      const projectRef = new URL(getSupabase().supabaseUrl).hostname.split('.')[0];
      const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;

      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint,
          headers: { 'x-signature': uploadToken },
          metadata: {
            bucketName: 'project-files',
            objectName: storagePath,
            contentType: file.type || 'application/octet-stream',
          },
          chunkSize: 6 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          onProgress: (uploaded, total) => {
            setUploadProgress(Math.min(90, Math.max(1, Math.round((uploaded / total) * 90))));
          },
          onError: reject,
          onSuccess: () => resolve(),
        });
        upload.start();
      });

      const confirm = await fetch(`/api/client-portal/projects/${projectId}/files/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId, storagePath,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          songId: songId || null,
        }),
      });
      if (!confirm.ok) {
        const data = await confirm.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to confirm uploaded file.');
      }

      setUploadProgress(100);
      await fetchProjectDetail(projectId);
      return { error: null as Error | null };
    } catch (err: any) {
      return { error: new Error(err?.message || 'File upload failed.') };
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 1000);
    }
  }, [getAuthToken, fetchProjectDetail]);

  // Download a permitted file using a secure temporary signed URL
  const downloadFile = useCallback(async (projectId: string, fileId: string, fallbackFileName: string) => {
    setDownloadingFileId(fileId);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required.');
      }

      const res = await fetch(`/api/client-portal/projects/${projectId}/files/${fileId}/download-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate secure download link.');
      }

      const { signedUrl, fileName } = await res.json();
      if (!signedUrl) {
        throw new Error('Signed download URL was not provided.');
      }

      // Trigger browser download
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = fileName || fallbackFileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('[MixFlow Client Portal] Download error:', err);
      alert(err?.message || 'Download failed. Please check permissions or try again.');
    } finally {
      setDownloadingFileId(null);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  return {
    profile,
    isClient,
    projects,
    activeProject,
    loading,
    projectLoading,
    error,
    downloadingFileId,
    uploadProgress,
    isUploading,
    uploadFileToStudio,
    refreshPortal: fetchPortalData,
    claimProject,
    fetchProjectDetail,
    setActiveProject,
    downloadFile,
  };
}
