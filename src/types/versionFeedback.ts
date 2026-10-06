export interface ProjectFileVersionRecord {
  id: string;
  organization_id: string;
  project_id: string;
  song_id: string | null;
  file_id: string | null;
  version_number: number;
  name: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  duration_seconds: number | null;
  notes: string | null;
  uploaded_by: string | null;
  uploader_name?: string;
  created_at: string;
  status: 'ready' | 'in_review' | 'revision_requested' | 'approved' | 'superseded';
  feedback_count?: number;
  open_feedback_count?: number;
  resolved_feedback_count?: number;
  is_latest?: boolean;
}

export interface ProjectFeedbackRecord {
  id: string;
  organization_id: string;
  project_id: string;
  song_id: string | null;
  version_id: string;
  client_id: string | null;
  author_id: string | null;
  author_name: string;
  author_role: 'client' | 'engineer' | 'producer' | 'owner' | 'admin';
  timestamp_seconds: number;
  comment: string;
  status: 'open' | 'resolved';
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface RequestVersionUploadUrlInput {
  songId?: string | null;
  fileId?: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  notes?: string;
}

export interface ConfirmVersionUploadInput {
  versionId: string;
  songId?: string | null;
  fileId?: string | null;
  fileName: string;
  storagePath: string;
  fileType: string;
  fileSize: number;
  durationSeconds?: number;
  notes?: string;
}

export interface CreateFeedbackInput {
  versionId: string;
  songId?: string | null;
  timestampSeconds: number;
  comment: string;
}

export interface UpdateFeedbackStatusInput {
  status: 'open' | 'resolved';
}
