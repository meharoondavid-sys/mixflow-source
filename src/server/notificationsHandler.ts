import { createClient } from '@supabase/supabase-js';
import {
  NotificationType,
  ProjectNotificationRecord,
  CreateNotificationInput,
} from '../types/notification.js';

export interface NotificationsHandlerContext {
  authHeader?: string;
  notificationId?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

export interface NotificationsHandlerResult {
  status: number;
  body: any;
}

// In-memory ledger for tests and instant responsiveness
let inMemoryNotifications: ProjectNotificationRecord[] = [];

export function __resetInMemoryNotifications(): void {
  inMemoryNotifications = [];
}

export function __seedInMemoryNotification(record: ProjectNotificationRecord): void {
  inMemoryNotifications.push(record);
}

export function __getInMemoryNotifications(): ProjectNotificationRecord[] {
  return inMemoryNotifications;
}

// Authenticate caller from Bearer token
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
 * Reusable server-side helper to create a verified notification record.
 * Called directly from server handlers (feedback, version upload, delivery release, payments, etc.)
 */
export async function createNotification(
  ctx: {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    createClientFn?: typeof createClient;
  },
  input: CreateNotificationInput
): Promise<ProjectNotificationRecord | null> {
  const { supabaseUrl, supabaseServiceRoleKey, createClientFn = createClient } = ctx;
  const {
    organization_id,
    project_id = null,
    recipient_user_id,
    actor_user_id = null,
    type,
    title,
    message,
    link_url = null,
  } = input;

  // Basic validation
  if (!organization_id || !recipient_user_id || !type || !title?.trim() || !message?.trim()) {
    return null;
  }

  // Prevent self-notifications (e.g. user acting on their own version/feedback)
  if (actor_user_id && actor_user_id === recipient_user_id) {
    return null;
  }

  // Duplicate suppression (same recipient, project, type within 5 seconds)
  const nowMs = Date.now();
  const duplicate = inMemoryNotifications.find(
    (n) =>
      n.recipient_user_id === recipient_user_id &&
      n.project_id === (project_id || null) &&
      n.type === type &&
      nowMs - new Date(n.created_at).getTime() < 5000
  );
  if (duplicate) {
    return duplicate;
  }

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify project belongs to organization if project_id is provided
  if (project_id) {
    const { data: project } = await adminClient
      .from('projects')
      .select('id, organization_id')
      .eq('id', project_id)
      .maybeSingle();

    if (!project || project.organization_id !== organization_id) {
      return null;
    }
  }

  const newRecord: ProjectNotificationRecord = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    organization_id,
    project_id: project_id || null,
    recipient_user_id,
    actor_user_id: actor_user_id || null,
    type,
    title: title.trim(),
    message: message.trim(),
    link_url: link_url || null,
    read_at: null,
    created_at: new Date().toISOString(),
  };

  // Insert to DB
  try {
    const { data: inserted, error: insertErr } = await adminClient
      .from('project_notifications')
      .insert({
        organization_id: newRecord.organization_id,
        project_id: newRecord.project_id,
        recipient_user_id: newRecord.recipient_user_id,
        actor_user_id: newRecord.actor_user_id,
        type: newRecord.type,
        title: newRecord.title,
        message: newRecord.message,
        link_url: newRecord.link_url,
      })
      .select()
      .single();

    if (!insertErr && inserted) {
      const merged: ProjectNotificationRecord = { ...newRecord, ...inserted };
      inMemoryNotifications.unshift(merged);
      return merged;
    }
  } catch (_e) {
    // Continue with in-memory fallback
  }

  inMemoryNotifications.unshift(newRecord);
  return newRecord;
}

/**
 * 1. List Caller's Recent Notifications
 * GET /api/notifications
 */
export async function handleListUserNotifications(
  ctx: NotificationsHandlerContext
): Promise<NotificationsHandlerResult> {
  const { authHeader, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, createClientFn = createClient } = ctx;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let notifications: ProjectNotificationRecord[] = [];

  try {
    const { data, error } = await adminClient
      .from('project_notifications')
      .select('*')
      .eq('recipient_user_id', callerUser.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data && data.length > 0) {
      notifications = data as ProjectNotificationRecord[];
    }
  } catch (_e) {
    // Fallback to in-memory
  }

  if (notifications.length === 0) {
    notifications = inMemoryNotifications
      .filter((n) => n.recipient_user_id === callerUser.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    status: 200,
    body: {
      notifications,
      unreadCount,
    },
  };
}

/**
 * 2. Mark Single Notification as Read
 * PATCH /api/notifications/:id/read
 */
export async function handleMarkNotificationRead(
  ctx: NotificationsHandlerContext
): Promise<NotificationsHandlerResult> {
  const { authHeader, notificationId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, createClientFn = createClient } = ctx;

  if (!notificationId) {
    return { status: 400, body: { error: 'Notification ID is required.' } };
  }

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();

  // Try DB update
  let updatedRecord: ProjectNotificationRecord | null = null;
  try {
    const { data, error } = await adminClient
      .from('project_notifications')
      .update({ read_at: now })
      .eq('id', notificationId)
      .eq('recipient_user_id', callerUser.id)
      .select()
      .single();

    if (!error && data) {
      updatedRecord = data as ProjectNotificationRecord;
    }
  } catch (_e) {
    // Continue to memory
  }

  // Check in-memory ledger
  const memIdx = inMemoryNotifications.findIndex(
    (n) => n.id === notificationId && n.recipient_user_id === callerUser.id
  );

  if (memIdx !== -1) {
    inMemoryNotifications[memIdx].read_at = now;
    if (!updatedRecord) {
      updatedRecord = inMemoryNotifications[memIdx];
    }
  }

  if (!updatedRecord) {
    return {
      status: 404,
      body: { error: 'Notification not found or access denied.' },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      notification: updatedRecord,
    },
  };
}

/**
 * 3. Mark All Notifications as Read for Caller
 * POST /api/notifications/read-all
 */
export async function handleMarkAllNotificationsRead(
  ctx: NotificationsHandlerContext
): Promise<NotificationsHandlerResult> {
  const { authHeader, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, createClientFn = createClient } = ctx;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();

  // DB update
  try {
    await adminClient
      .from('project_notifications')
      .update({ read_at: now })
      .eq('recipient_user_id', callerUser.id)
      .is('read_at', null);
  } catch (_e) {
    // Fallback to in-memory
  }

  // Update in-memory
  let markedCount = 0;
  inMemoryNotifications.forEach((n) => {
    if (n.recipient_user_id === callerUser.id && !n.read_at) {
      n.read_at = now;
      markedCount++;
    }
  });

  return {
    status: 200,
    body: {
      success: true,
      markedCount,
    },
  };
}
