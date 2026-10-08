import { ClientRecord } from './client';

export type ProjectType = 'single' | 'ep' | 'album';

export type ProjectStatus = 
  | 'inquiry'
  | 'awaiting_files'
  | 'in_production'
  | 'in_review'
  | 'needs_revision'
  | 'approved'
  | 'completed'
  | 'cancelled'
  | 'in-review'
  | 'revision-requested'
  | 'paid';

export interface ProjectRecord {
  id: string;
  organization_id: string;
  client_id: string;
  name: string;
  project_type: ProjectType;
  description: string | null;
  project_price: number;
  deposit_amount: number;
  deadline: string | null;
  status: ProjectStatus;
  project_code?: string;
  created_at: string;
  updated_at: string;
  // Hydrated references
  client?: ClientRecord | null;
  songs?: ProjectSongRecord[];
  service_count?: number;
}

export interface ProjectSongRecord {
  id: string;
  project_id: string;
  title: string;
  track_number: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SongInput {
  title: string;
  track_number: number;
}

export interface ProjectInsertInput {
  client_id: string;
  name: string;
  project_type: ProjectType;
  description?: string | null;
  project_price?: number;
  deposit_amount?: number;
  deadline?: string | null;
  status?: ProjectStatus;
  songs?: SongInput[];
}

export interface ProjectUpdateInput {
  client_id?: string;
  name?: string;
  project_type?: ProjectType;
  description?: string | null;
  project_price?: number;
  deposit_amount?: number;
  deadline?: string | null;
  status?: ProjectStatus;
}

export interface ProjectDiagnosticError {
  operation: 'projects.select' | 'projects.insert' | 'projects.update' | 'projects.delete' | 'project_songs.insert' | 'project_songs.select' | 'project_songs.delete' | 'project_songs.update';
  message: string;
  code: string | number;
  details?: string | null;
  hint?: string | null;
}

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; border: string }> = {
  inquiry: { label: 'Inquiry', color: 'text-zinc-300', bg: 'bg-zinc-800/60', border: 'border-zinc-700' },
  awaiting_files: { label: 'Awaiting Files', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  in_production: { label: 'In Production', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  in_review: { label: 'In Review', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  needs_revision: { label: 'Needs Revision', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  completed: { label: 'Completed', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  'in-review': { label: 'In Review', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  'revision-requested': { label: 'Needs Revision', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  paid: { label: 'Paid in Full', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
};
