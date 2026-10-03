import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  ClientRecord, 
  ClientInsertInput, 
  ClientUpdateInput, 
  ClientDiagnosticError,
  ClientProjectItem
} from '../types/client';

export function useClients() {
  const { organization, role } = useAuth();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<ClientDiagnosticError | null>(null);

  const canManageClients = role === 'owner' || role === 'admin';

  const extractDiagnostic = (
    operation: ClientDiagnosticError['operation'],
    err: any
  ): ClientDiagnosticError => {
    return {
      operation,
      message: err?.message || 'Unknown database operation error',
      code: err?.code || (err?.status ? String(err.status) : err?.name || 'UNKNOWN_ERROR'),
      details: err?.details || null,
      hint: err?.hint || null,
    };
  };

  const fetchClients = useCallback(async () => {
    if (!organization?.id) {
      setClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDiagnosticError(null);

    const supabase = getSupabase();

    try {
      // 1. Fetch clients for this organization
      const { data: clientsData, error: selectErr } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (selectErr) {
        const diag = extractDiagnostic('clients.select', selectErr);
        console.error('[MixFlow Clients] Fetch error:', diag);
        setError('Unable to load clients. Please check your connection or database setup.');
        setDiagnosticError(diag);
        setClients([]);
        return;
      }

      // 2. Fetch project counts for all clients in this organization
      const projectCountMap: Record<string, number> = {};
      try {
        const { data: projectRows, error: projErr } = await supabase
          .from('projects')
          .select('id, client_id')
          .eq('organization_id', organization.id);

        if (!projErr && projectRows) {
          projectRows.forEach((p) => {
            if (p.client_id) {
              projectCountMap[p.client_id] = (projectCountMap[p.client_id] || 0) + 1;
            }
          });
        }
      } catch (countErr) {
        console.warn('[MixFlow Clients] Note: unable to query project counts:', countErr);
      }

      // 3. Assemble clients with project counts
      const enrichedClients: ClientRecord[] = (clientsData || []).map((c) => ({
        ...c,
        project_count: projectCountMap[c.id] || 0,
      }));

      setClients(enrichedClients);
    } catch (err: unknown) {
      const diag = extractDiagnostic('clients.select', err);
      console.error('[MixFlow Clients] Unexpected fetch error:', diag);
      setError('An unexpected error occurred while fetching clients.');
      setDiagnosticError(diag);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Fetch associated projects for a specific client
  const fetchClientProjects = async (
    clientId: string
  ): Promise<{ projects: ClientProjectItem[]; error: Error | null }> => {
    if (!organization?.id || !clientId) {
      return { projects: [], error: null };
    }

    const supabase = getSupabase();
    try {
      const { data, error: projErr } = await supabase
        .from('projects')
        .select('id, name, project_type, status, project_price, deposit_amount, deadline, created_at')
        .eq('client_id', clientId)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (projErr) {
        console.error('[MixFlow Clients] Fetch client projects error:', projErr.message);
        return { projects: [], error: new Error(projErr.message) };
      }

      const formatted: ClientProjectItem[] = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        project_type: row.project_type,
        status: row.status,
        project_price: Number(row.project_price) || 0,
        deposit_amount: Number(row.deposit_amount) || 0,
        deadline: row.deadline || null,
        created_at: row.created_at,
      }));

      return { projects: formatted, error: null };
    } catch (err: any) {
      console.error('[MixFlow Clients] Unexpected project query error:', err);
      return { projects: [], error: new Error(err?.message || 'Failed to fetch associated projects') };
    }
  };

  const createClient = async (
    input: ClientInsertInput
  ): Promise<{ client: ClientRecord | null; error: Error | null; diagnostic?: ClientDiagnosticError | null }> => {
    if (!organization?.id) {
      const err = new Error('No active studio organization found. Please ensure you are signed in to a studio.');
      return { client: null, error: err };
    }

    if (!canManageClients) {
      const err = new Error('Only studio Owners and Admins have permission to add new clients.');
      return { client: null, error: err };
    }

    if (!input.full_name?.trim()) {
      const err = new Error('Full Name is required to add a client.');
      return { client: null, error: err };
    }

    setError(null);
    setDiagnosticError(null);
    const supabase = getSupabase();
    const newClientId = crypto.randomUUID();

    try {
      // 1. Insert without .select() to prevent Postgres RLS RETURNING policy evaluation race
      const { error: insertErr } = await supabase
        .from('clients')
        .insert({
          id: newClientId,
          organization_id: organization.id,
          full_name: input.full_name.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          company_name: input.company_name?.trim() || null,
          notes: input.notes?.trim() || null,
        });

      if (insertErr) {
        const diag = extractDiagnostic('clients.insert', insertErr);
        console.error('[MixFlow Clients] Insert error:', diag);
        setError(`Failed to create client: ${insertErr.message}`);
        setDiagnosticError(diag);
        return { client: null, error: new Error(insertErr.message), diagnostic: diag };
      }

      // 2. Fetch the created client record
      const { data: createdRecord } = await supabase
        .from('clients')
        .select('*')
        .eq('id', newClientId)
        .eq('organization_id', organization.id)
        .maybeSingle();

      const finalRecord: ClientRecord = {
        ...(createdRecord || {
          id: newClientId,
          organization_id: organization.id,
          full_name: input.full_name.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          company_name: input.company_name?.trim() || null,
          notes: input.notes?.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        project_count: 0,
      };

      setClients((prev) => [finalRecord, ...prev]);
      return { client: finalRecord, error: null };
    } catch (err: unknown) {
      const diag = extractDiagnostic('clients.insert', err);
      console.error('[MixFlow Clients] Unexpected insert exception:', diag);
      const msg = err instanceof Error ? err.message : 'Failed to save client';
      setError(msg);
      setDiagnosticError(diag);
      return { client: null, error: new Error(msg), diagnostic: diag };
    }
  };

  const updateClient = async (
    id: string,
    input: ClientUpdateInput
  ): Promise<{ client: ClientRecord | null; error: Error | null; diagnostic?: ClientDiagnosticError | null }> => {
    if (!organization?.id) {
      return { client: null, error: new Error('No active studio organization found.') };
    }

    if (!canManageClients) {
      return { client: null, error: new Error('Only studio Owners and Admins have permission to edit clients.') };
    }

    if (input.full_name !== undefined && !input.full_name.trim()) {
      return { client: null, error: new Error('Full Name cannot be empty.') };
    }

    setError(null);
    setDiagnosticError(null);
    const supabase = getSupabase();

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.full_name !== undefined) payload.full_name = input.full_name.trim();
    if (input.email !== undefined) payload.email = input.email?.trim() || null;
    if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
    if (input.company_name !== undefined) payload.company_name = input.company_name?.trim() || null;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;

    try {
      const { error: updateErr } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', id)
        .eq('organization_id', organization.id);

      if (updateErr) {
        const diag = extractDiagnostic('clients.update', updateErr);
        console.error('[MixFlow Clients] Update error:', diag);
        setError(`Failed to update client: ${updateErr.message}`);
        setDiagnosticError(diag);
        return { client: null, error: new Error(updateErr.message), diagnostic: diag };
      }

      // Fetch the updated record
      const { data: updatedRecord } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('organization_id', organization.id)
        .maybeSingle();

      setClients((prev) =>
        prev.map((c) => {
          if (c.id === id) {
            return {
              ...(updatedRecord || { ...c, ...payload }),
              project_count: c.project_count ?? 0,
            };
          }
          return c;
        })
      );

      const resolvedClient: ClientRecord = {
        ...(updatedRecord || (payload as any)),
        id,
        organization_id: organization.id,
      };

      return { client: resolvedClient, error: null };
    } catch (err: unknown) {
      const diag = extractDiagnostic('clients.update', err);
      console.error('[MixFlow Clients] Unexpected update exception:', diag);
      const msg = err instanceof Error ? err.message : 'Failed to update client';
      setError(msg);
      setDiagnosticError(diag);
      return { client: null, error: new Error(msg), diagnostic: diag };
    }
  };

  const deleteClient = async (
    id: string
  ): Promise<{ error: Error | null; diagnostic?: ClientDiagnosticError | null }> => {
    if (!organization?.id) {
      return { error: new Error('No active studio organization found.') };
    }

    if (!canManageClients) {
      return { error: new Error('Only studio Owners and Admins have permission to delete clients.') };
    }

    // Safety constraint: Verify client has no associated projects
    // Prevents orphaning or foreign key constraint violation (ON DELETE RESTRICT)
    const targetClient = clients.find((c) => c.id === id);
    if (targetClient && (targetClient.project_count ?? 0) > 0) {
      return {
        error: new Error(
          `Cannot delete client "${targetClient.full_name}" because they have ${targetClient.project_count} associated studio project(s). Please reassign or delete their projects first.`
        ),
      };
    }

    setError(null);
    setDiagnosticError(null);
    const supabase = getSupabase();

    try {
      const { error: deleteErr } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .eq('organization_id', organization.id);

      if (deleteErr) {
        const diag = extractDiagnostic('clients.delete', deleteErr);
        console.error('[MixFlow Clients] Delete error:', diag);
        // If PostgreSQL ON DELETE RESTRICT foreign key triggers
        if (deleteErr.code === '23503') {
          const safeMsg = 'Cannot delete client: foreign key constraint RESTRICT prevents deleting clients with existing studio projects.';
          setError(safeMsg);
          return { error: new Error(safeMsg), diagnostic: diag };
        }
        setError(`Failed to delete client: ${deleteErr.message}`);
        setDiagnosticError(diag);
        return { error: new Error(deleteErr.message), diagnostic: diag };
      }

      setClients((prev) => prev.filter((c) => c.id !== id));
      return { error: null };
    } catch (err: unknown) {
      const diag = extractDiagnostic('clients.delete', err);
      console.error('[MixFlow Clients] Unexpected delete exception:', diag);
      const msg = err instanceof Error ? err.message : 'Failed to delete client';
      setError(msg);
      setDiagnosticError(diag);
      return { error: new Error(msg), diagnostic: diag };
    }
  };

  return {
    clients,
    loading,
    error,
    diagnosticError,
    fetchClients,
    fetchClientProjects,
    createClient,
    updateClient,
    deleteClient,
    canManageClients,
    role,
    organization,
  };
}
