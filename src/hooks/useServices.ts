import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  ServiceRecord, 
  ProjectServiceRecord, 
  ServiceInsertInput 
} from '../types/service';

export interface ProjectServiceAssignmentRecord {
  id: string;
  project_service_id: string;
  user_id: string;
  created_at: string;
}

export function useServices(projectId?: string) {
  const { organization, role } = useAuth();
  const canManage = role === 'owner' || role === 'admin';

  const [availableServices, setAvailableServices] = useState<ServiceRecord[]>([]);
  const [projectServices, setProjectServices] = useState<ProjectServiceRecord[]>([]);
  const [assignments, setAssignments] = useState<ProjectServiceAssignmentRecord[]>([]);
  const [loadingServices, setLoadingServices] = useState<boolean>(true);
  const [loadingProjectServices, setLoadingProjectServices] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch available services from public.services (global + organization-scoped, active only)
  const fetchAvailableServices = useCallback(async () => {
    if (!organization?.id) {
      setAvailableServices([]);
      setLoadingServices(false);
      return;
    }

    setLoadingServices(true);
    const supabase = getSupabase();

    try {
      const { data, error: selectErr } = await supabase
        .from('services')
        .select('*')
        .or(`organization_id.eq.${organization.id},organization_id.is.null`)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (selectErr) {
        console.error('[MixFlow Services] Fetch error:', selectErr.message);
        setError(selectErr.message);
        setAvailableServices([]);
        return;
      }

      setAvailableServices((data as ServiceRecord[]) || []);
    } catch (err: any) {
      console.error('[MixFlow Services] Unexpected fetch exception:', err);
      setError(err?.message || 'Failed to load services catalog');
    } finally {
      setLoadingServices(false);
    }
  }, [organization?.id]);

  // 2. Fetch project services and assignments from Supabase
  const fetchProjectServices = useCallback(async (targetProjectId?: string) => {
    const pId = targetProjectId || projectId;
    if (!pId) {
      setProjectServices([]);
      setAssignments([]);
      return;
    }

    setLoadingProjectServices(true);
    const supabase = getSupabase();

    try {
      let loadedServices: ProjectServiceRecord[] = [];

      // PostgREST embeds service:services(*) via the foreign key
      const { data, error: pErr } = await supabase
        .from('project_services')
        .select('*, service:services(*)')
        .eq('project_id', pId)
        .order('created_at', { ascending: true });

      if (pErr) {
        console.error('[MixFlow Project Services] Fetch error:', pErr.message);
        // Fallback: fetch project_services then fetch services manually
        const { data: rawPs, error: rawErr } = await supabase
          .from('project_services')
          .select('*')
          .eq('project_id', pId)
          .order('created_at', { ascending: true });

        if (!rawErr && rawPs) {
          const sIds = Array.from(new Set(rawPs.map((r: any) => r.service_id)));
          let sMap: Record<string, ServiceRecord> = {};
          if (sIds.length > 0) {
            const { data: sData } = await supabase
              .from('services')
              .select('*')
              .in('id', sIds);
            if (sData) {
              sMap = (sData as ServiceRecord[]).reduce((acc, s) => {
                acc[s.id] = s;
                return acc;
              }, {} as Record<string, ServiceRecord>);
            }
          }

          loadedServices = rawPs.map((r: any) => ({
            ...r,
            service: sMap[r.service_id] || null,
          }));
        } else {
          loadedServices = [];
        }
      } else {
        loadedServices = (data as ProjectServiceRecord[]) || [];
      }

      setProjectServices(loadedServices);

      // Fetch assignments for the loaded project services
      const serviceIds = loadedServices.map((ps) => ps.id);
      if (serviceIds.length > 0) {
        const { data: assignmentData, error: aErr } = await supabase
          .from('project_service_assignments')
          .select('id, project_service_id, user_id, created_at')
          .in('project_service_id', serviceIds)
          .order('created_at', { ascending: true });

        if (!aErr && assignmentData) {
          setAssignments(assignmentData as ProjectServiceAssignmentRecord[]);
        } else {
          if (aErr) console.warn('[MixFlow Services] Assignments fetch note:', aErr.message);
          setAssignments([]);
        }
      } else {
        setAssignments([]);
      }
    } catch (err: any) {
      console.error('[MixFlow Project Services] Unexpected fetch exception:', err);
    } finally {
      setLoadingProjectServices(false);
    }
  }, [projectId]);

  // Helper to re-fetch assignments for current project services
  const fetchAssignments = useCallback(async (customServiceIds?: string[]) => {
    const supabase = getSupabase();
    const targetIds = customServiceIds || projectServices.map((ps) => ps.id);
    if (!targetIds || targetIds.length === 0) {
      setAssignments([]);
      return;
    }

    try {
      const { data: assignmentData, error: aErr } = await supabase
        .from('project_service_assignments')
        .select('id, project_service_id, user_id, created_at')
        .in('project_service_id', targetIds)
        .order('created_at', { ascending: true });

      if (!aErr && assignmentData) {
        setAssignments(assignmentData as ProjectServiceAssignmentRecord[]);
      }
    } catch (err: any) {
      console.warn('[MixFlow Services] fetchAssignments exception:', err);
    }
  }, [projectServices]);

  useEffect(() => {
    fetchAvailableServices();
  }, [fetchAvailableServices]);

  useEffect(() => {
    if (projectId) {
      fetchProjectServices(projectId);
    }
  }, [projectId, fetchProjectServices]);

  // 3. Create a custom service in public.services (idempotent, reusable by organization)
  const createCustomService = async (
    input: ServiceInsertInput
  ): Promise<{ service: ServiceRecord | null; error: Error | null }> => {
    if (!organization?.id) {
      return { service: null, error: new Error('No active organization found') };
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { service: null, error: new Error('Service name is required') };
    }

    // Case-insensitive check in current catalog scope to reuse existing service
    const normalizedName = trimmedName.toLowerCase();
    const existing = availableServices.find(
      (s) => s.name.trim().toLowerCase() === normalizedName
    );
    if (existing) {
      return { service: existing, error: null };
    }

    const supabase = getSupabase();
    const newServiceId = crypto.randomUUID();
    const payload = {
      id: newServiceId,
      name: trimmedName,
      description: input.description?.trim() || null,
      organization_id: organization.id,
      is_custom: true,
      is_active: true,
    };

    try {
      const { error: insErr } = await supabase
        .from('services')
        .insert(payload);

      if (insErr) {
        // If unique constraint error (23505 / services_name_unique_idx), gracefully fetch and return existing service
        if (
          insErr.code === '23505' || 
          insErr.message?.includes('services_name_unique_idx') || 
          insErr.message?.includes('duplicate key')
        ) {
          const { data: existingData } = await supabase
            .from('services')
            .select('*')
            .ilike('name', trimmedName)
            .limit(1);

          if (existingData && existingData.length > 0) {
            const existingService = existingData[0] as ServiceRecord;
            setAvailableServices((prev) => {
              if (prev.some((s) => s.id === existingService.id)) return prev;
              return [...prev, existingService].sort((a, b) => a.name.localeCompare(b.name));
            });
            return { service: existingService, error: null };
          }
        }
        return { service: null, error: new Error(insErr.message) };
      }

      const created: ServiceRecord = {
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setAvailableServices((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      return { service: created, error: null };
    } catch (err: any) {
      return { service: null, error: new Error(err?.message || 'Failed to create custom service') };
    }
  };

  // 4. Add a service to a project in public.project_services
  const addServiceToProject = async (
    targetProjectId: string,
    serviceId: string,
    initialStatus: string = 'Not Started'
  ): Promise<{ projectService: ProjectServiceRecord | null; error: Error | null }> => {
    const supabase = getSupabase();
    const newId = crypto.randomUUID();
    const serviceObj = availableServices.find((s) => s.id === serviceId);

    // Try title case first, fallback to snake_case if check constraint fails
    const payload = {
      id: newId,
      project_id: targetProjectId,
      service_id: serviceId,
      status: initialStatus,
    };

    try {
      let { error: insErr } = await supabase
        .from('project_services')
        .insert(payload);

      if (insErr && insErr.message?.includes('check constraint')) {
        // Fallback to snake_case
        const snakeStatus = initialStatus.toLowerCase().replace(/\s+/g, '_');
        const fallbackPayload = { ...payload, status: snakeStatus };
        const { error: retryErr } = await supabase
          .from('project_services')
          .insert(fallbackPayload);
        insErr = retryErr;
      }

      if (insErr) {
        return { projectService: null, error: new Error(insErr.message) };
      }

      const newRecord: ProjectServiceRecord = {
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        service: serviceObj || null,
      };

      setProjectServices((prev) => [...prev, newRecord]);
      return { projectService: newRecord, error: null };
    } catch (err: any) {
      return { projectService: null, error: new Error(err?.message || 'Failed to add service to project') };
    }
  };

  // 5. Update a project service status in public.project_services
  const updateProjectServiceStatus = async (
    projectServiceId: string,
    newStatus: string
  ): Promise<{ error: Error | null }> => {
    const supabase = getSupabase();

    try {
      let { error: updErr } = await supabase
        .from('project_services')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', projectServiceId);

      if (updErr && updErr.message?.includes('check constraint')) {
        const snakeStatus = newStatus.toLowerCase().replace(/\s+/g, '_');
        const { error: retryErr } = await supabase
          .from('project_services')
          .update({ status: snakeStatus, updated_at: new Date().toISOString() })
          .eq('id', projectServiceId);
        updErr = retryErr;
      }

      if (updErr) {
        return { error: new Error(updErr.message) };
      }

      setProjectServices((prev) =>
        prev.map((ps) => (ps.id === projectServiceId ? { ...ps, status: newStatus } : ps))
      );
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err?.message || 'Failed to update service status') };
    }
  };

  // 6. Update a project service deadline in public.project_services
  const updateProjectServiceDeadline = async (
    projectServiceId: string,
    deadline: string | null
  ): Promise<{ error: Error | null }> => {
    const supabase = getSupabase();

    try {
      const { error: updErr } = await supabase
        .from('project_services')
        .update({ deadline, updated_at: new Date().toISOString() })
        .eq('id', projectServiceId);

      if (updErr) {
        return { error: new Error(updErr.message) };
      }

      setProjectServices((prev) =>
        prev.map((ps) => (ps.id === projectServiceId ? { ...ps, deadline } : ps))
      );
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err?.message || 'Failed to update service deadline') };
    }
  };

  // 7. Remove a service from a project
  const removeProjectService = async (
    projectServiceId: string
  ): Promise<{ error: Error | null }> => {
    const supabase = getSupabase();

    try {
      const { error: delErr } = await supabase
        .from('project_services')
        .delete()
        .eq('id', projectServiceId);

      if (delErr) {
        return { error: new Error(delErr.message) };
      }

      setProjectServices((prev) => prev.filter((ps) => ps.id !== projectServiceId));
      setAssignments((prev) => prev.filter((a) => a.project_service_id !== projectServiceId));
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err?.message || 'Failed to remove service') };
    }
  };

  // 8. Assign a team member to a project service
  const assignTeamMember = async (
    projectServiceId: string,
    userId: string
  ): Promise<{ assignment: ProjectServiceAssignmentRecord | null; error: Error | null }> => {
    // In-memory check: if already assigned, return existing assignment idempotently
    const existing = assignments.find(
      (a) => a.project_service_id === projectServiceId && a.user_id === userId
    );
    if (existing) {
      return { assignment: existing, error: null };
    }

    const supabase = getSupabase();
    const newId = crypto.randomUUID();
    const payload = {
      id: newId,
      project_service_id: projectServiceId,
      user_id: userId,
    };

    try {
      const { data: insData, error: insErr } = await supabase
        .from('project_service_assignments')
        .insert(payload)
        .select()
        .single();

      if (insErr) {
        // Handle unique constraint (project_service_id, user_id) gracefully
        if (
          insErr.code === '23505' ||
          insErr.message?.includes('duplicate key') ||
          insErr.message?.includes('unique')
        ) {
          const { data: existingData } = await supabase
            .from('project_service_assignments')
            .select('id, project_service_id, user_id, created_at')
            .eq('project_service_id', projectServiceId)
            .eq('user_id', userId)
            .maybeSingle();

          if (existingData) {
            const existingRec = existingData as ProjectServiceAssignmentRecord;
            setAssignments((prev) => {
              if (prev.some((a) => a.id === existingRec.id)) return prev;
              return [...prev, existingRec];
            });
            return { assignment: existingRec, error: null };
          }
        }
        return { assignment: null, error: new Error(insErr.message) };
      }

      const created: ProjectServiceAssignmentRecord = (insData as ProjectServiceAssignmentRecord) || {
        ...payload,
        created_at: new Date().toISOString(),
      };

      setAssignments((prev) => {
        if (prev.some((a) => a.id === created.id)) return prev;
        return [...prev, created];
      });

      return { assignment: created, error: null };
    } catch (err: any) {
      return { assignment: null, error: new Error(err?.message || 'Failed to assign team member') };
    }
  };

  // 8. Remove a team member assignment from a project service
  const removeTeamMember = async (
    assignmentId: string
  ): Promise<{ error: Error | null }> => {
    const supabase = getSupabase();

    try {
      const { error: delErr } = await supabase
        .from('project_service_assignments')
        .delete()
        .eq('id', assignmentId);

      if (delErr) {
        return { error: new Error(delErr.message) };
      }

      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err?.message || 'Failed to remove team member assignment') };
    }
  };

  // 9. Helper to get all assignments for a specific project service
  const getAssignmentsForService = useCallback(
    (projectServiceId: string): ProjectServiceAssignmentRecord[] => {
      return assignments.filter((a) => a.project_service_id === projectServiceId);
    },
    [assignments]
  );

  return {
    availableServices,
    projectServices,
    assignments,
    loadingServices,
    loadingProjectServices,
    error,
    fetchAvailableServices,
    fetchProjectServices,
    fetchAssignments,
    createCustomService,
    addServiceToProject,
    updateProjectServiceStatus,
    updateProjectServiceDeadline,
    removeProjectService,
    assignTeamMember,
    removeTeamMember,
    getAssignmentsForService,
    canManage,
  };
}
