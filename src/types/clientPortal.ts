export interface ClientPortalProjectSummary {
  id: string;
  organization_id: string;
  client_id: string;
  name: string;
  project_type: 'single' | 'ep' | 'album' | string;
  status: string;
  deadline: string | null;
  song_count: number;
  file_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClientPortalSongItem {
  id: string;
  project_id: string;
  title: string;
  track_number: number;
  status: string;
}

export interface ClientPortalFileItem {
  id: string;
  project_id: string;
  song_id: string | null;
  name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface ClientPortalProjectDetail {
  id: string;
  organization_id: string;
  client_id: string;
  name: string;
  project_type: string;
  description: string | null;
  status: string;
  deadline: string | null;
  project_price: number;
  deposit_amount: number;
  created_at: string;
  updated_at: string;
  songs: ClientPortalSongItem[];
  files: ClientPortalFileItem[];
}

export interface ClientPortalProfile {
  id: string;
  full_name: string;
  email: string | null;
  company_name: string | null;
  phone: string | null;
}
