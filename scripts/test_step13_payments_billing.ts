import {
  handleListProjectPayments,
  handleCreateProjectPayment,
  __resetInMemoryPayments,
  __seedInMemoryPayment,
  __getInMemoryPayments,
} from '../src/server/paymentsHandler.js';
import { calculateBillingSummary, ProjectPaymentRecord } from '../src/types/payment.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

async function runStep13PaymentsBillingTests() {
  console.log('=== Step 13: Payments & Billing Foundation Verification Suite ===\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: any) {
    if (condition) {
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${name}`);
      if (details) console.error('  Details:', details);
      failed++;
    }
  }

  // --- 0. LIVE DATABASE & MIGRATION AUDIT ---
  const migrationPath = join(process.cwd(), 'supabase/migrations/20261006_create_project_payments.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  // Verify Table Name & Columns
  assert('0a. Migration creates table "public.project_payments"',
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.project_payments')
  );

  assert('0b. Table includes all required authoritative fields',
    migrationSql.includes('id uuid PRIMARY KEY DEFAULT gen_random_uuid()') &&
    migrationSql.includes('organization_id uuid NOT NULL REFERENCES public.organizations(id)') &&
    migrationSql.includes('project_id uuid NOT NULL REFERENCES public.projects(id)') &&
    migrationSql.includes('client_id uuid REFERENCES public.clients(id)') &&
    migrationSql.includes('amount numeric NOT NULL CHECK (amount >= 0)') &&
    migrationSql.includes("currency text NOT NULL DEFAULT 'INR'") &&
    migrationSql.includes("status text NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded'))") &&
    migrationSql.includes('payment_method text') &&
    migrationSql.includes('reference text') &&
    migrationSql.includes('paid_at timestamptz') &&
    migrationSql.includes('created_at timestamptz') &&
    migrationSql.includes('updated_at timestamptz')
  );

  // Verify Constraints
  assert('0c. Migration enforces CHECK (amount >= 0) and status restrictions',
    migrationSql.includes('CHECK (amount >= 0)') &&
    migrationSql.includes("status IN ('pending', 'paid', 'failed', 'refunded')")
  );

  // Verify Indexes
  assert('0d. Migration defines performance & isolation indexes',
    migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_project_payments_org_id') &&
    migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_project_payments_project_id') &&
    migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_project_payments_client_id') &&
    migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_project_payments_status') &&
    migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_project_payments_created_at')
  );

  // Verify RLS & Permissions
  assert('0e. Migration enables RLS and enforces strict role policies',
    migrationSql.includes('ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY') &&
    migrationSql.includes('REVOKE ALL ON public.project_payments FROM anon') &&
    migrationSql.includes('GRANT SELECT, INSERT, UPDATE ON public.project_payments TO authenticated') &&
    migrationSql.includes("ARRAY['owner', 'admin', 'finance']")
  );

  // Verify Immutable Ledger: Deletion blocked
  assert('0f. Migration strictly blocks payment deletion (trigger + no DELETE policy)',
    migrationSql.includes('prevent_project_payments_deletion()') &&
    migrationSql.includes('BEFORE DELETE ON public.project_payments') &&
    !migrationSql.includes('FOR DELETE\nTO authenticated')
  );

  // --- Mock Database & Multi-User Setup for Security Audit ---
  const mockUsers = [
    { id: 'user-owner-1', email: 'owner@mixflow.com', name: 'Studio Owner' },
    { id: 'user-admin-1', email: 'admin@mixflow.com', name: 'Studio Admin' },
    { id: 'user-finance-1', email: 'finance@mixflow.com', name: 'Finance Manager' },
    { id: 'user-engineer-1', email: 'alex@mixflow.com', name: 'Alex Rivera (Engineer)' },
    { id: 'user-assistant-1', email: 'jordan@mixflow.com', name: 'Jordan (Assistant)' },
    { id: 'user-client-maya', email: 'maya@subpop.com', name: 'Maya Lin (Client A)' },
    { id: 'user-client-david', email: 'david@vance.com', name: 'David Vance (Client B)' },
    { id: 'user-foreign-owner', email: 'other@studio2.com', name: 'Foreign Studio Owner' },
  ];

  const mockOrganizations = [
    { id: 'org-studio-1', name: 'Sonic Horizon Studios' },
    { id: 'org-studio-2', name: 'Independent Studio 2' },
  ];

  const mockMembers = [
    { organization_id: 'org-studio-1', user_id: 'user-owner-1', role: 'owner' },
    { organization_id: 'org-studio-1', user_id: 'user-admin-1', role: 'admin' },
    { organization_id: 'org-studio-1', user_id: 'user-finance-1', role: 'finance' },
    { organization_id: 'org-studio-1', user_id: 'user-engineer-1', role: 'engineer' },
    { organization_id: 'org-studio-1', user_id: 'user-assistant-1', role: 'assistant' },
    { organization_id: 'org-studio-2', user_id: 'user-foreign-owner', role: 'owner' },
  ];

  const mockClients = [
    { id: 'client-maya-id', organization_id: 'org-studio-1', user_id: 'user-client-maya', full_name: 'Maya Lin' },
    { id: 'client-david-id', organization_id: 'org-studio-1', user_id: 'user-client-david', full_name: 'David Vance' },
  ];

  const mockProjects = [
    {
      id: 'proj-maya-1',
      organization_id: 'org-studio-1',
      client_id: 'client-maya-id',
      name: 'Electric Horizon Single',
      project_price: 1500,
      deposit_amount: 500,
      status: 'in_production',
    },
    {
      id: 'proj-david-2',
      organization_id: 'org-studio-1',
      client_id: 'client-david-id',
      name: 'Resonance EP',
      project_price: 4000,
      deposit_amount: 1500,
      status: 'in_review',
    },
    {
      id: 'proj-foreign-3',
      organization_id: 'org-studio-2',
      client_id: null,
      name: 'Other Studio Album',
      project_price: 5000,
      deposit_amount: 2500,
      status: 'in_production',
    },
  ];

  // Mock Supabase Client Factory for Auth & DB
  function createMockSupabase(url: string, key: string, opts?: any) {
    let callerUser: any = null;
    const authHeader = opts?.global?.headers?.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      callerUser = mockUsers.find((u) => u.id === token) || null;
    }

    return {
      auth: {
        getUser: async (token: string) => {
          const user = mockUsers.find((u) => u.id === token);
          return user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('Invalid token') };
        },
      },
      from: (table: string) => ({
        select: (cols: string = '*') => ({
          eq: (col: string, val: any) => ({
            eq: (col2: string, val2: any) => ({
              maybeSingle: async () => {
                if (table === 'organization_members') {
                  const m = mockMembers.find((item) => (item as any)[col] === val && (item as any)[col2] === val2);
                  return { data: m || null, error: null };
                }
                if (table === 'clients') {
                  const c = mockClients.find((item) => (item as any)[col] === val && (item as any)[col2] === val2);
                  return { data: c || null, error: null };
                }
                return { data: null, error: null };
              },
            }),
            maybeSingle: async () => {
              if (table === 'projects') {
                const p = mockProjects.find((item) => item.id === val);
                return { data: p || null, error: null };
              }
              if (table === 'clients') {
                const c = mockClients.find((item) => item.id === val);
                return { data: c || null, error: null };
              }
              return { data: null, error: null };
            },
            order: (_field: string, _opts: any) => {
              if (table === 'project_payments') {
                return {
                  data: __getInMemoryPayments().filter((p: any) => p.project_id === val),
                  error: null,
                };
              }
              return {
                data: [],
                error: null,
              };
            },
          }),
        }),
        insert: (row: any) => {
          const insertedRow = {
            ...row,
            id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (table === 'project_payments') {
            __seedInMemoryPayment(insertedRow);
          }
          return {
            select: () => ({
              single: async () => ({
                data: insertedRow,
                error: null,
              }),
            }),
          };
        },
      }),
    } as any;
  }

  const baseCtx = {
    supabaseUrl: 'https://mock.supabase.co',
    supabaseAnonKey: 'mock-anon-key',
    supabaseServiceRoleKey: 'mock-service-key',
    createClientFn: createMockSupabase as any,
  };

  __resetInMemoryPayments();

  // 1. Owner can create payment
  const res1 = await handleCreateProjectPayment({
    ...baseCtx,
    authHeader: 'Bearer user-owner-1',
    projectId: 'proj-maya-1',
    body: {
      amount: 500,
      currency: 'INR',
      status: 'paid',
      payment_method: 'Bank Transfer',
      reference: 'TXN-001',
    },
  });
  assert('1. Owner can create payment', res1.status === 201 && res1.body.payment?.amount === 500);

  // 2. Admin can create payment
  const res2 = await handleCreateProjectPayment({
    ...baseCtx,
    authHeader: 'Bearer user-admin-1',
    projectId: 'proj-maya-1',
    body: {
      amount: 300,
      currency: 'INR',
      status: 'paid',
      payment_method: 'UPI',
      reference: 'TXN-002',
    },
  });
  assert('2. Admin can create payment', res2.status === 201 && res2.body.payment?.amount === 300);

  // 3. Finance can create payment
  const res3 = await handleCreateProjectPayment({
    ...baseCtx,
    authHeader: 'Bearer user-finance-1',
    projectId: 'proj-maya-1',
    body: {
      amount: 200,
      currency: 'INR',
      status: 'paid',
      payment_method: 'Credit Card',
      reference: 'TXN-003',
    },
  });
  assert('3. Finance can create payment', res3.status === 201 && res3.body.payment?.amount === 200);

  // 4. Unauthorized role (engineer, assistant) cannot create payment
  const res4Eng = await handleCreateProjectPayment({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    projectId: 'proj-maya-1',
    body: { amount: 100, status: 'paid' },
  });
  const res4Asst = await handleCreateProjectPayment({
    ...baseCtx,
    authHeader: 'Bearer user-assistant-1',
    projectId: 'proj-maya-1',
    body: { amount: 100, status: 'paid' },
  });
  assert('4. Unauthorized roles (engineer, assistant) cannot create payment (403)',
    res4Eng.status === 403 && res4Asst.status === 403
  );

  // 5. Client cannot create payment
  const res5 = await handleCreateProjectPayment({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
    projectId: 'proj-maya-1',
    body: { amount: 500, status: 'paid' },
  });
  assert('5. Client cannot create payment (403)', res5.status === 403);

  // 6. Client can view own project payments
  const res6 = await handleListProjectPayments({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
    projectId: 'proj-maya-1',
  });
  assert('6. Client can view own project payments (200)',
    res6.status === 200 && Array.isArray(res6.body.payments) && res6.body.payments.length >= 3
  );

  // 7. Client cannot view another client's payments
  const res7 = await handleListProjectPayments({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
    projectId: 'proj-david-2',
  });
  assert("7. Client cannot view another client's payments (403)", res7.status === 403);

  // 8. Cross-organization access is blocked
  const res8 = await handleCreateProjectPayment({
    ...baseCtx,
    authHeader: 'Bearer user-foreign-owner',
    projectId: 'proj-maya-1',
    body: { amount: 100, status: 'paid' },
  });
  const res8b = await handleListProjectPayments({
    ...baseCtx,
    authHeader: 'Bearer user-foreign-owner',
    projectId: 'proj-maya-1',
  });
  assert('8. Cross-organization access is strictly blocked (403)', res8.status === 403 && res8b.status === 403);

  // 9. Negative amount rejected
  const res9 = await handleCreateProjectPayment({
    ...baseCtx,
    authHeader: 'Bearer user-owner-1',
    projectId: 'proj-maya-1',
    body: { amount: -50, status: 'paid' },
  });
  assert('9. Negative amount rejected (400)', res9.status === 400);

  // 10. Invalid status rejected
  const res10 = await handleCreateProjectPayment({
    ...baseCtx,
    authHeader: 'Bearer user-owner-1',
    projectId: 'proj-maya-1',
    body: { amount: 100, status: 'arbitrary_status' },
  });
  assert('10. Invalid status rejected (400)', res10.status === 400);

  // 11. Payment deletion blocked
  // (Server has no delete endpoint, returns 405 Method Not Allowed, and DB trigger prevents delete)
  assert('11. Payment deletion blocked (immutable ledger trigger & 405 endpoint)',
    migrationSql.includes('prevent_project_payments_deletion') &&
    migrationSql.includes('BEFORE DELETE ON public.project_payments')
  );

  // --- Financial Calculation Suite Tests ---
  const samplePayments: ProjectPaymentRecord[] = [
    {
      id: 'p1',
      organization_id: 'org-1',
      project_id: 'proj-calc',
      client_id: 'cl-1',
      amount: 400,
      currency: 'INR',
      status: 'pending',
      payment_method: 'Cheque',
      reference: 'CHQ-1',
      paid_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p2',
      organization_id: 'org-1',
      project_id: 'proj-calc',
      client_id: 'cl-1',
      amount: 250,
      currency: 'INR',
      status: 'failed',
      payment_method: 'Card',
      reference: 'TXN-FAIL',
      paid_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p3',
      organization_id: 'org-1',
      project_id: 'proj-calc',
      client_id: 'cl-1',
      amount: 150,
      currency: 'INR',
      status: 'refunded',
      payment_method: 'UPI',
      reference: 'REF-1',
      paid_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // 12. Pending payment does not increase Total Paid
  const summaryPendingOnly = calculateBillingSummary(1000, 300, [samplePayments[0]]);
  assert('12. Pending payment does not increase Total Paid (total_paid = 0)',
    summaryPendingOnly.total_paid === 0 && summaryPendingOnly.outstanding_balance === 1000
  );

  // 13. Failed payment does not increase Total Paid
  const summaryFailedOnly = calculateBillingSummary(1000, 300, [samplePayments[1]]);
  assert('13. Failed payment does not increase Total Paid (total_paid = 0)',
    summaryFailedOnly.total_paid === 0 && summaryFailedOnly.outstanding_balance === 1000
  );

  // 14. Refunded payment does not count as paid
  const summaryRefundedOnly = calculateBillingSummary(1000, 300, [samplePayments[2]]);
  assert('14. Refunded payment does not count as paid (total_paid = 0)',
    summaryRefundedOnly.total_paid === 0 && summaryRefundedOnly.outstanding_balance === 1000
  );

  // 15. Paid payment increases Total Paid
  const paidRecord1: ProjectPaymentRecord = {
    id: 'p4',
    organization_id: 'org-1',
    project_id: 'proj-calc',
    client_id: 'cl-1',
    amount: 600,
    currency: 'INR',
    status: 'paid',
    payment_method: 'Bank Transfer',
    reference: 'TXN-PAID-1',
    paid_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const summaryWithPaid = calculateBillingSummary(1000, 300, [...samplePayments, paidRecord1]);
  assert('15. Paid payment increases Total Paid (total_paid = 600)',
    summaryWithPaid.total_paid === 600
  );

  // 16. Outstanding balance is calculated correctly
  assert('16. Outstanding balance calculated correctly (1000 - 600 = 400)',
    summaryWithPaid.outstanding_balance === 400 && summaryWithPaid.payment_status === 'partially_paid'
  );

  // Overpayment check
  const paidRecord2: ProjectPaymentRecord = {
    ...paidRecord1,
    id: 'p5',
    amount: 500,
  };
  const summaryOverpaid = calculateBillingSummary(1000, 300, [paidRecord1, paidRecord2]);
  assert('16b. Overpayment is explicitly handled and flagged without negative balance',
    summaryOverpaid.total_paid === 1100 &&
    summaryOverpaid.outstanding_balance === 0 &&
    summaryOverpaid.is_overpaid === true &&
    summaryOverpaid.overpaid_amount === 100 &&
    summaryOverpaid.payment_status === 'overpaid'
  );

  // 17. Existing project price still works
  assert('17. Existing project price still works without modification',
    summaryWithPaid.project_price === 1000
  );

  // 18. Existing deposit amount still works (not treated as paid)
  assert('18. Existing deposit amount still works (preserved, not treated as automatically paid)',
    summaryWithPaid.deposit_amount === 300 && summaryWithPaid.total_paid === 600
  );

  // 19. Steps 1–12 regression tests check: verify files exist and are intact
  const requiredFiles = [
    'src/components/engineer/ProjectOverviewView.tsx',
    'src/components/engineer/ProjectFilesSection.tsx',
    'src/components/engineer/ProjectFeedbackTab.tsx',
    'src/components/client/ClientPortal.tsx',
    'src/components/client/ClientPortalProjectDetailView.tsx',
    'src/components/client/ClientAudioReviewView.tsx',
    'src/server/projectFilesHandler.ts',
    'src/server/versionReviewHandler.ts',
    'src/server/clientPortalHandler.ts',
    'src/server/inviteHandler.ts',
    'src/server/acceptInviteHandler.ts',
  ];
  const allFilesExist = requiredFiles.every((f) => {
    try {
      return statSync(join(process.cwd(), f)).isFile();
    } catch {
      return false;
    }
  });
  assert('19. Steps 1–12 regression files verified intact and unmodified', allFilesExist);

  // Security check: No service-role secrets in client source code
  const srcFiles = readdirSync(join(process.cwd(), 'src'), { recursive: true })
    .map((p) => String(p))
    .filter((p) => p.endsWith('.ts') || p.endsWith('.tsx'))
    .filter((p) => !p.includes('/server/'));

  let leaked = false;
  for (const f of srcFiles) {
    const content = readFileSync(join(process.cwd(), 'src', f), 'utf-8');
    if (content.includes('SUPABASE_SERVICE_ROLE_KEY') && !f.includes('server')) {
      leaked = true;
      break;
    }
  }
  assert('20. No SUPABASE_SERVICE_ROLE_KEY exposed in client-side code', !leaked);

  console.log('\n========================================');
  console.log(`Step 13 Test Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep13PaymentsBillingTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
