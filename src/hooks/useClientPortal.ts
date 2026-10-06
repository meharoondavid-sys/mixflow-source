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
    refreshPortal: fetchPortalData,
    fetchProjectDetail,
    setActiveProject,
    downloadFile,
  };
}
