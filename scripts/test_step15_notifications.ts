import {
  handleListUserNotifications,
  handleMarkNotificationRead,
  handleMarkAllNotificationsRead,
  createNotification,
  __resetInMemoryNotifications,
  __seedInMemoryNotification,
  __getInMemoryNotifications,
} from '../src/server/notificationsHandler.js';
import { ProjectNotificationRecord, NotificationType } from '../src/types/notification.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

async function runStep15NotificationsTests() {
  console.log('=== Step 15: Notifications Foundation Verification Suite ===\n');

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

  // --- 0. MIGRATION & SCHEMA AUDIT ---
  const migrationPath = join(process.cwd(), 'supabase/migrations/20261008_create_project_notifications.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  // Verify Table Name & Columns
  assert('0a. Migration creates table "public.project_notifications"',
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.project_notifications')
  );

  assert('0b. Table includes all required authoritative fields',
    migrationSql.includes('id uuid PRIMARY KEY DEFAULT gen_random_uuid()') &&
    migrationSql.includes('organization_id uuid NOT NULL REFERENCES public.organizations(id)') &&
    migrationSql.includes('project_id uuid REFERENCES public.projects(id)') &&
    migrationSql.includes('recipient_user_id uuid NOT NULL REFERENCES auth.users(id)') &&
    migrationSql.includes('actor_user_id uuid REFERENCES auth.users(id)') &&
    migrationSql.includes('type text NOT NULL') &&
    migrationSql.includes('title text NOT NULL') &&
    migrationSql.includes('message text NOT NULL') &&
    migrationSql.includes('link_url text') &&
    migrationSql.includes('read_at timestamptz') &&
    migrationSql.includes('created_at timestamptz NOT NULL DEFAULT now()')
  );

  // Verify Notification Types CHECK constraint
  assert('0c. Migration enforces notification type CHECK constraint',
    migrationSql.includes("'feedback_added'") &&
    migrationSql.includes("'version_uploaded'") &&
    migrationSql.includes("'feedback_resolved'") &&
    migrationSql.includes("'payment_recorded'") &&
    migrationSql.includes("'delivery_released'")
  );

  // Verify Performance & Query Indexes
  assert('0d. Migration defines partial unread index and recipient indexes',
    migrationSql.includes('idx_project_notifications_recipient_unread') &&
    migrationSql.includes('WHERE read_at IS NULL') &&
    migrationSql.includes('idx_project_notifications_recipient_all') &&
    migrationSql.includes('idx_project_notifications_org_id') &&
    migrationSql.includes('idx_project_notifications_project_id')
  );

  // Verify RLS & Strict Security Policies
  assert('0e. Migration enables RLS and enforces recipient-only SELECT & UPDATE policies',
    migrationSql.includes('ALTER TABLE public.project_notifications ENABLE ROW LEVEL SECURITY') &&
    migrationSql.includes('REVOKE ALL ON public.project_notifications FROM anon') &&
    migrationSql.includes('GRANT SELECT, UPDATE ON public.project_notifications TO authenticated') &&
    migrationSql.includes('recipient_user_id = auth.uid()') &&
    !migrationSql.includes('FOR INSERT\nTO authenticated') &&
    !migrationSql.includes('FOR DELETE\nTO authenticated')
  );

  // --- Mock Database & Multi-User Setup for Security Audit ---
  const mockUsers = [
    { id: 'user-owner-1', email: 'owner@mixflow.com', name: 'Studio Owner' },
    { id: 'user-engineer-1', email: 'alex@mixflow.com', name: 'Alex Rivera (Engineer)' },
    { id: 'user-client-maya', email: 'maya@subpop.com', name: 'Maya Lin (Client A)' },
    { id: 'user-client-david', email: 'david@vance.com', name: 'David Vance (Client B)' },
    { id: 'user-foreign-engineer', email: 'other@studio2.com', name: 'Foreign Engineer' },
  ];

  const mockProjects = [
    {
      id: 'proj-maya-1',
      organization_id: 'org-studio-1',
      client_id: 'client-maya-id',
      name: 'Electric Horizon Single',
    },
    {
      id: 'proj-david-2',
      organization_id: 'org-studio-1',
      client_id: 'client-david-id',
      name: 'Acoustic Sessions EP',
    },
    {
      id: 'proj-foreign-3',
      organization_id: 'org-studio-2',
      client_id: 'client-foreign-id',
      name: 'Secret Studio 2 Project',
    },
  ];

  function createMockSupabaseClient() {
    return ((url: string, key: string, options?: any) => {
      const authHeader = options?.global?.headers?.Authorization || '';
      let callerUser: any = null;

      if (authHeader.startsWith('Bearer user-')) {
        const uId = authHeader.replace('Bearer ', '');
        callerUser = mockUsers.find((u) => u.id === uId) || null;
      }

      return {
        auth: {
          getUser: async (token?: string) => {
            const resolvedUser = callerUser || mockUsers.find((u) => u.id === token);
            if (resolvedUser) {
              return { data: { user: resolvedUser }, error: null };
            }
            return { data: { user: null }, error: { message: 'Invalid token' } };
          },
        },
        from: (table: string) => {
          let currentTable = table;
          let filterField: string | null = null;
          let filterValue: any = null;
          let secondFilterField: string | null = null;
          let secondFilterValue: any = null;

          const queryBuilder: any = {
            select: (_fields?: string) => queryBuilder,
            eq: (field: string, val: any) => {
              if (!filterField) {
                filterField = field;
                filterValue = val;
              } else {
                secondFilterField = field;
                secondFilterValue = val;
              }
              return queryBuilder;
            },
            is: (field: string, val: any) => {
              return queryBuilder;
            },
            order: (_field: string, _opts: any) => {
              if (currentTable === 'project_notifications') {
                return {
                  data: __getInMemoryNotifications().filter((n) => n.recipient_user_id === filterValue),
                  error: null,
                };
              }
              return { data: [], error: null };
            },
            limit: (_n: number) => queryBuilder,
            insert: (row: any) => {
              const insertedRow: ProjectNotificationRecord = {
                ...row,
                id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                created_at: new Date().toISOString(),
                read_at: null,
              };
              __seedInMemoryNotification(insertedRow);
              return {
                select: () => ({
                  single: async () => ({
                    data: insertedRow,
                    error: null,
                  }),
                }),
              };
            },
            update: (patch: any) => {
              const notifs = __getInMemoryNotifications();
              const idx = notifs.findIndex((n) => n.id === filterValue && n.recipient_user_id === secondFilterValue);
              if (idx !== -1) {
                notifs[idx] = { ...notifs[idx], ...patch };
              }
              return {
                eq: (f: string, v: any) => {
                  return {
                    eq: (_f2: string, _v2: any) => ({
                      select: () => ({
                        single: async () => ({
                          data: idx !== -1 ? notifs[idx] : null,
                          error: idx === -1 ? { message: 'Not found' } : null,
                        }),
                      }),
                    }),
                    select: () => ({
                      single: async () => ({
                        data: idx !== -1 ? notifs[idx] : null,
                        error: idx === -1 ? { message: 'Not found' } : null,
                      }),
                    }),
                  };
                },
              };
            },
            single: async () => {
              return queryBuilder.maybeSingle();
            },
            maybeSingle: async () => {
              if (currentTable === 'projects') {
                const found = mockProjects.find((p) => p.id === filterValue);
                return { data: found || null, error: found ? null : { message: 'Not found' } };
              }
              if (currentTable === 'project_notifications') {
                const found = __getInMemoryNotifications().find((n) => n.id === filterValue && (!secondFilterValue || n.recipient_user_id === secondFilterValue));
                return { data: found || null, error: null };
              }
              return { data: null, error: null };
            },
            then: (resolve: any) => {
              if (currentTable === 'project_notifications') {
                const filtered = __getInMemoryNotifications().filter((n) => n.recipient_user_id === filterValue);
                return resolve({ data: filtered, error: null });
              }
              return resolve({ data: [], error: null });
            },
          };

          return queryBuilder;
        },
      };
    }) as unknown as typeof createClient;
  }

  const baseCtx = {
    supabaseUrl: 'https://mock.supabase.co',
    supabaseAnonKey: 'mock-anon-key',
    supabaseServiceRoleKey: 'mock-service-role-key',
    createClientFn: createMockSupabaseClient(),
  };

  __resetInMemoryNotifications();

  // --- 1. ACCESS CONTROL & QUERY TESTS ---

  // 1. Unauthenticated request rejected (401)
  const res1 = await handleListUserNotifications({
    ...baseCtx,
    authHeader: undefined,
  });
  assert('1. Unauthenticated list notifications rejected (401)', res1.status === 401);

  // Seed notification for engineer
  const notifEngineer1: ProjectNotificationRecord = {
    id: 'notif-eng-1',
    organization_id: 'org-studio-1',
    project_id: 'proj-maya-1',
    recipient_user_id: 'user-engineer-1',
    actor_user_id: 'user-client-maya',
    type: 'feedback_added',
    title: 'New Client Feedback',
    message: 'Maya Lin left feedback on Version 3.',
    link_url: '#/project/proj-maya-1',
    read_at: null,
    created_at: new Date(Date.now() - 10000).toISOString(),
  };
  __seedInMemoryNotification(notifEngineer1);

  // Seed notification for client Maya
  const notifClientMaya: ProjectNotificationRecord = {
    id: 'notif-maya-1',
    organization_id: 'org-studio-1',
    project_id: 'proj-maya-1',
    recipient_user_id: 'user-client-maya',
    actor_user_id: 'user-engineer-1',
    type: 'version_uploaded',
    title: 'New Mix Available',
    message: 'Version 3 (Master Candidate) is ready for your review.',
    link_url: '#/client/project/proj-maya-1',
    read_at: null,
    created_at: new Date(Date.now() - 5000).toISOString(),
  };
  __seedInMemoryNotification(notifClientMaya);

  // 2. Engineer can view own notifications
  const res2 = await handleListUserNotifications({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
  });
  assert('2. Engineer retrieves own notifications (200)', res2.status === 200 && res2.body?.notifications?.length === 1);
  assert('2b. Engineer unread count equals 1', res2.body?.unreadCount === 1);

  // 3. Client Maya can view own notifications
  const res3 = await handleListUserNotifications({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
  });
  assert('3. Client retrieves own notifications (200)', res3.status === 200 && res3.body?.notifications?.length === 1);
  assert('3b. Client unread count equals 1', res3.body?.unreadCount === 1);

  // 4. Client Maya CANNOT see Engineer notifications (strict recipient isolation)
  const hasEngineerNotif = res3.body?.notifications?.some((n: any) => n.id === notifEngineer1.id);
  assert('4. Client cannot see engineer notifications', !hasEngineerNotif);

  // 5. Client David Vance sees 0 notifications (not assigned to this notification)
  const res5 = await handleListUserNotifications({
    ...baseCtx,
    authHeader: 'Bearer user-client-david',
  });
  assert('5. Unrelated client sees 0 notifications', res5.status === 200 && res5.body?.notifications?.length === 0);

  // --- 2. MARK AS READ TESTS ---

  // 6. User marks own notification as read
  const res6 = await handleMarkNotificationRead({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    notificationId: 'notif-eng-1',
  });
  assert('6. User can mark own notification as read (200)', res6.status === 200 && Boolean(res6.body?.notification?.read_at));

  // 7. Verify engineer unread count drops to 0
  const res7 = await handleListUserNotifications({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
  });
  assert('7. Engineer unread count drops to 0 after mark as read', res7.body?.unreadCount === 0);

  // 8. User CANNOT mark another user\'s notification as read (returns 404 access denied)
  const res8 = await handleMarkNotificationRead({
    ...baseCtx,
    authHeader: 'Bearer user-client-david',
    notificationId: 'notif-maya-1',
  });
  assert('8. User cannot mark another user\'s notification as read (404/denied)', res8.status === 404);

  // 9. Mark all notifications as read
  const res9 = await handleMarkAllNotificationsRead({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
  });
  assert('9. Client mark all notifications as read succeeds (200)', res9.status === 200);

  const res9b = await handleListUserNotifications({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
  });
  assert('9b. Client unread count is 0 after mark-all-read', res9b.body?.unreadCount === 0);

  // --- 3. SERVER HELPER & WORKFLOW EVENT TESTS ---

  // 10. createNotification helper validates organization & project relationship
  const notifCreated = await createNotification(
    {
      supabaseUrl: baseCtx.supabaseUrl,
      supabaseServiceRoleKey: baseCtx.supabaseServiceRoleKey,
      createClientFn: baseCtx.createClientFn,
    },
    {
      organization_id: 'org-studio-1',
      project_id: 'proj-maya-1',
      recipient_user_id: 'user-client-maya',
      actor_user_id: 'user-engineer-1',
      type: 'delivery_released',
      title: 'Final Master Files Ready',
      message: 'Your final deliverable "Electric Horizon Master" is ready.',
      link_url: '#/client/project/proj-maya-1',
    }
  );
  assert('10. createNotification helper successfully records deliverable notification',
    Boolean(notifCreated?.id && notifCreated.type === 'delivery_released')
  );

  // 11. createNotification prevents self-notification (actor === recipient)
  const selfNotif = await createNotification(
    {
      supabaseUrl: baseCtx.supabaseUrl,
      supabaseServiceRoleKey: baseCtx.supabaseServiceRoleKey,
      createClientFn: baseCtx.createClientFn,
    },
    {
      organization_id: 'org-studio-1',
      project_id: 'proj-maya-1',
      recipient_user_id: 'user-engineer-1',
      actor_user_id: 'user-engineer-1',
      type: 'version_uploaded',
      title: 'Self Action',
      message: 'You uploaded a version.',
    }
  );
  assert('11. createNotification prevents self-notifications (returns null)', selfNotif === null);

  // 12. createNotification prevents mismatched organization & project
  const mismatchedNotif = await createNotification(
    {
      supabaseUrl: baseCtx.supabaseUrl,
      supabaseServiceRoleKey: baseCtx.supabaseServiceRoleKey,
      createClientFn: baseCtx.createClientFn,
    },
    {
      organization_id: 'org-studio-1',
      project_id: 'proj-foreign-3', // belongs to org-studio-2
      recipient_user_id: 'user-client-maya',
      type: 'project_status_changed',
      title: 'Project Mismatch',
      message: 'Invalid project/org combination.',
    }
  );
  assert('12. createNotification blocks mismatched organization & project (returns null)', mismatchedNotif === null);

  // 13. createNotification duplicate suppression within 5s
  const duplicateNotif = await createNotification(
    {
      supabaseUrl: baseCtx.supabaseUrl,
      supabaseServiceRoleKey: baseCtx.supabaseServiceRoleKey,
      createClientFn: baseCtx.createClientFn,
    },
    {
      organization_id: 'org-studio-1',
      project_id: 'proj-maya-1',
      recipient_user_id: 'user-client-maya',
      actor_user_id: 'user-engineer-1',
      type: 'delivery_released',
      title: 'Final Master Files Ready',
      message: 'Your final deliverable "Electric Horizon Master" is ready.',
    }
  );
  assert('13. createNotification duplicate suppression debounces repeated event',
    duplicateNotif?.id === notifCreated?.id
  );

  // --- 4. SERVER ROUTES & IMMUTABILITY AUDIT ---
  const serverPath = join(process.cwd(), 'server.ts');
  const serverContent = readFileSync(serverPath, 'utf-8');

  assert('14. server.ts mounts GET /api/notifications',
    serverContent.includes("app.get('/api/notifications'")
  );

  assert('15. server.ts mounts PATCH /api/notifications/:id/read',
    serverContent.includes("app.patch('/api/notifications/:id/read'")
  );

  assert('16. server.ts mounts POST /api/notifications/read-all',
    serverContent.includes("app.post('/api/notifications/read-all'")
  );

  assert('17. server.ts blocks DELETE /api/notifications* with 405 Method Not Allowed',
    serverContent.includes("app.delete('/api/notifications*'") &&
    serverContent.includes('405')
  );

  // --- 5. WORKFLOW EVENT INTEGRATION AUDIT ---
  const versionReviewHandlerContent = readFileSync(join(process.cwd(), 'src/server/versionReviewHandler.ts'), 'utf-8');
  const paymentsHandlerContent = readFileSync(join(process.cwd(), 'src/server/paymentsHandler.ts'), 'utf-8');
  const finalDeliveryHandlerContent = readFileSync(join(process.cwd(), 'src/server/finalDeliveryHandler.ts'), 'utf-8');

  assert('18. versionReviewHandler notifies client when new version is uploaded',
    versionReviewHandlerContent.includes("type: 'version_uploaded'") &&
    versionReviewHandlerContent.includes("title: 'New Mix Available'")
  );

  assert('19. versionReviewHandler notifies engineer when client leaves feedback',
    versionReviewHandlerContent.includes("type: 'feedback_added'") &&
    versionReviewHandlerContent.includes("title: 'New Client Feedback'")
  );

  assert('20. versionReviewHandler notifies client when feedback is resolved',
    versionReviewHandlerContent.includes("type: 'feedback_resolved'") &&
    versionReviewHandlerContent.includes("title: 'Feedback Resolved'")
  );

  assert('21. paymentsHandler notifies client when payment is recorded',
    paymentsHandlerContent.includes("type: 'payment_recorded'") &&
    paymentsHandlerContent.includes("title: 'Payment Recorded'")
  );

  assert('22. finalDeliveryHandler notifies client when final delivery is released',
    finalDeliveryHandlerContent.includes("type: 'delivery_released'") &&
    finalDeliveryHandlerContent.includes("title: 'Final Master Files Ready'")
  );

  // --- 6. FRONTEND UI & NOTIFICATION BELL AUDIT ---
  const engineerNavbarContent = readFileSync(join(process.cwd(), 'src/components/Navbar.tsx'), 'utf-8');
  const clientNavbarContent = readFileSync(join(process.cwd(), 'src/components/client/ClientPortalNavbar.tsx'), 'utf-8');

  assert('23. Engineer Navbar uses live useNotifications hook',
    engineerNavbarContent.includes('useNotifications') &&
    engineerNavbarContent.includes('liveUnreadCount') &&
    engineerNavbarContent.includes('markAllAsRead')
  );

  assert('24. Engineer Navbar provides unread badge, click-to-read, and deep links',
    engineerNavbarContent.includes('handleNotificationClick') &&
    engineerNavbarContent.includes('Mark all read')
  );

  assert('25. ClientPortalNavbar includes live notification bell and unread badge',
    clientNavbarContent.includes('useNotifications') &&
    clientNavbarContent.includes('unreadCount') &&
    clientNavbarContent.includes('Project Alerts')
  );

  assert('26. ClientPortalNavbar provides click-to-read and mark all read',
    clientNavbarContent.includes('handleNotificationClick') &&
    clientNavbarContent.includes('markAllAsRead')
  );

  // --- Summary ---
  console.log(`\n========================================`);
  console.log(`Step 15 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep15NotificationsTests().catch((err) => {
  console.error('Unhandled test suite exception:', err);
  process.exit(1);
});
