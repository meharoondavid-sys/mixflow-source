export interface ProjectFileRecord {
  id: string;
  organization_id: string;
  project_id: string;
  song_id: string | null;
  name: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploader_name?: string | null;
  uploader_email?: string | null;
  uploader_role?: 'client' | 'studio';
  created_at: string;
  updated_at: string;
}

export interface RequestUploadUrlInput {
  fileName: string;
  fileType: string;
  fileSize: number;
  songId?: string | null;
}

export interface ConfirmUploadInput {
  fileId: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  songId?: string | null;
}
