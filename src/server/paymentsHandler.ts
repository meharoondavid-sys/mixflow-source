import { createClient } from '@supabase/supabase-js';
import { ProjectPaymentRecord, CreatePaymentInput, PaymentStatus } from '../types/payment.js';
import { createNotification } from './notificationsHandler.js';

interface PaymentsHandlerContext {
  authHeader?: string;
  projectId: string;
  body?: any;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  createClientFn?: typeof createClient;
}

// In-memory fallback ledger for dev environments when live table is not yet provisioned in remote PostgREST
let inMemoryPayments: ProjectPaymentRecord[] = [];

// Exported for testing harness
export function __resetInMemoryPayments() {
  inMemoryPayments = [];
}

export function __getInMemoryPayments() {
  return inMemoryPayments;
}

export function __seedInMemoryPayment(payment: ProjectPaymentRecord) {
  inMemoryPayments.push(payment);
}

// Helper to authenticate caller from Bearer token
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
 * 1. List payments for a project
 * Allowed for:
 * - Any organization member belonging to the project's organization
 * - The specific client assigned to the project (isolated to their own project)
 */
export async function handleListProjectPayments(
  ctx: PaymentsHandlerContext
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

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

  // Check access authorization
  let isAuthorized = false;

  // Check 1: Org membership
  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (membership) {
    isAuthorized = true;
  } else {
    // Check 2: Assigned client
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
    return { status: 403, body: { error: 'Forbidden. You do not have permission to view payments for this project.' } };
  }

  // Database is authoritative for payment history.
  try {
    const { data, error } = await adminClient
      .from('project_payments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      return { status: 500, body: { error: 'Failed to load project payments.' } };
    }

    return { status: 200, body: { payments: data || [] } };
  } catch (_e) {
    return { status: 500, body: { error: 'Failed to load project payments.' } };
  }
}

/**
 * 2. Record / Create a new project payment
 * Allowed ONLY for:
 * - Organization owner, admin, or finance
 * Rejects:
 * - Non-numeric or negative amounts
 * - Invalid status values
 * - Unauthorized callers (clients, engineers without finance role, unauthenticated)
 * - Mismatched cross-organization projects
 */
export async function handleCreateProjectPayment(
  ctx: PaymentsHandlerContext
): Promise<{ status: number; body: any }> {
  const { authHeader, projectId, body, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = ctx;
  const createClientFn = ctx.createClientFn || createClient;

  const authRes = await authenticateUser({ authHeader, supabaseUrl, supabaseAnonKey, createClientFn });
  if ('error' in authRes) {
    return { status: authRes.status, body: { error: authRes.error } };
  }
  const callerUser = authRes.user;

  // Validate Input
  const { amount, currency, status, payment_method, reference, paid_at } = body || {};

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 0) {
    return {
      status: 400,
      body: { error: 'Invalid payment amount. Amount must be a non-negative number.' },
    };
  }

  const validStatuses: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];
  const paymentStatus: PaymentStatus = status || 'paid';
  if (!validStatuses.includes(paymentStatus)) {
    return {
      status: 400,
      body: { error: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}` },
    };
  }

  const adminClient = createClientFn(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify Project
  const { data: project, error: projErr } = await adminClient
    .from('projects')
    .select('id, organization_id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projErr || !project) {
    return { status: 404, body: { error: 'Project not found.' } };
  }

  // Check Role: Only owner, admin, or finance can create payments
  const { data: membership } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', callerUser.id)
    .maybeSingle();

  const allowedRoles = ['owner', 'admin', 'finance'];
  if (!membership || !allowedRoles.includes(membership.role)) {
    return {
      status: 403,
      body: { error: 'Forbidden. Only organization owners, admins, or finance managers can record payments.' },
    };
  }

  const now = new Date().toISOString();
  let paymentRecord: ProjectPaymentRecord = {
    id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    organization_id: project.organization_id,
    project_id: project.id,
    client_id: project.client_id || null,
    amount: numAmount,
    currency: (currency || 'INR').trim().toUpperCase(),
    status: paymentStatus,
    payment_method: payment_method?.trim() || null,
    reference: reference?.trim() || null,
    paid_at: paid_at || (paymentStatus === 'paid' ? now : null),
    created_at: now,
    updated_at: now,
  };

  // Database is authoritative for financial records.
  try {
    const { data: inserted, error: insertErr } = await adminClient
      .from('project_payments')
      .insert({
        organization_id: paymentRecord.organization_id,
        project_id: paymentRecord.project_id,
        client_id: paymentRecord.client_id,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        status: paymentRecord.status,
        payment_method: paymentRecord.payment_method,
        reference: paymentRecord.reference,
        paid_at: paymentRecord.paid_at,
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      return { status: 500, body: { error: 'Failed to record payment.' } };
    }

    paymentRecord = { ...paymentRecord, ...inserted };
  } catch (_e) {
    return { status: 500, body: { error: 'Failed to record payment.' } };
  }

  // Step 15 Notification: Notify client when payment is recorded
  if (project.client_id) {
    try {
      const { data: clientData } = await adminClient
        .from('clients')
        .select('user_id')
        .eq('id', project.client_id)
        .maybeSingle();

      if (clientData?.user_id) {
        const sym = paymentRecord.currency === 'INR' ? '₹' : '$';
        await createNotification(
          { supabaseUrl, supabaseServiceRoleKey, createClientFn },
          {
            organization_id: project.organization_id,
            project_id: project.id,
            recipient_user_id: clientData.user_id,
            actor_user_id: callerUser.id,
            type: 'payment_recorded',
            title: 'Payment Recorded',
            message: `A payment of ${sym}${paymentRecord.amount} has been recorded for your project.`,
            link_url: `#/client/project/${project.id}`,
          }
        );
      }
    } catch (_e) {
      // Non-blocking notification
    }
  }

  inMemoryPayments.push(paymentRecord);
  return { status: 201, body: { payment: paymentRecord } };
}
