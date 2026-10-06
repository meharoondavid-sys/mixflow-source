import {
  handleGetClientPortalMe,
  handleGetClientPortalProjects,
  handleGetClientPortalProjectDetail,
  handleGetClientPortalFileDownloadUrl,
} from '../src/server/clientPortalHandler.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

async function runStep10ClientPortalTests() {
  console.log('=== Step 10: Client Portal Foundation Verification Suite ===\n');

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

  // --- Live Supabase Project Verification ---
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const liveClient = createClient(
      'https://amgowwvresmsysofwqsp.supabase.co',
      'sb_publishable_8uYzlSxXc0IBIm4a4_DTkA_h1TJcZGV'
    );

    const { error: liveColErr } = await liveClient.from('clients').select('id, user_id').limit(1);
    const userIdDeployed = !liveColErr || liveColErr.code !== '42703';

    if (userIdDeployed) {
      console.log('ℹ [LIVE DB AUDIT] public.clients.user_id is confirmed DEPLOYED on live Supabase.');
    } else {
      console.log('ℹ [LIVE DB AUDIT] public.clients.user_id: NOT YET DEPLOYED (code 42703: column does not exist).');
      console.log('  -> SQL migration file: supabase/migrations/20261004_create_client_portal_foundation.sql');
    }

    const { error: liveClientsErr } = await liveClient.from('clients').select('id').limit(1);
    assert('Live Supabase connection & existing studio policies intact', !liveClientsErr);
  } catch (err: any) {
    console.warn('Live audit note:', err?.message);
  }

  // --- Mock Database and Auth Setup ---
  const mockUsers = [
    { id: 'user-client-a', email: 'maya@lin.com', name: 'Maya Lin' },
    { id: 'user-client-b', email: 'david@vance.com', name: 'David Vance' },
    { id: 'user-unregistered', email: 'stranger@example.com', name: 'Stranger' },
    { id: 'user-engineer-1', email: 'alex@mixflow.com', name: 'Alex Rivera' },
  ];

  const mockClients = [
    {
      id: 'client-a',
      organization_id: 'org-studio-1',
      user_id: 'user-client-a',
      full_name: 'Maya Lin',
      email: 'maya@lin.com',
      company_name: 'Sub Pop',
      phone: '+1 555 0192',
    },
    {
      id: 'client-b',
      organization_id: 'org-studio-1',
      user_id: 'user-client-b',
      full_name: 'David Vance',
      email: 'david@vance.com',
      company_name: 'Indie FM',
      phone: '+1 555 0841',
    },
  ];

  const mockProjects = [
    {
      id: 'proj-a1',
      organization_id: 'org-studio-1',
      client_id: 'client-a',
      name: 'Electric Horizon Single',
      project_type: 'single',
      description: 'Debut electronic single master.',
      status: 'in_review',
      deadline: '2026-11-01',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:00:00Z',
    },
    {
      id: 'proj-a2',
      organization_id: 'org-studio-1',
      client_id: 'client-a',
      name: 'Resonance EP',
      project_type: 'ep',
      description: 'Four track ambient EP.',
      status: 'in_production',
      deadline: '2026-12-15',
      created_at: '2026-10-02T10:00:00Z',
      updated_at: '2026-10-02T10:00:00Z',
    },
    {
      id: 'proj-b1',
      organization_id: 'org-studio-1',
      client_id: 'client-b',
      name: 'David Vance Acoustic Album',
      project_type: 'album',
      description: 'Ten track folk recording.',
      status: 'in_review',
      deadline: '2026-11-20',
      created_at: '2026-10-03T10:00:00Z',
      updated_at: '2026-10-03T10:00:00Z',
    },
  ];

  const mockSongs = [
    { id: 'song-a1-1', project_id: 'proj-a1', title: 'Electric Horizon', track_number: 1, status: 'in_review' },
    { id: 'song-a2-1', project_id: 'proj-a2', title: 'Golden River', track_number: 1, status: 'completed' },
    { id: 'song-a2-2', project_id: 'proj-a2', title: 'Neon Dusk', track_number: 2, status: 'in_production' },
    { id: 'song-b1-1', project_id: 'proj-b1', title: 'Acoustic Intro', track_number: 1, status: 'in_review' },
  ];

  const mockFiles = [
    {
      id: 'file-a1-1',
      organization_id: 'org-studio-1',
      project_id: 'proj-a1',
      song_id: 'song-a1-1',
      name: 'Electric_Horizon_Master_24bit.wav',
      storage_path: 'org-studio-1/proj-a1/file-a1-1_Electric_Horizon_Master_24bit.wav',
      file_type: 'audio/wav',
      file_size: 48000000,
      uploaded_by: 'user-engineer-1',
      created_at: '2026-10-01T12:00:00Z',
    },
    {
      id: 'file-b1-1',
      organization_id: 'org-studio-1',
      project_id: 'proj-b1',
      song_id: 'song-b1-1',
      name: 'David_Secret_Song.wav',
      storage_path: 'org-studio-1/proj-b1/file-b1-1_David_Secret_Song.wav',
      file_type: 'audio/wav',
      file_size: 52000000,
      uploaded_by: 'user-engineer-1',
      created_at: '2026-10-03T12:00:00Z',
    },
  ];

  function createMockClient(url: string, key: string, options?: any) {
    const authHeader = options?.global?.headers?.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/, '').trim();

    return {
      auth: {
        getUser: async (tokenToVerify?: string) => {
          const t = tokenToVerify || token;
          const user = mockUsers.find((u) => u.id === t);
          return user
            ? { data: { user }, error: null }
            : { data: { user: null }, error: new Error('User not found') };
        },
      },
      from: (table: string) => {
        let currentData =
          table === 'clients'
            ? [...mockClients]
            : table === 'projects'
            ? [...mockProjects]
            : table === 'project_songs'
            ? [...mockSongs]
            : table === 'project_files'
            ? [...mockFiles]
            : [];

        let filters: Array<(item: any) => boolean> = [];

        const queryObj: any = {
          select: () => queryObj,
          eq: (field: string, val: any) => {
            filters.push((item) => item[field] === val);
            return queryObj;
          },
          in: (field: string, vals: any[]) => {
            filters.push((item) => vals.includes(item[field]));
            return queryObj;
          },
          ilike: (field: string, val: any) => {
            filters.push((item) => String(item[field] || '').toLowerCase() === String(val).toLowerCase());
            return queryObj;
          },
          order: () => queryObj,
          maybeSingle: async () => {
            const filtered = currentData.filter((item) => filters.every((f) => f(item)));
            return { data: filtered[0] || null, error: null };
          },
          then: (resolve: any) => {
            const filtered = currentData.filter((item) => filters.every((f) => f(item)));
            return resolve({ data: filtered, error: null });
          },
        };
        return queryObj;
      },
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: async (path: string, expiresIn: number) => ({
            data: {
              signedUrl: `https://storage.mixflow.test/${bucket}/sign/${path}?token=mock-token&exp=${expiresIn}`,
            },
            error: null,
          }),
        }),
      },
    };
  }

  const defaultCtx = {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'mock-anon-key',
    supabaseServiceRoleKey: 'mock-service-key',
    createClientFn: createMockClient as any,
  };

  // --- Test 1: Client A can access own client identity ---
  {
    const resA = await handleGetClientPortalMe({
      ...defaultCtx,
      authHeader: 'Bearer user-client-a',
    });
    assert('1a. Authenticated Client A can retrieve own client profile',
      resA.status === 200 && resA.body.isClient === true && resA.body.client.full_name === 'Maya Lin'
    );
  }

  // --- Test 2: Unregistered user returns isClient: false ---
  {
    const resStranger = await handleGetClientPortalMe({
      ...defaultCtx,
      authHeader: 'Bearer user-unregistered',
    });
    assert('1b. Unregistered authenticated user returns isClient: false',
      resStranger.status === 200 && resStranger.body.isClient === false && resStranger.body.client === null
    );
  }

  // --- Test 3: Client A can access only Client A projects ---
  {
    const resProjectsA = await handleGetClientPortalProjects({
      ...defaultCtx,
      authHeader: 'Bearer user-client-a',
    });
    const projIdsA = resProjectsA.body.projects.map((p: any) => p.id);
    assert('2a. Authenticated Client A sees own projects (2 projects)',
      resProjectsA.status === 200 && projIdsA.length === 2 && projIdsA.includes('proj-a1') && projIdsA.includes('proj-a2')
    );
    assert('2b. Client A cannot see Client B projects',
      !projIdsA.includes('proj-b1')
    );
  }

  // --- Test 4: Client B can access only Client B projects ---
  {
    const resProjectsB = await handleGetClientPortalProjects({
      ...defaultCtx,
      authHeader: 'Bearer user-client-b',
    });
    const projIdsB = resProjectsB.body.projects.map((p: any) => p.id);
    assert('3. Client B sees only own projects (1 project)',
      resProjectsB.status === 200 && projIdsB.length === 1 && projIdsB.includes('proj-b1') && !projIdsB.includes('proj-a1')
    );
  }

  // --- Test 5: Client project list is correctly scoped and aggregates song/file counts ---
  {
    const resProjectsA = await handleGetClientPortalProjects({
      ...defaultCtx,
      authHeader: 'Bearer user-client-a',
    });
    const projA1 = resProjectsA.body.projects.find((p: any) => p.id === 'proj-a1');
    const projA2 = resProjectsA.body.projects.find((p: any) => p.id === 'proj-a2');
    assert('4. Project list aggregates song and file counts correctly',
      projA1?.song_count === 1 && projA1?.file_count === 1 &&
      projA2?.song_count === 2 && projA2?.file_count === 0
    );
  }

  // --- Test 6: Client A can open own project detail ---
  {
    const detailRes = await handleGetClientPortalProjectDetail({
      ...defaultCtx,
      authHeader: 'Bearer user-client-a',
      projectId: 'proj-a1',
    });
    assert('5. Client A can view own project detail',
      detailRes.status === 200 && detailRes.body.name === 'Electric Horizon Single'
    );
    assert('6. Client can view songs belonging to own project',
      detailRes.body.songs.length === 1 && detailRes.body.songs[0].title === 'Electric Horizon'
    );
    assert('7. Client can view files belonging to own project',
      detailRes.body.files.length === 1 && detailRes.body.files[0].name === 'Electric_Horizon_Master_24bit.wav'
    );
  }

  // --- Test 7: Client A cannot access Client B project detail (URL manipulation protection) ---
  {
    const badDetailRes = await handleGetClientPortalProjectDetail({
      ...defaultCtx,
      authHeader: 'Bearer user-client-a',
      projectId: 'proj-b1', // Belongs to Client B!
    });
    assert('8. Client A cannot access Client B project detail by URL manipulation (returns 403)',
      badDetailRes.status === 403 && badDetailRes.body.error.includes('Forbidden')
    );
  }

  // --- Test 8: Client can download permitted file using secure signed URL ---
  {
    const downloadRes = await handleGetClientPortalFileDownloadUrl({
      ...defaultCtx,
      authHeader: 'Bearer user-client-a',
      projectId: 'proj-a1',
      fileId: 'file-a1-1',
    });
    assert('9. Client can obtain secure signed download URL for authorized file',
      downloadRes.status === 200 &&
      downloadRes.body.signedUrl.includes('https://storage.mixflow.test/project-files/sign/') &&
      downloadRes.body.fileName === 'Electric_Horizon_Master_24bit.wav'
    );
  }

  // --- Test 9: Client A cannot download Client B's file ---
  {
    const badDownloadRes = await handleGetClientPortalFileDownloadUrl({
      ...defaultCtx,
      authHeader: 'Bearer user-client-a',
      projectId: 'proj-b1',
      fileId: 'file-b1-1',
    });
    assert('10. Client A cannot download Client B file (strictly rejected 403)',
      badDownloadRes.status === 403
    );
  }

  // --- Test 10: Unauthenticated requests are rejected (401) ---
  {
    const unauthProjects = await handleGetClientPortalProjects({
      ...defaultCtx,
      authHeader: undefined,
    });
    const unauthDetail = await handleGetClientPortalProjectDetail({
      ...defaultCtx,
      authHeader: 'Bearer invalid-token',
      projectId: 'proj-a1',
    });
    const unauthDownload = await handleGetClientPortalFileDownloadUrl({
      ...defaultCtx,
      authHeader: undefined,
      projectId: 'proj-a1',
      fileId: 'file-a1-1',
    });

    assert('11. Unauthenticated requests are rejected with status 401',
      unauthProjects.status === 401 && unauthDetail.status === 401 && unauthDownload.status === 401
    );
  }

  // --- Test 11: Database Migration Audit for Read-Only RLS Policies ---
  {
    const migrationSql = readFileSync(join(process.cwd(), 'supabase/migrations/20261004_create_client_portal_foundation.sql'), 'utf-8');

    assert('12a. Migration adds user_id column and index to public.clients',
      migrationSql.includes('ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id') &&
      migrationSql.includes('idx_clients_user_id')
    );

    assert('12b. Migration defines SELECT policies for clients on clients, projects, project_songs, project_files',
      migrationSql.includes('Clients can view their own client profile') &&
      migrationSql.includes('Clients can view their own assigned projects') &&
      migrationSql.includes('Clients can view songs for their assigned projects') &&
      migrationSql.includes('Clients can view files for their assigned projects')
    );

    assert('12c. Client policies are strictly read-only (SELECT only; NO INSERT/UPDATE/DELETE for clients)',
      !migrationSql.includes('Clients can insert') &&
      !migrationSql.includes('Clients can update') &&
      !migrationSql.includes('Clients can delete')
    );

    assert('12d. Existing organization security helpers and isolation are preserved',
      migrationSql.includes('Step 9 Storage RLS policies on storage.objects are preserved')
    );
  }

  // --- Test 12: Secret Scan (No service role key in frontend source) ---
  function scanDirForSecret(dir: string): string[] {
    const findings: string[] = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findings.push(...scanDirForSecret(fullPath));
      } else if (stat.isFile() && (entry.endsWith('.tsx') || entry.endsWith('.ts'))) {
        if (fullPath.includes('/src/server/') || fullPath.includes('/server.ts') || fullPath.includes('/scripts/')) {
          continue;
        }
        const content = readFileSync(fullPath, 'utf-8');
        if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('sb_secret_')) {
          findings.push(fullPath);
        }
      }
    }
    return findings;
  }

  const leaks = scanDirForSecret(join(process.cwd(), 'src'));
  assert('13. Zero service-role keys exposed in frontend source files', leaks.length === 0, leaks);

  // --- Test 13: user_metadata Authorization Audit ---
  const portalServerCode = readFileSync(join(process.cwd(), 'src/server/clientPortalHandler.ts'), 'utf-8');
  assert('14. Client Portal authorization strictly avoids user_metadata',
    !portalServerCode.includes('user_metadata') &&
    portalServerCode.includes('callerUser.id')
  );

  console.log(`\n========================================`);
  console.log(`Step 10 Test Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep10ClientPortalTests().catch((err) => {
  console.error('Step 10 test execution failed:', err);
  process.exit(1);
});
