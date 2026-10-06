import {
  handleListProjectVersions,
  handleRequestVersionUploadUrl,
  handleConfirmVersionUpload,
  handleGetVersionPlaybackUrl,
  handleListProjectFeedback,
  handleCreateProjectFeedback,
  handleUpdateFeedbackStatus,
} from '../src/server/versionReviewHandler.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

async function runStep12Tests() {
  console.log('=== Step 12: Practical Revision Workflow Verification Suite ===\n');

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

  // --- 0. LIVE DATABASE AUDIT ---
  try {
    const liveClient = createClient(
      'https://amgowwvresmsysofwqsp.supabase.co',
      'sb_publishable_8uYzlSxXc0IBIm4a4_DTkA_h1TJcZGV'
    );
    const r1 = await liveClient.from('project_file_versions').select('id').limit(1);
    const r2 = await liveClient.from('project_feedback').select('id').limit(1);

    const isAnonBlockedV = r1.status === 401 && r1.error?.message?.includes('permission denied for table');
    const isAnonBlockedF = r2.status === 401 && r2.error?.message?.includes('permission denied for table');

    if (isAnonBlockedV && isAnonBlockedF) {
      console.log('ℹ [LIVE DB AUDIT] Anon has ZERO privileges on public.project_file_versions & public.project_feedback.');
      assert('0. Live Supabase database strictly denies anon access (401 permission denied)', true);
    } else {
      assert('0. Live Supabase database strictly denies anon access (401 permission denied)', false, { r1, r2 });
    }
  } catch (err: any) {
    console.error('Live DB check error:', err);
  }

  // --- Mock Database and Auth Setup ---
  const mockUsers = [
    { id: 'user-engineer-1', email: 'alex@mixflow.com', name: 'Alex Rivera' },
    { id: 'user-client-a', email: 'maya@lin.com', name: 'Maya Lin' },
    { id: 'user-client-b', email: 'david@vance.com', name: 'David Vance' },
  ];

  const mockOrgMembers = [
    { id: 'mem-1', organization_id: 'org-studio-1', user_id: 'user-engineer-1', role: 'engineer' },
  ];

  const mockClients = [
    { id: 'client-a', organization_id: 'org-studio-1', user_id: 'user-client-a', full_name: 'Maya Lin', email: 'maya@lin.com' },
    { id: 'client-b', organization_id: 'org-studio-1', user_id: 'user-client-b', full_name: 'David Vance', email: 'david@vance.com' },
  ];

  const mockProjects = [
    { id: 'proj-a', organization_id: 'org-studio-1', client_id: 'client-a', name: 'Maya Electronic EP' },
    { id: 'proj-b', organization_id: 'org-studio-1', client_id: 'client-b', name: 'David Acoustic Single' },
  ];

  const mockSongs = [
    { id: 'song-a1', project_id: 'proj-a', title: 'Horizon Dream', track_number: 1 },
    { id: 'song-b1', project_id: 'proj-b', title: 'Acoustic Soul', track_number: 1 },
  ];

  let mockVersions: any[] = [];
  let mockFeedback: any[] = [];

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
          table === 'projects'
            ? [...mockProjects]
            : table === 'clients'
            ? [...mockClients]
            : table === 'project_songs'
            ? [...mockSongs]
            : table === 'organization_members'
            ? [...mockOrgMembers]
            : table === 'project_file_versions'
            ? mockVersions
            : table === 'project_feedback'
            ? mockFeedback
            : table === 'profiles'
            ? mockUsers.map((u) => ({ id: u.id, full_name: u.name, email: u.email }))
            : [];

        let filters: Array<(item: any) => boolean> = [];
        let orderBy: { field: string; ascending: boolean } | null = null;
        let limitVal: number | null = null;

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
          order: (field: string, opts?: { ascending?: boolean }) => {
            orderBy = { field, ascending: opts?.ascending ?? true };
            return queryObj;
          },
          limit: (n: number) => {
            limitVal = n;
            return queryObj;
          },
          maybeSingle: async () => {
            const filtered = currentData.filter((item) => filters.every((f) => f(item)));
            return { data: filtered[0] || null, error: null };
          },
          single: async () => {
            const filtered = currentData.filter((item) => filters.every((f) => f(item)));
            return { data: filtered[0] || null, error: null };
          },
          insert: (record: any) => {
            if (Array.isArray(record)) {
              currentData.push(...record);
            } else {
              currentData.push(record);
            }
            return {
              select: () => ({
                single: async () => ({ data: record, error: null }),
              }),
            };
          },
          update: (updates: any) => {
            let updatedRow: any = null;
            return {
              eq: (f1: string, v1: any) => ({
                eq: (f2: string, v2: any) => ({
                  select: () => ({
                    single: async () => {
                      const idx = currentData.findIndex((item) => item[f1] === v1 && item[f2] === v2);
                      if (idx >= 0) {
                        currentData[idx] = { ...currentData[idx], ...updates };
                        updatedRow = currentData[idx];
                      }
                      return { data: updatedRow, error: null };
                    },
                  }),
                }),
              }),
            };
          },
          then: (resolve: any) => {
            let filtered = currentData.filter((item) => filters.every((f) => f(item)));
            if (orderBy) {
              const { field, ascending } = orderBy;
              filtered.sort((a, b) => {
                if (a[field] < b[field]) return ascending ? -1 : 1;
                if (a[field] > b[field]) return ascending ? 1 : -1;
                return 0;
              });
            }
            if (limitVal !== null) {
              filtered = filtered.slice(0, limitVal);
            }
            return resolve({ data: filtered, error: null });
          },
        };
        return queryObj;
      },
      storage: {
        from: (bucket: string) => ({
          createSignedUploadUrl: async (path: string) => ({
            data: { signedUrl: `https://storage.mixflow.test/${bucket}/upload/${path}?token=sign-up`, token: 'sign-up' },
            error: null,
          }),
          createSignedUrl: async (path: string, expiresIn: number) => ({
            data: { signedUrl: `https://storage.mixflow.test/${bucket}/playback/${path}?exp=${expiresIn}` },
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

  // =========================================================================
  // STEP 12 WORKFLOW:
  // Version 1 -> Client reviews & leaves notes -> Engineer addresses & resolves
  // -> Engineer uploads Version 2 -> Client reviews Version 2 -> Workflow continues
  // =========================================================================

  // 1. Engineer uploads Version 1
  let v1Id = '';
  {
    const req1 = await handleRequestVersionUploadUrl({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        songId: 'song-a1',
        fileName: 'Horizon_Dream_Mix_v1.wav',
        fileType: 'audio/wav',
        fileSize: 42000000,
        notes: 'Initial rough mix pass.',
      },
    });

    const conf1 = await handleConfirmVersionUpload({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        versionId: req1.body.versionId,
        songId: 'song-a1',
        fileName: 'Horizon_Dream_Mix_v1.wav',
        storagePath: req1.body.storagePath,
        fileType: 'audio/wav',
        fileSize: 42000000,
        durationSeconds: 210,
        notes: 'Initial rough mix pass.',
      },
    });

    v1Id = conf1.body.version.id;
    assert('1. Engineer uploads Version 1 (version_number = 1, immutable)',
      conf1.status === 201 && conf1.body.version.version_number === 1
    );
  }

  // 2. Client reviews Version 1 and leaves 2 timestamped feedback notes
  let note1Id = '';
  let note2Id = '';
  {
    const note1 = await handleCreateProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-client-a',
      body: {
        versionId: v1Id,
        songId: 'song-a1',
        timestampSeconds: 45.2,
        comment: 'Vocal lead is slightly low in the verse.',
      },
    });

    const note2 = await handleCreateProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-client-a',
      body: {
        versionId: v1Id,
        songId: 'song-a1',
        timestampSeconds: 120.0,
        comment: 'Snare reverb tail feels a bit too long in chorus 2.',
      },
    });

    note1Id = note1.body.feedback.id;
    note2Id = note2.body.feedback.id;

    assert('2a. Client submits feedback note 1 on Version 1 (status = open)',
      note1.status === 201 && note1.body.feedback.status === 'open' && note1.body.feedback.version_id === v1Id
    );
    assert('2b. Client submits feedback note 2 on Version 1 (status = open)',
      note2.status === 201 && note2.body.feedback.status === 'open' && note2.body.feedback.version_id === v1Id
    );
  }

  // 3. Check version metrics for Version 1
  {
    const listRes = await handleListProjectVersions({
      ...defaultCtx,
      projectId: 'proj-a',
      songId: 'song-a1',
      authHeader: 'Bearer user-engineer-1',
    });

    const v1 = listRes.body.versions.find((v: any) => v.id === v1Id);
    assert('3. Version 1 metrics reflect 2 total feedback, 2 open, 0 resolved, is_latest: true',
      v1.feedback_count === 2 &&
      v1.open_feedback_count === 2 &&
      v1.resolved_feedback_count === 0 &&
      v1.is_latest === true
    );
  }

  // 4. Engineer addresses feedback and resolves Note 1
  {
    const resolveRes = await handleUpdateFeedbackStatus({
      ...defaultCtx,
      projectId: 'proj-a',
      feedbackId: note1Id,
      authHeader: 'Bearer user-engineer-1',
      body: { status: 'resolved' },
    });

    assert('4a. Engineer marks Note 1 as resolved (status = resolved, resolved_by recorded)',
      resolveRes.status === 200 &&
      resolveRes.body.feedback.status === 'resolved' &&
      resolveRes.body.feedback.resolved_by === 'user-engineer-1' &&
      Boolean(resolveRes.body.feedback.resolved_at)
    );

    // Client is strictly forbidden from changing resolution status
    const clientAttempt = await handleUpdateFeedbackStatus({
      ...defaultCtx,
      projectId: 'proj-a',
      feedbackId: note2Id,
      authHeader: 'Bearer user-client-a',
      body: { status: 'resolved' },
    });

    assert('4b. Client cannot resolve feedback (Forbidden 403)',
      clientAttempt.status === 403
    );
  }

  // 5. Engineer uploads Version 2 (Revision pass)
  let v2Id = '';
  {
    const req2 = await handleRequestVersionUploadUrl({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        songId: 'song-a1',
        fileName: 'Horizon_Dream_Mix_v2.wav',
        fileType: 'audio/wav',
        fileSize: 42500000,
        notes: 'Raised vocal +1.5dB in verse and shortened snare reverb.',
      },
    });

    const conf2 = await handleConfirmVersionUpload({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        versionId: req2.body.versionId,
        songId: 'song-a1',
        fileName: 'Horizon_Dream_Mix_v2.wav',
        storagePath: req2.body.storagePath,
        fileType: 'audio/wav',
        fileSize: 42500000,
        durationSeconds: 210,
        notes: 'Raised vocal +1.5dB in verse and shortened snare reverb.',
      },
    });

    v2Id = conf2.body.version.id;
    assert('5a. Engineer uploads Version 2 as revision pass (version_number = 2)',
      conf2.status === 201 && conf2.body.version.version_number === 2 && v2Id !== v1Id
    );

    assert('5b. Version 1 and Version 2 are distinct Storage objects without overwriting',
      req2.body.storagePath !== mockVersions[0].storage_path
    );
  }

  // 6. Check that feedback on Version 1 did NOT automatically resolve or migrate to Version 2
  {
    const v1Notes = await handleListProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      versionId: v1Id,
      authHeader: 'Bearer user-engineer-1',
    });

    const v2Notes = await handleListProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      versionId: v2Id,
      authHeader: 'Bearer user-engineer-1',
    });

    assert('6a. Version 1 retains Note 1 (resolved) and Note 2 (open) without automatic resolution',
      v1Notes.body.feedback.length === 2 &&
      v1Notes.body.feedback.find((f: any) => f.id === note1Id).status === 'resolved' &&
      v1Notes.body.feedback.find((f: any) => f.id === note2Id).status === 'open'
    );

    assert('6b. Version 2 starts with 0 feedback items (independent feedback context)',
      v2Notes.body.feedback.length === 0
    );
  }

  // 7. Verify version history & latest flag
  {
    const listRes = await handleListProjectVersions({
      ...defaultCtx,
      projectId: 'proj-a',
      songId: 'song-a1',
      authHeader: 'Bearer user-client-a',
    });

    const v1 = listRes.body.versions.find((v: any) => v.id === v1Id);
    const v2 = listRes.body.versions.find((v: any) => v.id === v2Id);

    assert('7a. Version 2 is marked as is_latest: true', v2.is_latest === true);
    assert('7b. Version 1 is marked as is_latest: false (historical pass)', v1.is_latest === false);
    assert('7c. Version 1 breakdown shows 1 open, 1 resolved note',
      v1.open_feedback_count === 1 && v1.resolved_feedback_count === 1
    );
  }

  // 8. Client reviews Version 2 and leaves feedback on Version 2
  {
    const note3 = await handleCreateProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-client-a',
      body: {
        versionId: v2Id,
        songId: 'song-a1',
        timestampSeconds: 180.5,
        comment: 'Vocal level is perfect now! Can we add a subtle stereo sweep at the outro?',
      },
    });

    assert('8. Client leaves new feedback on Version 2 (anchored strictly to Version 2)',
      note3.status === 201 && note3.body.feedback.version_id === v2Id
    );
  }

  // 9. Engineer can reopen Note 1 if needed
  {
    const reopenRes = await handleUpdateFeedbackStatus({
      ...defaultCtx,
      projectId: 'proj-a',
      feedbackId: note1Id,
      authHeader: 'Bearer user-engineer-1',
      body: { status: 'open' },
    });

    assert('9. Engineer can toggle feedback back to open if revision requires further work',
      reopenRes.status === 200 && reopenRes.body.feedback.status === 'open'
    );
  }

  // 10. Cross-client security check
  {
    const badClientVersions = await handleListProjectVersions({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-client-b',
    });

    const badClientFeedback = await handleCreateProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-client-b',
      body: { versionId: v2Id, timestampSeconds: 10, comment: 'Illegal note' },
    });

    assert('10. Cross-client access to versions and feedback is strictly rejected (403)',
      badClientVersions.status === 403 && badClientFeedback.status === 403
    );
  }

  // 11. Immutability checks: No delete routes exist
  {
    const serverCode = readFileSync(join(process.cwd(), 'server.ts'), 'utf-8');
    const hasVersionDelete = serverCode.includes("app.delete('/api/projects/:projectId/versions");
    const hasFeedbackDelete = serverCode.includes("app.delete('/api/projects/:projectId/feedback");

    assert('11a. No version DELETE endpoint in application (versions are immutable)', !hasVersionDelete);
    assert('11b. No feedback DELETE endpoint in application (feedback cannot be deleted)', !hasFeedbackDelete);
  }

  // 12. Frontend secret scan
  function scanDirForSecret(dir: string): string[] {
    const findings: string[] = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', 'build', 'scripts'].includes(entry)) continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findings.push(...scanDirForSecret(fullPath));
      } else if (stat.isFile() && (entry.endsWith('.tsx') || entry.endsWith('.ts'))) {
        if (fullPath.includes('/src/server/') || fullPath.includes('/server.ts')) continue;
        const content = readFileSync(fullPath, 'utf-8');
        if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('sb_secret_')) {
          findings.push(fullPath);
        }
      }
    }
    return findings;
  }

  const leaks = scanDirForSecret(join(process.cwd(), 'src'));
  assert('12. No service-role keys in frontend source files', leaks.length === 0, leaks);

  // 13. No user_metadata authorization
  const filesToScan = [
    'src/server/versionReviewHandler.ts',
    'src/components/client/ClientAudioReviewView.tsx',
    'src/components/engineer/ProjectFeedbackTab.tsx',
  ];
  let metaFound = false;
  for (const f of filesToScan) {
    if (readFileSync(join(process.cwd(), f), 'utf-8').includes('user_metadata')) {
      metaFound = true;
    }
  }
  assert('13. No user_metadata authorization in Step 12 files', !metaFound);

  console.log(`\n========================================`);
  console.log(`Step 12 Test Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep12Tests().catch((err) => {
  console.error('Step 12 test failed:', err);
  process.exit(1);
});
