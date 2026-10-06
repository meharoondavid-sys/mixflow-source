/**
 * Step 14: Final Delivery Foundation Types
 */

export type DeliverableType = 'master' | 'instrumental' | 'stems' | 'other';
export type DeliveryStatus = 'ready' | 'delivered';

export interface ProjectDeliveryRecord {
  id: string;
  organization_id: string;
  project_id: string;
  song_id: string | null;
  version_id: string;
  file_id: string | null;
  deliverable_type: DeliverableType;
  name: string;
  file_type: string | null;
  status: DeliveryStatus;
  released_by: string | null;
  released_by_name?: string;
  released_at: string | null;
  created_at: string;
  updated_at: string;
  // Hydrated details
  version_number?: number;
  file_size?: number;
  duration_seconds?: number | null;
  storage_path?: string;
  song_title?: string;
}

export interface CreateDeliveryInput {
  version_id: string;
  deliverable_type: DeliverableType;
  name: string;
  song_id?: string | null;
}

export interface DeliveryDownloadResponse {
  downloadUrl: string;
  fileName: string;
  expiresInSeconds: number;
  deliveryId: string;
  status: DeliveryStatus;
}
