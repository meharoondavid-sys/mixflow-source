export type ServiceStatus = 
  | 'Not Started' 
  | 'In Progress' 
  | 'In Review' 
  | 'Completed' 
  | 'Blocked'
  | 'not_started'
  | 'in_progress'
  | 'in_review'
  | 'completed'
  | 'blocked';

export interface ServiceRecord {
  id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  is_custom: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectServiceRecord {
  id: string;
  project_id: string;
  service_id: string;
  status: string;
  deadline?: string | null;
  created_at: string;
  updated_at: string;
  service?: ServiceRecord | null;
}

export interface ServiceInsertInput {
  name: string;
  description?: string | null;
  organization_id?: string | null;
  is_custom?: boolean;
}

export interface ProjectServiceInsertInput {
  project_id: string;
  service_id: string;
  status?: string;
  deadline?: string | null;
}

export const STANDARD_SERVICES: { name: string; description: string }[] = [
  { name: 'Mixing', description: 'Multi-track balancing, equalization, spatial panning, dynamic control, and harmonic processing.' },
  { name: 'Mastering', description: 'Final stereo/spatial loudness optimization, tonal polish, and platform-ready delivery encoding.' },
  { name: 'Composition', description: 'Original musical writing, melodic themes, harmonic structures, and foundational cue composition.' },
  { name: 'Background Score', description: 'Cinematic, documentary, game, and media musical scoring tailored to visual scenes and narrative pace.' },
  { name: 'Audio Editing', description: 'Timing corrections, crossfading, noise cleanup, breaths removal, and comping raw tracking takes.' },
  { name: 'Vocal Production', description: 'Detailed vocal tuning (pitch correction), formant alignment, vocoder, doubling, and time alignment.' },
  { name: 'Music Production', description: 'Full track production, beat making, instrumentation, sample design, and sonic direction.' },
  { name: 'Sound Design', description: 'Custom foley, synthesis, ambient textures, SFX creation, and transitional acoustic impacts.' },
  { name: 'Stem Mixing', description: 'Subgroup/stem balancing for live playback, sync licensing, and broadcast broadcast delivery.' },
  { name: 'Audio Restoration', description: 'Spectral noise reduction, declipping, de-humming, and legacy recording de-reverberation.' },
  { name: 'Post Production', description: 'Dialogue editing, ADR synchronization, loudness compliance (LUFS), and surround/immersive passes.' },
  { name: 'Arrangement', description: 'Structural song formatting, section transitions, melodic counterpoints, and build-up pacing.' },
  { name: 'Orchestration', description: 'Acoustic orchestral voicing, string/brass arrangement, MIDI orchestration, and score formatting.' },
];

export const SERVICE_STATUS_OPTIONS: { value: string; label: string; color: string; bg: string; border: string }[] = [
  { 
    value: 'Not Started', 
    label: 'Not Started', 
    color: 'text-zinc-400', 
    bg: 'bg-zinc-800/80', 
    border: 'border-zinc-700' 
  },
  { 
    value: 'In Progress', 
    label: 'In Progress', 
    color: 'text-sky-400', 
    bg: 'bg-sky-500/10', 
    border: 'border-sky-500/30' 
  },
  { 
    value: 'In Review', 
    label: 'In Review', 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/30' 
  },
  { 
    value: 'Completed', 
    label: 'Completed', 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/30' 
  },
  { 
    value: 'Blocked', 
    label: 'Blocked', 
    color: 'text-red-400', 
    bg: 'bg-red-500/10', 
    border: 'border-red-500/30' 
  },
];

export function getServiceStatusConfig(status: string) {
  const normalized = status?.toLowerCase().replace(/_/g, ' ').trim();
  const found = SERVICE_STATUS_OPTIONS.find(
    (opt) => opt.value.toLowerCase() === normalized || opt.label.toLowerCase() === normalized
  );
  return found || {
    value: status,
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    color: 'text-zinc-300',
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
  };
}
