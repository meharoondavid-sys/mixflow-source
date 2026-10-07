import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProjectsContext } from '../context/ProjectsContext';
import { 
  ProjectRecord, 
  ProjectSongRecord, 
  ProjectInsertInput, 
  ProjectUpdateInput, 
  ProjectDiagnosticError,
  SongInput
} from '../types/project';
import { ClientRecord } from '../types/client';

export function useProjects() {
  const context = useProjectsContext();
  if (context) {
    return context;
  }

  // Fallback if rendered outside of ProjectsProvider
  const { organization, role } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<ProjectDiagnosticError | null>(null);
  const [isTableMissing, setIsTableMissing] = useState<boolean>(false);

  const canManageProjects = role === 'owner' || role === 'admin';

  const extractDiagnostic = (
    operation: ProjectDiagnosticError['operation'],
    err: any
  ): ProjectDiagnosticError => {
    return {
      operation,
      message: err?.message || 'Unknown database operation error',
      code: err?.code || (err?.status ? String(err.status) : err?.name || 'UNKNOWN_ERROR'),
      details: err?.details || null,
      hint: err?.hint || null,
    };
  };

  const fetchProjects = useCallback(async () => {
    if (!organization?.id) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDiagnosticError(null);

    const supabase = getSupabase();

    try {
      const { data: rawProjects, error: selectErr } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (selectErr) {
        const diag = extractDiagnostic('projects.select', selectErr);
        if (selectErr.code === 'PGRST205' || selectErr.message?.includes('schema cache')) {
          setIsTableMissing(true);
          setError(null);
          setDiagnosticError(null);
          setProjects([]);
          setLoading(false);
          return;
        }

        console.error('[MixFlow Projects] Fetch error:', diag);
        setError('Unable to load projects. Please verify your connection or database setup.');
        setDiagnosticError(diag);
        setProjects([]);
        setLoading(false);
        return;
      }

      setIsTableMissing(false);

      if (!rawProjects || rawProjects.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const projectIds = rawProjects.map((p) => p.id);
      const clientIds = Array.from(new Set(rawProjects.map((p) => p.client_id)));

      let clientsMap: Record<string, ClientRecord> = {};
      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('*')
          .in('id', clientIds);

        if (clientsData) {
          clientsMap = clientsData.reduce((acc, c) => {
            acc[c.id] = c;
            return acc;
          }, {} as Record<string, ClientRecord>);
        }
      }

      let songsMap: Record<string, ProjectSongRecord[]> = {};
      if (projectIds.length > 0) {
        const { data: songsData } = await supabase
          .from('project_songs')
          .select('*')
          .in('project_id', projectIds)
          .order('track_number', { ascending: true });

        if (songsData) {
          songsMap = songsData.reduce((acc, s) => {
            if (!acc[s.project_id]) acc[s.project_id] = [];
            acc[s.project_id].push(s);
            return acc;
          }, {} as Record<string, ProjectSongRecord[]>);
        }
      }

      // Fetch service counts from public.project_services where practical
      let servicesCountMap: Record<string, number> = {};
      if (projectIds.length > 0) {
        try {
          const { data: psRows } = await supabase
            .from('project_services')
            .select('id, project_id')
            .in('project_id', projectIds);

          if (psRows) {
            psRows.forEach((r: any) => {
              if (r.project_id) {
                servicesCountMap[r.project_id] = (servicesCountMap[r.project_id] || 0) + 1;
              }
            });
          }
        } catch (serviceErr) {
          console.warn('[MixFlow Projects] Optional service counts query notice:', serviceErr);
        }
      }

      const hydratedProjects: ProjectRecord[] = rawProjects.map((p) => ({
        ...p,
        project_price: Number(p.project_price) || 0,
        deposit_amount: Number(p.deposit_amount) || 0,
        currency: p.currency || 'INR',
        client: clientsMap[p.client_id] || null,
        songs: songsMap[p.id] || [],
        service_count: servicesCountMap[p.id] || 0,
      }));

      setProjects(hydratedProjects);
    } catch (err: unknown) {
      const diag = extractDiagnostic('projects.select', err);
      if (diag.code === 'PGRST205' || diag.message?.includes('schema cache')) {
        setIsTableMissing(true);
        setError(null);
        setProjects([]);
      } else {
        console.error('[MixFlow Projects] Unexpected fetch error:', diag);
        setError('An unexpected error occurred while fetching projects.');
        setDiagnosticError(diag);
        setProjects([]);
      }
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (
    input: ProjectInsertInput
  ): Promise<{ project: ProjectRecord | null; error: Error | null; diagnostic?: ProjectDiagnosticError | null }> => {
    if (!organization?.id) {
      const err = new Error('No active studio organization found. Please sign in to a studio.');
      return { project: null, error: err };
    }

    if (!canManageProjects) {
      const err = new Error('Only studio Owners and Admins have permission to create projects.');
      return { project: null, error: err };
    }

    if (!input.name?.trim()) {
      return { project: null, error: new Error('Project Name is required.') };
    }

    if (!input.client_id) {
      return { project: null, error: new Error('Client selection is required.') };
    }

    if (input.project_price !== undefined && Number(input.project_price) < 0) {
      return { project: null, error: new Error('Project price cannot be negative.') };
    }

    if (input.deposit_amount !== undefined && Number(input.deposit_amount) < 0) {
      return { project: null, error: new Error('Deposit amount cannot be negative.') };
    }

    const priceNum = input.project_price !== undefined ? Number(input.project_price) || 0 : 0;
    const depositNum = input.deposit_amount !== undefined ? Number(input.deposit_amount) || 0 : 0;

    if (depositNum > priceNum) {
      return { project: null, error: new Error('Deposit amount cannot exceed total project price.') };
    }

    if (isTableMissing) {
      return { 
        project: null, 
        error: new Error("The 'public.projects' table has not been created yet in Supabase. Please run the SQL migration script first.") 
      };
    }

    setError(null);
    setDiagnosticError(null);
    const supabase = getSupabase();

    try {
      const { data: verifiedClient, error: clientVerifyErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', input.client_id)
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (clientVerifyErr || !verifiedClient) {
        return { 
          project: null, 
          error: new Error('Invalid client: Selected client does not belong to your studio organization.') 
        };
      }

      const newProjectId = crypto.randomUUID();
      const projectPayload = {
        id: newProjectId,
        organization_id: organization.id,
        client_id: input.client_id,
        name: input.name.trim(),
        project_type: input.project_type,
        description: input.description?.trim() || null,
        project_price: priceNum,
        deposit_amount: depositNum,
        currency: input.currency || 'INR',
        deadline: input.deadline || null,
        status: input.status || 'inquiry',
      };

      const { error: insertErr } = await supabase
        .from('projects')
        .insert(projectPayload);

      if (insertErr) {
        const diag = extractDiagnostic('projects.insert', insertErr);
        if (insertErr.code === 'PGRST205' || insertErr.message?.includes('schema cache')) {
          setIsTableMissing(true);
          const friendlyMsg = "The database table 'public.projects' is not created yet. Please execute the SQL migration in Supabase SQL Editor.";
          return { project: null, error: new Error(friendlyMsg), diagnostic: diag };
        }

        console.error('[MixFlow Projects] Insert error:', diag);
        setError(`Failed to create project: ${insertErr.message}`);
        setDiagnosticError(diag);
        return { project: null, error: new Error(insertErr.message), diagnostic: diag };
      }

      const createdSongs: ProjectSongRecord[] = [];
      let songsToInsert: { id: string; project_id: string; title: string; track_number: number; status: string }[] = [];

      if (input.project_type === 'single') {
        const songTitle = input.songs?.[0]?.title?.trim() || input.name.trim();
        songsToInsert.push({
          id: crypto.randomUUID(),
          project_id: newProjectId,
          title: songTitle,
          track_number: 1,
          bpm: input.songs?.[0]?.bpm ?? null,
          status: 'in_production',
        });
      } else {
        if (input.songs && input.songs.length > 0) {
          songsToInsert = input.songs
            .filter((s) => s.title && s.title.trim())
            .map((s, idx) => ({
              id: crypto.randomUUID(),
              project_id: newProjectId,
              title: s.title.trim(),
              track_number: s.track_number && s.track_number > 0 ? s.track_number : idx + 1,
              status: 'in_production',
            }));
        } else {
          songsToInsert.push({
            id: crypto.randomUUID(),
            project_id: newProjectId,
            title: `${input.name.trim()} (Track 1)`,
            track_number: 1,
            status: 'in_production',
          });
        }
      }

      if (songsToInsert.length > 0) {
        const { error: songsInsertErr } = await supabase
          .from('project_songs')
          .insert(songsToInsert);

        if (songsInsertErr) {
          console.warn('[MixFlow Projects] Project songs insert notice:', songsInsertErr.message);
        } else {
          songsToInsert.forEach((s) => {
            createdSongs.push({
              ...s,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          });
        }
      }

      const finalProject: ProjectRecord = {
        ...projectPayload,
        project_price: priceNum,
        deposit_amount: depositNum,
        client: verifiedClient,
        songs: createdSongs,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setProjects((prev) => [finalProject, ...prev]);
      return { project: finalProject, error: null };
    } catch (err: unknown) {
      const diag = extractDiagnostic('projects.insert', err);
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      setError(msg);
      setDiagnosticError(diag);
      return { project: null, error: new Error(msg), diagnostic: diag };
    }
  };

  const updateProject = async (
    id: string,
    input: ProjectUpdateInput
  ): Promise<{ project: ProjectRecord | null; error: Error | null; diagnostic?: ProjectDiagnosticError | null }> => {
    if (!organization?.id) {
      return { project: null, error: new Error('No active studio organization found.') };
    }

    if (!canManageProjects) {
      return { project: null, error: new Error('Only studio Owners and Admins have permission to edit projects.') };
    }

    if (input.name !== undefined && !input.name.trim()) {
      return { project: null, error: new Error('Project Name cannot be empty.') };
    }

    const currentProject = projects.find((p) => p.id === id);

    if (input.project_price !== undefined && Number(input.project_price) < 0) {
      return { project: null, error: new Error('Project price cannot be negative.') };
    }

    if (input.deposit_amount !== undefined && Number(input.deposit_amount) < 0) {
      return { project: null, error: new Error('Deposit amount cannot be negative.') };
    }

    const priceNum = input.project_price !== undefined 
      ? Number(input.project_price) || 0 
      : (currentProject?.project_price ?? 0);
    const depositNum = input.deposit_amount !== undefined 
      ? Number(input.deposit_amount) || 0 
      : (currentProject?.deposit_amount ?? 0);

    if (depositNum > priceNum) {
      return { project: null, error: new Error('Deposit amount cannot exceed total project price.') };
    }

    setError(null);
    setDiagnosticError(null);
    const supabase = getSupabase();

    if (input.client_id) {
      const { data: verifiedClient, error: clientVerifyErr } = await supabase
        .from('clients')
        .select('id')
        .eq('id', input.client_id)
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (clientVerifyErr || !verifiedClient) {
        return { 
          project: null, 
          error: new Error('Invalid client: Selected client does not belong to your studio organization.') 
        };
      }
    }

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.project_type !== undefined) payload.project_type = input.project_type;
    if (input.client_id !== undefined) payload.client_id = input.client_id;
    if (input.description !== undefined) payload.description = input.description?.trim() || null;
    if (input.project_price !== undefined) payload.project_price = priceNum;
    if (input.deposit_amount !== undefined) payload.deposit_amount = depositNum;
    if (input.deadline !== undefined) payload.deadline = input.deadline || null;
    if (input.status !== undefined) payload.status = input.status;

    try {
      const { error: updateErr } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', id)
        .eq('organization_id', organization.id);

      if (updateErr) {
        const diag = extractDiagnostic('projects.update', updateErr);
        console.error('[MixFlow Projects] Update error:', diag);
        setError(`Failed to update project: ${updateErr.message}`);
        setDiagnosticError(diag);
        return { project: null, error: new Error(updateErr.message), diagnostic: diag };
      }

      await fetchProjects();
      const updated = projects.find((p) => p.id === id) || null;
      return { project: updated, error: null };
    } catch (err: unknown) {
      const diag = extractDiagnostic('projects.update', err);
      console.error('[MixFlow Projects] Unexpected update exception:', diag);
      const msg = err instanceof Error ? err.message : 'Failed to update project';
      setError(msg);
      setDiagnosticError(diag);
      return { project: null, error: new Error(msg), diagnostic: diag };
    }
  };

  const deleteProject = async (
    id: string
  ): Promise<{ error: Error | null; diagnostic?: ProjectDiagnosticError | null }> => {
    if (!organization?.id) {
      return { error: new Error('No active studio organization found.') };
    }

    if (!canManageProjects) {
      return { error: new Error('Only studio Owners and Admins have permission to delete projects.') };
    }

    setError(null);
    setDiagnosticError(null);
    const supabase = getSupabase();

    try {
      const { error: deleteErr } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('organization_id', organization.id);

      if (deleteErr) {
        const diag = extractDiagnostic('projects.delete', deleteErr);
        console.error('[MixFlow Projects] Delete error:', diag);
        setError(`Failed to delete project: ${deleteErr.message}`);
        setDiagnosticError(diag);
        return { error: new Error(deleteErr.message), diagnostic: diag };
      }

      setProjects((prev) => prev.filter((p) => p.id !== id));
      return { error: null };
    } catch (err: unknown) {
      const diag = extractDiagnostic('projects.delete', err);
      console.error('[MixFlow Projects] Unexpected delete exception:', diag);
      const msg = err instanceof Error ? err.message : 'Failed to delete project';
      setError(msg);
      setDiagnosticError(diag);
      return { error: new Error(msg), diagnostic: diag };
    }
  };

  const addSongToProject = async (
    projectId: string,
    song: SongInput
  ): Promise<{ song: ProjectSongRecord | null; error: Error | null }> => {
    if (!canManageProjects) {
      return { song: null, error: new Error('Permission denied. Only studio Owners and Admins can add songs.') };
    }

    if (!song.title || !song.title.trim()) {
      return { song: null, error: new Error('Song title is required.') };
    }

    const trackNum = Number(song.track_number);
    if (!trackNum || trackNum <= 0) {
      return { song: null, error: new Error('Track number must be greater than 0.') };
    }

    const targetProject = projects.find((p) => p.id === projectId);
    if (targetProject?.songs?.some((s) => s.track_number === trackNum)) {
      return {
        song: null,
        error: new Error(`Track number ${trackNum} is already assigned to another song in this project.`),
      };
    }

    const supabase = getSupabase();
    const newSongId = crypto.randomUUID();
    const newSong = {
      id: newSongId,
      project_id: projectId,
      title: song.title.trim(),
      track_number: trackNum,
      status: 'in_production',
    };

    try {
      const { error: insertErr } = await supabase
        .from('project_songs')
        .insert(newSong);

      if (insertErr) {
        if (insertErr.code === '23505') {
          return { song: null, error: new Error(`Track number ${trackNum} is already assigned in this project.`) };
        }
        return { song: null, error: new Error(insertErr.message) };
      }

      const songRecord: ProjectSongRecord = {
        ...newSong,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            const updatedSongs = [...(p.songs || []), songRecord].sort(
              (a, b) => a.track_number - b.track_number
            );
            return { ...p, songs: updatedSongs };
          }
          return p;
        })
      );

      return { song: songRecord, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add song';
      return { song: null, error: new Error(msg) };
    }
  };

  const updateSong = async (
    projectId: string,
    songId: string,
    song: { title?: string; track_number?: number; status?: string }
  ): Promise<{ song: ProjectSongRecord | null; error: Error | null }> => {
    if (!canManageProjects) {
      return { song: null, error: new Error('Permission denied. Only studio Owners and Admins can edit songs.') };
    }

    if (song.title !== undefined && !song.title.trim()) {
      return { song: null, error: new Error('Song title cannot be empty.') };
    }

    const targetProject = projects.find((p) => p.id === projectId);

    if (song.track_number !== undefined) {
      const num = Number(song.track_number);
      if (!num || num <= 0) {
        return { song: null, error: new Error('Track number must be greater than 0.') };
      }
      if (targetProject?.songs?.some((s) => s.id !== songId && s.track_number === num)) {
        return {
          song: null,
          error: new Error(`Track number ${num} is already assigned to another song in this project.`),
        };
      }
    }

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (song.title !== undefined) payload.title = song.title.trim();
    if (song.track_number !== undefined) payload.track_number = Number(song.track_number);
    if (song.status !== undefined) payload.status = song.status;

    const supabase = getSupabase();
    try {
      const { error: updErr } = await supabase
        .from('project_songs')
        .update(payload)
        .eq('id', songId)
        .eq('project_id', projectId);

      if (updErr) {
        if (updErr.code === '23505') {
          return { song: null, error: new Error(`Track number is already assigned in this project.`) };
        }
        return { song: null, error: new Error(updErr.message) };
      }

      let updatedRecord: ProjectSongRecord | null = null;
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            const updatedSongs = (p.songs || [])
              .map((s) => {
                if (s.id === songId) {
                  updatedRecord = { ...s, ...payload };
                  return updatedRecord;
                }
                return s;
              })
              .sort((a, b) => a.track_number - b.track_number);
            return { ...p, songs: updatedSongs };
          }
          return p;
        })
      );

      return { song: updatedRecord, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update song';
      return { song: null, error: new Error(msg) };
    }
  };

  const deleteSong = async (
    projectId: string,
    songId: string
  ): Promise<{ error: Error | null }> => {
    if (!canManageProjects) {
      return { error: new Error('Permission denied.') };
    }

    const supabase = getSupabase();
    try {
      const { error: delErr } = await supabase
        .from('project_songs')
        .delete()
        .eq('id', songId)
        .eq('project_id', projectId);

      if (delErr) {
        return { error: new Error(delErr.message) };
      }

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            return { ...p, songs: (p.songs || []).filter((s) => s.id !== songId) };
          }
          return p;
        })
      );

      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete song';
      return { error: new Error(msg) };
    }
  };

  return {
    projects,
    loading,
    error,
    diagnosticError,
    isTableMissing,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    addSongToProject,
    updateSong,
    deleteSong,
    canManageProjects,
    role,
    organization,
  };
}
