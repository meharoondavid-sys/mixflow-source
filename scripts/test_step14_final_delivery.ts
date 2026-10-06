import {
  handleListProjectDeliveries,
  handleCreateProjectDelivery,
  handleGetDeliveryDownloadUrl,
  __resetInMemoryDeliveries,
  __seedInMemoryDelivery,
  __getInMemoryDeliveries,
} from '../src/server/finalDeliveryHandler.js';
import { ProjectDeliveryRecord, DeliverableType } from '../src/types/delivery.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

async function runStep14FinalDeliveryTests() {
  console.log('=== Step 14: Final Delivery Foundation Verification Suite ===\n');

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
  const migrationPath = join(process.cwd(), 'supabase/migrations/20261007_create_project_deliveries.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  // Verify Table Name & Columns
  assert('0a. Migration creates table "public.project_deliveries"',
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.project_deliveries')
  );

  assert('0b. Table includes all required authoritative fields',
    migrationSql.includes('id uuid PRIMARY KEY DEFAULT gen_random_uuid()') &&
    migrationSql.includes('organization_id uuid NOT NULL REFERENCES public.organizations(id)') &&
    migrationSql.includes('project_id uuid NOT NULL REFERENCES public.projects(id)') &&
    migrationSql.includes('song_id uuid REFERENCES public.project_songs(id)') &&
    migrationSql.includes('version_id uuid NOT NULL REFERENCES public.project_file_versions(id)') &&
    migrationSql.includes('file_id uuid REFERENCES public.project_files(id)') &&
    migrationSql.includes("deliverable_type text NOT NULL CHECK (deliverable_type IN ('master', 'instrumental', 'stems', 'other'))") &&
    migrationSql.includes('name text NOT NULL') &&
    migrationSql.includes('file_type text') &&
    migrationSql.includes("status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'delivered'))") &&
    migrationSql.includes('released_by uuid REFERENCES auth.users(id)') &&
    migrationSql.includes('released_at timestamptz') &&
    migrationSql.includes('created_at timestamptz') &&
    migrationSql.includes('updated_at timestamptz')
  );

  // Verify Deliverable Types & Status Constraints
  assert('0c. Migration enforces deliverable types (master, instrumental, stems, other) and statuses (ready, delivered)',
    migrationSql.includes("'master', 'instrumental', 'stems', 'other'") &&
    migrationSql.includes("'ready', 'delivered'")
  );

  // Verify Indexes & Uniqueness
  assert('0d. Migration defines uniqueness and performance indexes',
    migrationSql.includes('idx_project_deliveries_unique_release') &&
    migrationSql.includes('idx_project_deliveries_org_id') &&
    migrationSql.includes('idx_project_deliveries_project_id') &&
    migrationSql.includes('idx_project_deliveries_song_id') &&
    migrationSql.includes('idx_project_deliveries_version_id') &&
    migrationSql.includes('idx_project_deliveries_status') &&
    migrationSql.includes('idx_project_deliveries_created_at')
  );

  // Verify RLS & Permissions
  assert('0e. Migration enables RLS and defines authorized policies',
    migrationSql.includes('ALTER TABLE public.project_deliveries ENABLE ROW LEVEL SECURITY') &&
    migrationSql.includes('REVOKE ALL ON public.project_deliveries FROM anon') &&
    migrationSql.includes('GRANT SELECT, INSERT, UPDATE ON public.project_deliveries TO authenticated') &&
    migrationSql.includes("ARRAY['owner', 'admin', 'engineer']")
  );

  // Verify Immutability & Anti-Deletion
  assert('0f. Migration blocks record deletion via trigger and omits DELETE policy',
    migrationSql.includes('prevent_project_deliveries_deletion()') &&
    migrationSql.includes('BEFORE DELETE ON public.project_deliveries') &&
    !migrationSql.includes('FOR DELETE\nTO authenticated')
  );

  // --- Mock Database & Multi-User Setup for Security Audit ---
  const mockUsers = [
    { id: 'user-owner-1', email: 'owner@mixflow.com', name: 'Studio Owner' },
    { id: 'user-admin-1', email: 'admin@mixflow.com', name: 'Studio Admin' },
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

  const mockSongs = [
    { id: 'song-1', project_id: 'proj-maya-1', organization_id: 'org-studio-1', title: 'Midnight City Mix', track_number: 1 },
    { id: 'song-2', project_id: 'proj-david-2', organization_id: 'org-studio-1', title: 'Morning Light', track_number: 1 },
  ];

  const mockVersions = [
    {
      id: 'ver-maya-approved-1',
      organization_id: 'org-studio-1',
      project_id: 'proj-maya-1',
      song_id: 'song-1',
      file_id: 'file-mix-1',
      version_number: 3,
      name: 'Electric Horizon v3 (Master Candidate)',
      storage_path: 'org-studio-1/proj-maya-1/versions/ver-maya-approved-1.wav',
      file_type: 'audio/wav',
      file_size: 52428800,
      duration_seconds: 215,
    },
    {
      id: 'ver-maya-unresolved-2',
      organization_id: 'org-studio-1',
      project_id: 'proj-maya-1',
      song_id: 'song-1',
      file_id: 'file-mix-1',
      version_number: 2,
      name: 'Electric Horizon v2',
      storage_path: 'org-studio-1/proj-maya-1/versions/ver-maya-unresolved-2.wav',
      file_type: 'audio/wav',
      file_size: 48000000,
      duration_seconds: 215,
    },
    {
      id: 'ver-foreign-3',
      organization_id: 'org-studio-2',
      project_id: 'proj-foreign-3',
      song_id: null,
      file_id: 'file-foreign-1',
      version_number: 1,
      name: 'Foreign Mix v1',
      storage_path: 'org-studio-2/proj-foreign-3/versions/ver-foreign-3.wav',
      file_type: 'audio/wav',
      file_size: 30000000,
      duration_seconds: 180,
    },
  ];

  const mockFeedback = [
    // Open feedback on ver-maya-unresolved-2
    {
      id: 'fb-1',
      version_id: 'ver-maya-unresolved-2',
      project_id: 'proj-maya-1',
      status: 'open',
      comment: 'Please bring up the vocals in the chorus',
    },
    // Resolved feedback on ver-maya-approved-1
    {
      id: 'fb-2',
      version_id: 'ver-maya-approved-1',
      project_id: 'proj-maya-1',
      status: 'resolved',
      comment: 'Vocals sound perfect now!',
    },
  ];

  // Supabase mock generator
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
        storage: {
          from: (bucket: string) => ({
            createSignedUrl: async (path: string, expiresIn: number, opts?: any) => {
              return {
                data: {
                  signedUrl: `https://mock-storage.mixflow.com/${bucket}/${path}?signed_expires=${expiresIn}`,
                },
                error: null,
              };
            },
          }),
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
            order: (_field: string, _opts: any) => {
              if (currentTable === 'project_deliveries') {
                return {
                  data: __getInMemoryDeliveries().filter((d) => d.project_id === filterValue),
                  error: null,
                };
              }
              return { data: [], error: null };
            },
            insert: (row: any) => {
              const insertedRow: ProjectDeliveryRecord = {
                ...row,
                id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              __seedInMemoryDelivery(insertedRow);
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
              const deliveries = __getInMemoryDeliveries();
              const idx = deliveries.findIndex((d) => d.id === filterValue);
              if (idx !== -1) {
                deliveries[idx] = { ...deliveries[idx], ...patch };
              }
              return {
                eq: (f: string, v: any) => {
                  return { data: null, error: null };
                },
              };
            },
            delete: () => {
              throw new Error('Deletion of final delivery records is strictly forbidden.');
            },
            then: (resolve: any) => {
              if (currentTable === 'project_feedback') {
                const filtered = mockFeedback.filter(
                  (fb) => fb.version_id === filterValue && (!secondFilterValue || fb.status === secondFilterValue)
                );
                return resolve({ data: filtered, error: null });
              }
              if (currentTable === 'project_deliveries') {
                return resolve({
                  data: __getInMemoryDeliveries().filter((d) => d.project_id === filterValue),
                  error: null,
                });
              }
              return resolve({ data: [], error: null });
            },
            single: async () => {
              return queryBuilder.maybeSingle();
            },
            maybeSingle: async () => {
              if (currentTable === 'projects') {
                const found = mockProjects.find((p) => p.id === filterValue);
                return { data: found || null, error: found ? null : { message: 'Not found' } };
              }
              if (currentTable === 'organization_members') {
                const found = mockMembers.find(
                  (m) => m.organization_id === filterValue && m.user_id === secondFilterValue
                );
                return { data: found || null, error: null };
              }
              if (currentTable === 'clients') {
                const found = mockClients.find(
                  (c) => c.id === filterValue && (!secondFilterValue || c.user_id === secondFilterValue)
                );
                return { data: found || null, error: null };
              }
              if (currentTable === 'project_file_versions') {
                const found = mockVersions.find((v) => v.id === filterValue);
                return { data: found || null, error: null };
              }
              if (currentTable === 'project_deliveries') {
                const found = __getInMemoryDeliveries().find((d) => d.id === filterValue);
                return { data: found || null, error: null };
              }
              return { data: null, error: null };
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

  __resetInMemoryDeliveries();

  // --- 1. ACCESS CONTROL TESTS ---

  // 1. Unauthenticated request rejected (401)
  const res1 = await handleListProjectDeliveries({
    ...baseCtx,
    authHeader: undefined,
    projectId: 'proj-maya-1',
  });
  assert('1. Unauthenticated list deliveries rejected (401)', res1.status === 401);

  // 2. Engineer can view deliveries (200)
  const res2 = await handleListProjectDeliveries({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    projectId: 'proj-maya-1',
  });
  assert('2. Engineer can view project deliveries (200)', res2.status === 200 && Array.isArray(res2.body?.deliveries));

  // 3. Studio Owner can view deliveries (200)
  const res3 = await handleListProjectDeliveries({
    ...baseCtx,
    authHeader: 'Bearer user-owner-1',
    projectId: 'proj-maya-1',
  });
  assert('3. Studio Owner can view project deliveries (200)', res3.status === 200);

  // 4. Assigned Client can view deliveries for their project (200)
  const res4 = await handleListProjectDeliveries({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
    projectId: 'proj-maya-1',
  });
  assert('4. Assigned Client can view own project deliveries (200)', res4.status === 200 && Array.isArray(res4.body?.deliveries));

  // 5. Unassigned Client blocked from another client\'s project (403)
  const res5 = await handleListProjectDeliveries({
    ...baseCtx,
    authHeader: 'Bearer user-client-david',
    projectId: 'proj-maya-1',
  });
  assert('5. Unassigned Client blocked from accessing other project (403)', res5.status === 403);

  // 6. Foreign Studio Owner blocked from different studio project (403)
  const res6 = await handleListProjectDeliveries({
    ...baseCtx,
    authHeader: 'Bearer user-foreign-owner',
    projectId: 'proj-maya-1',
  });
  assert('6. Foreign Studio Owner blocked from different studio project (403)', res6.status === 403);

  // --- 2. RELEASE FINAL DELIVERABLE TESTS ---

  // 7. Engineer can release final deliverable for an approved version (201)
  const res7 = await handleCreateProjectDelivery({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    projectId: 'proj-maya-1',
    body: {
      version_id: 'ver-maya-approved-1',
      deliverable_type: 'master',
      name: 'Electric Horizon - Official Master (v3)',
      song_id: 'song-1',
    },
  });
  assert('7. Engineer can release final deliverable (201)', res7.status === 201 && res7.body?.delivery?.id);

  const releasedDelivery = res7.body?.delivery;

  // 8. Released deliverable defaults to status 'ready'
  assert('8. Released deliverable has status "ready"', releasedDelivery?.status === 'ready');

  // 9. Deliverable correctly links to existing version without duplicating file
  assert('9. Deliverable preserves version relationship without replacing underlying file',
    releasedDelivery?.version_id === 'ver-maya-approved-1' &&
    releasedDelivery?.deliverable_type === 'master' &&
    releasedDelivery?.version_number === 3
  );

  // 10. Studio Owner can release instrumental deliverable (201)
  const res10 = await handleCreateProjectDelivery({
    ...baseCtx,
    authHeader: 'Bearer user-owner-1',
    projectId: 'proj-maya-1',
    body: {
      version_id: 'ver-maya-approved-1',
      deliverable_type: 'instrumental',
      name: 'Electric Horizon - Instrumental Master (v3)',
      song_id: 'song-1',
    },
  });
  assert('10. Studio Owner can release instrumental deliverable (201)', res10.status === 201);

  // 11. Assistant cannot release final deliverable (403)
  const res11 = await handleCreateProjectDelivery({
    ...baseCtx,
    authHeader: 'Bearer user-assistant-1',
    projectId: 'proj-maya-1',
    body: {
      version_id: 'ver-maya-approved-1',
      deliverable_type: 'stems',
      name: 'Electric Horizon - Stems Package',
      song_id: 'song-1',
    },
  });
  assert('11. Assistant role blocked from releasing deliverable (403)', res11.status === 403);

  // 12. Client cannot release deliverable (403)
  const res12 = await handleCreateProjectDelivery({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
    projectId: 'proj-maya-1',
    body: {
      version_id: 'ver-maya-approved-1',
      deliverable_type: 'stems',
      name: 'Hacked Deliverable',
    },
  });
  assert('12. Client blocked from releasing deliverable (403)', res12.status === 403);

  // 13. Releasing invalid deliverable_type rejected (400)
  const res13 = await handleCreateProjectDelivery({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    projectId: 'proj-maya-1',
    body: {
      version_id: 'ver-maya-approved-1',
      deliverable_type: 'invalid_type',
      name: 'Bad Type Deliverable',
    },
  });
  assert('13. Invalid deliverable_type rejected (400)', res13.status === 400);

  // 14. Releasing without name rejected (400)
  const res14 = await handleCreateProjectDelivery({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    projectId: 'proj-maya-1',
    body: {
      version_id: 'ver-maya-approved-1',
      deliverable_type: 'master',
      name: '   ',
    },
  });
  assert('14. Empty deliverable name rejected (400)', res14.status === 400);

  // 15. Releasing version with open revision feedback rejected (400)
  const res15 = await handleCreateProjectDelivery({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    projectId: 'proj-maya-1',
    body: {
      version_id: 'ver-maya-unresolved-2',
      deliverable_type: 'master',
      name: 'Electric Horizon v2 With Open Feedback',
      song_id: 'song-1',
    },
  });
  assert('15. Version with open revision feedback note blocked from final release (400)', res15.status === 400);

  // 16. Duplicate deliverable release rejected (409)
  const res16 = await handleCreateProjectDelivery({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    projectId: 'proj-maya-1',
    body: {
      version_id: 'ver-maya-approved-1',
      deliverable_type: 'master',
      name: 'Duplicate Electric Horizon Master',
      song_id: 'song-1',
    },
  });
  assert('16. Duplicate deliverable release for same version and type blocked (409)', res16.status === 409);

  // 17. Version belonging to another project rejected (400)
  const res17 = await handleCreateProjectDelivery({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    projectId: 'proj-maya-1',
    body: {
      version_id: 'ver-foreign-3',
      deliverable_type: 'master',
      name: 'Foreign Version Injected',
    },
  });
  assert('17. Version from another project/organization rejected (400)', res17.status === 400);

  // --- 3. SECURE DOWNLOAD URL & AUDIT STATUS TESTS ---

  // 18. Assigned client can request secure download URL (200)
  const res18 = await handleGetDeliveryDownloadUrl({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
    projectId: 'proj-maya-1',
    deliveryId: releasedDelivery.id,
  });
  assert('18. Assigned client receives secure signed download URL (200)',
    res18.status === 200 &&
    typeof res18.body?.downloadUrl === 'string' &&
    res18.body?.downloadUrl.length > 0
  );

  // 19. Client download updates delivery status from 'ready' to 'delivered'
  assert('19. Delivery status transitions from "ready" to "delivered" after client download',
    res18.body?.status === 'delivered'
  );

  // 20. Studio engineer can also download deliverable (200)
  const res20 = await handleGetDeliveryDownloadUrl({
    ...baseCtx,
    authHeader: 'Bearer user-engineer-1',
    projectId: 'proj-maya-1',
    deliveryId: releasedDelivery.id,
  });
  assert('20. Studio engineer can generate download URL (200)', res20.status === 200);

  // 21. Foreign client blocked from downloading deliverable (403)
  const res21 = await handleGetDeliveryDownloadUrl({
    ...baseCtx,
    authHeader: 'Bearer user-client-david',
    projectId: 'proj-maya-1',
    deliveryId: releasedDelivery.id,
  });
  assert('21. Foreign client blocked from downloading other client\'s deliverable (403)', res21.status === 403);

  // 22. Non-existent delivery download returns 404
  const res22 = await handleGetDeliveryDownloadUrl({
    ...baseCtx,
    authHeader: 'Bearer user-client-maya',
    projectId: 'proj-maya-1',
    deliveryId: 'non-existent-delivery-id',
  });
  assert('22. Non-existent delivery download returns 404', res22.status === 404);

  // --- 4. SERVER ROUTING & IMMUTABILITY AUDIT ---
  const serverPath = join(process.cwd(), 'server.ts');
  const serverContent = readFileSync(serverPath, 'utf-8');

  assert('23. server.ts mounts GET /api/projects/:projectId/deliveries',
    serverContent.includes("app.get('/api/projects/:projectId/deliveries'")
  );

  assert('24. server.ts mounts POST /api/projects/:projectId/deliveries',
    serverContent.includes("app.post('/api/projects/:projectId/deliveries'")
  );

  assert('25. server.ts mounts POST /api/projects/:projectId/deliveries/:deliveryId/download-url',
    serverContent.includes("app.post('/api/projects/:projectId/deliveries/:deliveryId/download-url'")
  );

  assert('26. server.ts blocks DELETE /api/projects/:projectId/deliveries* with 405 Method Not Allowed',
    serverContent.includes("app.delete('/api/projects/:projectId/deliveries*'") &&
    serverContent.includes('405')
  );

  // --- 5. FRONTEND INTEGRATION AUDIT ---
  const clientDetailPath = join(process.cwd(), 'src/components/client/ClientPortalProjectDetailView.tsx');
  const clientDetailContent = readFileSync(clientDetailPath, 'utf-8');

  assert('27. ClientPortalProjectDetailView renders ClientPortalDeliveriesSection',
    clientDetailContent.includes('<ClientPortalDeliveriesSection projectId={project.id} />')
  );

  const engineerOverviewPath = join(process.cwd(), 'src/components/engineer/ProjectOverviewView.tsx');
  const engineerOverviewContent = readFileSync(engineerOverviewPath, 'utf-8');

  assert('28. ProjectOverviewView renders ProjectDeliveriesSection',
    engineerOverviewContent.includes('<ProjectDeliveriesSection')
  );

  const clientDeliveriesSectionPath = join(process.cwd(), 'src/components/client/ClientPortalDeliveriesSection.tsx');
  const clientDeliveriesContent = readFileSync(clientDeliveriesSectionPath, 'utf-8');

  assert('29. Client Portal clearly distinguishes working review versions from final deliverables',
    clientDeliveriesContent.includes('Working Versions') &&
    clientDeliveriesContent.includes('Final Deliverables')
  );

  // --- Summary ---
  console.log(`\n========================================`);
  console.log(`Step 14 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep14FinalDeliveryTests().catch((err) => {
  console.error('Unhandled test suite exception:', err);
  process.exit(1);
});
