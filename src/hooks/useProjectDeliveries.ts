import { useState, useEffect, useCallback, useMemo } from 'react';
import { ProjectDeliveryRecord, CreateDeliveryInput, DeliveryDownloadResponse } from '../types/delivery';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useProjectDeliveries(projectId: string) {
  const { role } = useAuth();
  const [deliveries, setDeliveries] = useState<ProjectDeliveryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<boolean>(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canReleaseDelivery = useMemo(() => {
    return role === 'owner' || role === 'admin' || role === 'engineer';
  }, [role]);

  const getAuthToken = async () => {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    return data.session?.access_token || null;
  };

  const fetchDeliveries = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        setDeliveries([]);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/projects/${projectId}/deliveries`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to fetch deliveries.`);
      }

      const data = await res.json();
      setDeliveries(data.deliveries || []);
    } catch (err: any) {
      console.warn('[MixFlow Deliveries] Fetch notice:', err.message);
      setError(err.message || 'Unable to load project deliverables.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const releaseDelivery = async (
    input: CreateDeliveryInput
  ): Promise<{ success: boolean; error?: string; delivery?: ProjectDeliveryRecord }> => {
    setReleasing(true);
    setReleaseError(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const res = await fetch(`/api/projects/${projectId}/deliveries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Failed to release final deliverable.`);
      }

      const newDelivery: ProjectDeliveryRecord = data.delivery;
      setDeliveries((prev) => [newDelivery, ...prev]);
      return { success: true, delivery: newDelivery };
    } catch (err: any) {
      const msg = err.message || 'Failed to release deliverable.';
      setReleaseError(msg);
      return { success: false, error: msg };
    } finally {
      setReleasing(false);
    }
  };

  const getDownloadUrl = async (
    deliveryId: string
  ): Promise<{ downloadUrl: string; fileName: string } | null> => {
    setDownloadingId(deliveryId);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const res = await fetch(`/api/projects/${projectId}/deliveries/${deliveryId}/download-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: DeliveryDownloadResponse = await res.json();
      if (!res.ok) {
        throw new Error((data as any).error || 'Failed to generate secure download URL.');
      }

      // Update local delivery status if changed to delivered
      setDeliveries((prev) =>
        prev.map((d) => (d.id === deliveryId ? { ...d, status: data.status } : d))
      );

      return { downloadUrl: data.downloadUrl, fileName: data.fileName };
    } catch (err: any) {
      console.error('[MixFlow Deliveries] Download error:', err);
      setError(err.message || 'Failed to start download.');
      return null;
    } finally {
      setDownloadingId(null);
    }
  };

  return {
    deliveries,
    loading,
    error,
    releasing,
    releaseError,
    downloadingId,
    canReleaseDelivery,
    fetchDeliveries,
    releaseDelivery,
    getDownloadUrl,
  };
}
