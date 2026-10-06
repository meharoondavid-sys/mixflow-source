import { createClient } from '@supabase/supabase-js';
import { createNotification } from './notificationsHandler.js';
import {
  DeliverableType,
  DeliveryStatus,
  ProjectDeliveryRecord,
  CreateDeliveryInput,
} from '../types/delivery.js';

export interface FinalDeliveryHandlerContext {
  authHeader?: string;
  projectId: string;
  deliveryId?: string;
  body?: any;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

export interface FinalDeliveryHandlerResult {
  status: number;
  body: any;
}

const VALID_DELIVERABLE_TYPES: DeliverableType[] = ['master', 'instrumental', 'stems', 'other'];

// In-memory ledger fallback for live responsiveness and automated testing suites
let inMemoryDeliveries: ProjectDeliveryRecord[] = [];

export function __resetInMemoryDeliveries(): void {
  inMemoryDeliveries = [];
}

export function __seedInMemoryDelivery(record: ProjectDeliveryRecord): void {
  inMemoryDeliveries.push(record);
}

export function __getInMemoryDeliveries(): ProjectDeliveryRecord[] {
  return inMemoryDeliveries;
}

// Helper: Authenticate user from Bearer token
async function authenticateUser(ctx: {
  authHeader?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  createClientFn: typeof createClient;
}): Promise<{ error: string; status: number } | { user: any }> {
  const { authHeader, supabaseUrl, supabaseAnonKey, createClientFn } = ctx;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Authentication required. Bearer token missing.', status: 401 };
  }
  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  if (!token) {
    return { error: 'Authentication required. Empty token provided.', status: 401 };
  }

  const userClient = createClientFn(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { error: 'Invalid or expired authentication session.', status: 401 };
  }

  return { user: userData.user };
}

/**
 * 1. List Final Deliveries for a Project
 * GET /api/projects/:projectId/deliveries
 */
export async function handleListProjectDeliveries(
  ctx: FinalDeliveryHandlerContext
): Promise<FinalDeliveryHandlerResult> {
  const { authHeader, projectId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, createClientFn = createClient } = ctx;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify project exists
  const { data: project, error: projErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Check authorization: Studio member OR assigned client
  let isAuthorized = false;

  // Check studio member
  const { data: member } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (member) {
    isAuthorized = true;
  } else {
    // Check assigned client
    const { data: client } = await adminClient
      .from('clients')
      .select('id, user_id')
      .eq('id', project.client_id)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (client) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return { status: 403, body: { error: 'Forbidden. You do not have permission to view deliveries for this project.' } };
  }

  // Database is authoritative for delivery history.
  try {
    const { data, error } = await adminClient
      .from('project_deliveries')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      return { status: 500, body: { error: 'Failed to load project deliveries.' } };
    }

    return { status: 200, body: { deliveries: data || [] } };
  } catch (_e) {
    return { status: 500, body: { error: 'Failed to load project deliveries.' } };
  }
}

/**
 * 2. Create / Release Final Delivery
 * POST /api/projects/:projectId/deliveries
 * Authorized: owner, admin, engineer
 */
export async function handleCreateProjectDelivery(
  ctx: FinalDeliveryHandlerContext
): Promise<FinalDeliveryHandlerResult> {
  const { authHeader, projectId, body, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, createClientFn = createClient } = ctx;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify project exists
  const { data: project, error: projErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id, name')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Verify caller role: MUST be owner, admin, or engineer
  const { data: member } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  const allowedRoles = ['owner', 'admin', 'engineer'];
  if (!member || !allowedRoles.includes(member.role)) {
    return {
      status: 403,
      body: { error: 'Forbidden. Only owner, admin, or engineer can release final deliverables.' },
    };
  }

  // Validate request body
  const { version_id, deliverable_type, name, song_id } = (body || {}) as CreateDeliveryInput;

  if (!version_id || typeof version_id !== 'string') {
    return { status: 400, body: { error: 'version_id is required.' } };
  }

  if (!deliverable_type || !VALID_DELIVERABLE_TYPES.includes(deliverable_type)) {
    return {
      status: 400,
      body: { error: `deliverable_type must be one of: ${VALID_DELIVERABLE_TYPES.join(', ')}` },
    };
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return { status: 400, body: { error: 'name is required.' } };
  }

  // Verify version exists and belongs to this project
  const { data: version, error: vErr } = await adminClient
    .from('project_file_versions')
    .select('id, organization_id, project_id, song_id, file_id, version_number, name, storage_path, file_type, file_size, duration_seconds')
    .eq('id', version_id)
    .maybeSingle();

  if (vErr || !version) {
    return { status: 400, body: { error: 'The specified audio version does not exist.' } };
  }

  if (version.project_id !== projectId || version.organization_id !== project.organization_id) {
    return { status: 400, body: { error: 'The specified version does not belong to this project or organization.' } };
  }

  // Validate song relationship if provided
  if (song_id && version.song_id && song_id !== version.song_id) {
    return { status: 400, body: { error: 'Song ID does not match the song attached to this version.' } };
  }

  // Eligibility check: A version with unresolved revision requests must not be released as final
  try {
    const { data: openFeedback } = await adminClient
      .from('project_feedback')
      .select('id')
      .eq('version_id', version_id)
      .eq('status', 'open');

    if (openFeedback && openFeedback.length > 0) {
      return {
        status: 400,
        body: {
          error: `Cannot release version ${version.version_number} as final deliverable: this version has ${openFeedback.length} unresolved revision feedback note(s). All feedback must be resolved before final release.`,
        },
      };
    }
  } catch (_e) {
    // Ignore if table schema check
  }

  // Duplicate Protection: Prevent duplicate active deliveries for same project, song, deliverable_type, and version
  const checkSongId = song_id || version.song_id || null;

  // Check in-memory first
  const duplicateInMemory = inMemoryDeliveries.find(
    (d) =>
      d.project_id === projectId &&
      (d.song_id || null) === (checkSongId || null) &&
      d.deliverable_type === deliverable_type &&
      d.version_id === version_id
  );
  if (duplicateInMemory) {
    return {
      status: 409,
      body: { error: `A final deliverable of type '${deliverable_type}' for version ${version.version_number} has already been released.` },
    };
  }

  // Check database
  try {
    let query = adminClient
      .from('project_deliveries')
      .select('id')
      .eq('project_id', projectId)
      .eq('deliverable_type', deliverable_type)
      .eq('version_id', version_id);

    if (checkSongId) {
      query = query.eq('song_id', checkSongId);
    }

    const { data: existingDelivery } = await query.maybeSingle();
    if (existingDelivery) {
      return {
        status: 409,
        body: { error: `A final deliverable of type '${deliverable_type}' for version ${version.version_number} has already been released.` },
      };
    }
  } catch (_e) {
    // Continue
  }

  const now = new Date().toISOString();
  let deliveryRecord: ProjectDeliveryRecord = {
    id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    organization_id: project.organization_id,
    project_id: projectId,
    song_id: checkSongId,
    version_id: version_id,
    file_id: version.file_id || null,
    deliverable_type: deliverable_type,
    name: name.trim(),
    file_type: version.file_type || null,
    status: 'ready',
    released_by: callerUser.id,
    released_by_name: callerUser.user_metadata?.full_name || callerUser.email?.split('@')[0] || 'Studio Engineer',
    released_at: now,
    created_at: now,
    updated_at: now,
    version_number: version.version_number,
    file_size: version.file_size,
    duration_seconds: version.duration_seconds,
    storage_path: version.storage_path,
  };

  // Database is authoritative for final-delivery records.
  try {
    const { data: inserted, error: insertErr } = await adminClient
      .from('project_deliveries')
      .insert({
        organization_id: deliveryRecord.organization_id,
        project_id: deliveryRecord.project_id,
        song_id: deliveryRecord.song_id,
        version_id: deliveryRecord.version_id,
        file_id: deliveryRecord.file_id,
        deliverable_type: deliveryRecord.deliverable_type,
        name: deliveryRecord.name,
        file_type: deliveryRecord.file_type,
        status: deliveryRecord.status,
        released_by: deliveryRecord.released_by,
        released_at: deliveryRecord.released_at,
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      return { status: 500, body: { error: 'Failed to release final deliverable.' } };
    }

    deliveryRecord = { ...deliveryRecord, ...inserted };
  } catch (_e) {
    return { status: 500, body: { error: 'Failed to release final deliverable.' } };
  }

  // Step 15 Notification: Notify client when final deliverable is released
  if (project.client_id) {
    try {
      const { data: clientData } = await adminClient
        .from('clients')
        .select('user_id')
        .eq('id', project.client_id)
        .maybeSingle();

      if (clientData?.user_id) {
        await createNotification(
          { supabaseUrl, supabaseServiceRoleKey, createClientFn },
          {
            organization_id: project.organization_id,
            project_id: projectId,
            recipient_user_id: clientData.user_id,
            actor_user_id: callerUser.id,
            type: 'delivery_released',
            title: 'Final Master Files Ready',
            message: `Your final deliverable '${deliveryRecord.name}' is now available for download.`,
            link_url: `#/client/project/${projectId}`,
          }
        );
      }
    } catch (_e) {
      // Non-blocking notification
    }
  }

  inMemoryDeliveries.push(deliveryRecord);
  return { status: 201, body: { delivery: deliveryRecord } };
}

/**
 * 3. Secure Final Delivery Download URL
 * POST /api/projects/:projectId/deliveries/:deliveryId/download-url
 * Authorized: Studio staff & assigned client
 * Updates status from 'ready' -> 'delivered' upon client download request.
 */
export async function handleGetDeliveryDownloadUrl(
  ctx: FinalDeliveryHandlerContext
): Promise<FinalDeliveryHandlerResult> {
  const { authHeader, projectId, deliveryId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, createClientFn = createClient } = ctx;

  if (!deliveryId) {
    return { status: 400, body: { error: 'deliveryId parameter is required.' } };
  }

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify project exists
  const { data: project, error: projErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id, name')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Check authorization: Studio member OR assigned client
  let isStudioMember = false;
  let isAssignedClient = false;

  const { data: member } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (member) {
    isStudioMember = true;
  } else {
    const { data: client } = await adminClient
      .from('clients')
      .select('id, user_id')
      .eq('id', project.client_id)
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (client) {
      isAssignedClient = true;
    }
  }

  if (!isStudioMember && !isAssignedClient) {
    return { status: 403, body: { error: 'Forbidden. You do not have permission to download deliverables for this project.' } };
  }

  // Database is authoritative for delivery records.
  let delivery: ProjectDeliveryRecord | null = null;

  try {
    const { data, error } = await adminClient
      .from('project_deliveries')
      .select('*')
      .eq('id', deliveryId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      return { status: 500, body: { error: 'Failed to load final deliverable.' } };
    }

    if (data) delivery = data as ProjectDeliveryRecord;
  } catch (_e) {
    return { status: 500, body: { error: 'Failed to load final deliverable.' } };
  }

  if (!delivery) {
    delivery = inMemoryDeliveries.find((d) => d.id === deliveryId && d.project_id === projectId) || null;
  }

  if (!delivery) {
    return { status: 404, body: { error: 'Final deliverable record not found.' } };
  }

  // Retrieve underlying version to get storage_path.
  let storagePath: string | null = delivery.storage_path || null;

  if (!storagePath) {
    try {
      const { data: version, error: versionErr } = await adminClient
        .from('project_file_versions')
        .select('storage_path')
        .eq('id', delivery.version_id)
        .maybeSingle();

      if (versionErr) {
        return { status: 500, body: { error: 'Failed to load final file information.' } };
      }
      storagePath = version?.storage_path || null;
    } catch (_e) {
      return { status: 500, body: { error: 'Failed to load final file information.' } };
    }
  }

  if (!storagePath) {
    return { status: 500, body: { error: 'Final deliverable has no storage file.' } };
  }

  // Generate short-lived signed URL (60 seconds)
  const expiresInSeconds = 60;
  let downloadUrl = '';

  try {
    const { data: signedData, error: signErr } = await adminClient.storage
      .from('project-files')
      .createSignedUrl(storagePath, expiresInSeconds, {
        download: delivery.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
      });

    if (signErr || !signedData?.signedUrl) {
      return { status: 500, body: { error: 'Failed to create secure download link.' } };
    }

    downloadUrl = signedData.signedUrl;
  } catch (_e) {
    return { status: 500, body: { error: 'Failed to create secure download link.' } };
  }

  // Audit: If caller is assigned client and status was 'ready', update to 'delivered'
  let newStatus: DeliveryStatus = delivery.status;
  if (isAssignedClient && delivery.status === 'ready') {
    newStatus = 'delivered';
    delivery.status = 'delivered';
    delivery.updated_at = new Date().toISOString();

    // Update in DB
    try {
      const { error: updateErr } = await adminClient
        .from('project_deliveries')
        .update({ status: 'delivered', updated_at: delivery.updated_at })
        .eq('id', deliveryId);

      if (updateErr) {
        return { status: 500, body: { error: 'Failed to record delivery download.' } };
      }
    } catch (_e) {
      return { status: 500, body: { error: 'Failed to record delivery download.' } };
    }

    // Update in memory
    const memIdx = inMemoryDeliveries.findIndex((d) => d.id === deliveryId);
    if (memIdx !== -1) {
      inMemoryDeliveries[memIdx].status = 'delivered';
      inMemoryDeliveries[memIdx].updated_at = delivery.updated_at;
    }
  }

  return {
    status: 200,
    body: {
      downloadUrl,
      fileName: `${delivery.name}`,
      expiresInSeconds,
      deliveryId: delivery.id,
      status: newStatus,
    },
  };
}
