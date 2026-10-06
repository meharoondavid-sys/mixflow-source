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

async function runStep11Tests() {
  console.log('=== Step 11: Versioned Audio Review & Hardened Security Verification Suite ===\n');

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
      console.log('ℹ [LIVE DB AUDIT] public.project_file_versions & public.project_feedback strictly deny anon (permission denied).');
      assert('0. Live Supabase database strictly denies anon access (401 permission denied)', true);
    } else {
      assert('0. Live Supabase database strictly denies anon access (401 permission denied)', false, { r1, r2 });
    }
  } catch (err: any) {
    console.error('Live DB check error:', err);
  }

  // --- Mock Database and Auth Setup for Functional Testing ---
  const mockUsers = [
    { id: 'user-engineer-1', email: 'alex@mixflow.com', name: 'Alex Rivera' },
    { id: 'user-client-a', email: 'maya@lin.com', name: 'Maya Lin' },
    { id: 'user-client-b', email: 'david@vance.com', name: 'David Vance' },
    { id: 'user-unregistered', email: 'stranger@example.com', name: 'Stranger' },
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

  const mockProjectFiles = [
    { id: 'file-a1', project_id: 'proj-a', name: 'Master_Deliverable.wav' },
    { id: 'file-b1', project_id: 'proj-b', name: 'Acoustic_Master.wav' },
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
            : table === 'project_files'
            ? [...mockProjectFiles]
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

  // --- 1. Version upload works ---
  let versionA1Id = '';
  {
    const reqUrlRes = await handleRequestVersionUploadUrl({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        songId: 'song-a1',
        fileName: 'Horizon_Dream_Mix_V1.wav',
        fileType: 'audio/wav',
        fileSize: 45000000,
        notes: 'Initial high-res mix pass.',
      },
    });

    assert('1. Version upload works (generates scoped upload URL and versionId)',
      reqUrlRes.status === 200 &&
      reqUrlRes.body.storagePath.startsWith('org-studio-1/proj-a/') &&
      Boolean(reqUrlRes.body.versionId)
    );

    versionA1Id = reqUrlRes.body.versionId;

    const confirmRes = await handleConfirmVersionUpload({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        versionId: versionA1Id,
        songId: 'song-a1',
        fileName: 'Horizon_Dream_Mix_V1.wav',
        storagePath: reqUrlRes.body.storagePath,
        fileType: 'audio/wav',
        fileSize: 45000000,
        durationSeconds: 215.5,
        notes: 'Initial high-res mix pass.',
      },
    });

    assert('2. Version numbering works (determines version_number = 1 for first upload)',
      confirmRes.status === 201 && confirmRes.body.version.version_number === 1
    );
  }

  // --- 3. v1 and v2 remain separate ---
  let versionA2Id = '';
  {
    const reqUrlRes = await handleRequestVersionUploadUrl({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        songId: 'song-a1',
        fileName: 'Horizon_Dream_Mix_V2.wav',
        fileType: 'audio/wav',
        fileSize: 46000000,
      },
    });

    versionA2Id = reqUrlRes.body.versionId;

    const confirmRes = await handleConfirmVersionUpload({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        versionId: versionA2Id,
        songId: 'song-a1',
        fileName: 'Horizon_Dream_Mix_V2.wav',
        storagePath: reqUrlRes.body.storagePath,
        fileType: 'audio/wav',
        fileSize: 46000000,
        durationSeconds: 215.5,
      },
    });

    assert('3a. v1 and v2 remain separate and both are preserved in database',
      confirmRes.status === 201 &&
      confirmRes.body.version.version_number === 2 &&
      versionA1Id !== versionA2Id &&
      mockVersions.length === 2
    );

    assert('3b. uploaded_by is authoritatively set to authenticated user',
      confirmRes.body.version.uploaded_by === 'user-engineer-1'
    );
  }

  // --- Relationship Mismatch Checks ---
  {
    // Song not in project
    const badSongReq = await handleRequestVersionUploadUrl({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        songId: 'song-b1', // belongs to proj-b
        fileName: 'mismatch.wav',
        fileType: 'audio/wav',
        fileSize: 1000,
      },
    });
    assert('3c. Song/project mismatch is strictly rejected (400)',
      badSongReq.status === 400
    );

    // File not in project
    const badFileReq = await handleRequestVersionUploadUrl({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-engineer-1',
      body: {
        fileId: 'file-b1', // belongs to proj-b
        fileName: 'mismatch.wav',
        fileType: 'audio/wav',
        fileSize: 1000,
      },
    });
    assert('3d. File/project mismatch is strictly rejected (400)',
      badFileReq.status === 400
    );
  }

  // --- 4. Client can view authorized versions ---
  {
    const listRes = await handleListProjectVersions({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-client-a',
    });
    assert('4. Client can view authorized versions of own assigned project',
      listRes.status === 200 && listRes.body.versions.length === 2
    );
  }

  // --- 5. Cross-client access is rejected ---
  {
    const badListRes = await handleListProjectVersions({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-client-b',
    });
    assert('5. Cross-client access is rejected with status 403',
      badListRes.status === 403
    );
  }

  // --- 6. Signed playback URLs work ---
  {
    const playRes = await handleGetVersionPlaybackUrl({
      ...defaultCtx,
      projectId: 'proj-a',
      versionId: versionA1Id,
      authHeader: 'Bearer user-client-a',
    });
    assert('6a. Signed playback URLs work for authorized client (short-lived signed URL)',
      playRes.status === 200 &&
      playRes.body.signedUrl.includes('/project-files/playback/') &&
      playRes.body.versionNumber === 1
    );

    const badPlayRes = await handleGetVersionPlaybackUrl({
      ...defaultCtx,
      projectId: 'proj-a',
      versionId: versionA1Id,
      authHeader: 'Bearer user-client-b',
    });
    assert('6b. Cross-client playback URL access is rejected with status 403',
      badPlayRes.status === 403
    );
  }

  // --- 7. Timestamped feedback works ---
  let feedbackId = '';
  {
    const fbRes = await handleCreateProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-client-a',
      body: {
        versionId: versionA1Id,
        songId: 'song-a1',
        timestampSeconds: 92.47,
        comment: 'Vocal reverb feels slightly too wet in the chorus here.',
      },
    });

    assert('7a. Timestamped feedback works for authorized client',
      fbRes.status === 201 && fbRes.body.feedback.version_id === versionA1Id
    );
    assert('7b. Feedback client_id belongs to authenticated client',
      fbRes.body.feedback.client_id === 'client-a'
    );
    assert('7c. Timestamp is stored as positive numeric decimal value',
      fbRes.body.feedback.timestamp_seconds === 92.47
    );
    feedbackId = fbRes.body.feedback.id;

    // Cross-client feedback submission is rejected
    const badFb = await handleCreateProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer user-client-b',
      body: {
        versionId: versionA1Id,
        timestampSeconds: 15,
        comment: 'Unauthorized note',
      },
    });
    assert('7d. Client cannot leave feedback on another client project (403)',
      badFb.status === 403
    );
  }

  // --- 8. Feedback remains attached to the correct version ---
  {
    const fbListV1 = await handleListProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      versionId: versionA1Id,
      authHeader: 'Bearer user-engineer-1',
    });
    const fbListV2 = await handleListProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      versionId: versionA2Id,
      authHeader: 'Bearer user-engineer-1',
    });

    assert('8. Feedback remains attached strictly to Version 1 (1 item) and Version 2 has 0',
      fbListV1.body.feedback.length === 1 && fbListV2.body.feedback.length === 0
    );
  }

  // --- 9. Client cannot modify resolution status ---
  {
    const clientReopen = await handleUpdateFeedbackStatus({
      ...defaultCtx,
      projectId: 'proj-a',
      feedbackId,
      authHeader: 'Bearer user-client-a',
      body: { status: 'resolved' },
    });

    assert('9. Client cannot modify resolution status (Forbidden 403)',
      clientReopen.status === 403
    );
  }

  // --- 10. Client cannot delete feedback & Version records cannot be deleted ---
  {
    // The server exposes no delete endpoints for versions or feedback
    const serverCode = readFileSync(join(process.cwd(), 'server.ts'), 'utf-8');
    const hasVersionDeleteRoute = serverCode.includes("app.delete('/api/projects/:projectId/versions");
    const hasFeedbackDeleteRoute = serverCode.includes("app.delete('/api/projects/:projectId/feedback");

    assert('10a. Client cannot delete feedback (no feedback delete endpoint exists)',
      !hasFeedbackDeleteRoute
    );
    assert('10b. Version records cannot be deleted (no version delete endpoint exists)',
      !hasVersionDeleteRoute
    );
  }

  // --- 11. Engineer can resolve/reopen feedback ---
  {
    const resolveRes = await handleUpdateFeedbackStatus({
      ...defaultCtx,
      projectId: 'proj-a',
      feedbackId,
      authHeader: 'Bearer user-engineer-1',
      body: { status: 'resolved' },
    });

    assert('11a. Engineer can resolve feedback',
      resolveRes.status === 200 && resolveRes.body.feedback.status === 'resolved'
    );

    const reopenRes = await handleUpdateFeedbackStatus({
      ...defaultCtx,
      projectId: 'proj-a',
      feedbackId,
      authHeader: 'Bearer user-engineer-1',
      body: { status: 'open' },
    });

    assert('11b. Engineer can reopen feedback',
      reopenRes.status === 200 && reopenRes.body.feedback.status === 'open'
    );
  }

  // --- 12. Unauthorized access returns 401/403 ---
  {
    const unauthVersions = await handleListProjectVersions({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: undefined,
    });
    const unauthFeedback = await handleCreateProjectFeedback({
      ...defaultCtx,
      projectId: 'proj-a',
      authHeader: 'Bearer invalid-token',
      body: { versionId: versionA1Id, timestampSeconds: 10, comment: 'test' },
    });

    assert('12. Unauthorized access returns 401',
      unauthVersions.status === 401 && unauthFeedback.status === 401
    );
  }

  // --- 13. No service-role key in frontend ---
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
  assert('13. No service-role key exposed in frontend source files', leaks.length === 0, leaks);

  // --- 14. No user_metadata authorization ---
  const versionHandlerCode = readFileSync(join(process.cwd(), 'src/server/versionReviewHandler.ts'), 'utf-8');
  assert('14. No user_metadata authorization used anywhere in Step 11',
    !versionHandlerCode.includes('user_metadata') &&
    versionHandlerCode.includes('callerUser.id')
  );

  console.log(`\n========================================`);
  console.log(`Step 11 Test Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep11Tests().catch((err) => {
  console.error('Step 11 test failed:', err);
  process.exit(1);
});
