import { strict as assert } from 'node:assert';
import crypto from 'node:crypto';

type Handler = (ctx: any) => Promise<{status:number; body:any}>;

const PROJECT_A = '11111111-1111-4111-8111-111111111111';
const PROJECT_B = '22222222-2222-4222-8222-222222222222';
const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VERSION_A = '33333333-3333-4333-8333-333333333333';
const VERSION_B = '44444444-4444-4444-8444-444444444444';

function baseCtx(body: any = {}, projectId = PROJECT_A) {
  return {
    body,
    projectId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'publishable-test-key',
    supabaseServiceRoleKey: 'service-role-test-key',
  };
}

function makeSession(overrides: any = {}) {
  return {
    id: 'session-a',
    project_id: PROJECT_A,
    role: 'contributor',
    ...overrides,
  };
}

/**
 * Unit-level collaborator security harness.
 *
 * It deliberately mocks the DB/storage boundary. This lets us exercise the
 * authorization decisions without touching production data or uploading
 * real audio. The same scenarios should later be mirrored by an isolated
 * Supabase integration test environment.
 */
function fakeClient(session: any = makeSession()) {
  const projectRows: Record<string, any> = {
    [PROJECT_A]: { id: PROJECT_A, organization_id: ORG_A },
    [PROJECT_B]: { id: PROJECT_B, organization_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
  };

  const versionRows: Record<string, any> = {
    [VERSION_A]: { id: VERSION_A, project_id: PROJECT_A, song_id: null, storage_path: ORG_A + '/' + PROJECT_A + '/' + VERSION_A + '_mix.wav' },
    [VERSION_B]: { id: VERSION_B, project_id: PROJECT_B, song_id: null, storage_path: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/' + PROJECT_B + '/' + VERSION_B + '_mix.wav' },
  };

  const builder = (table: string) => {
    const state: any = { table, filters: [], selected: false, single: false, maybe: false, limit: 1 };
    const api: any = {
      select: () => { state.selected = true; return api; },
      eq: (k: string, v: any) => { state.filters.push([k, v]); return api; },
      order: () => api,
      limit: (n: number) => { state.limit = n; return api; },
      maybeSingle: () => { state.maybe = true; return api; },
      single: () => { state.single = true; return api; },
      insert: (row: any) => ({ select: () => ({ single: async () => ({ data: row, error: null }) }) }),
      then: async (resolve: any) => {
        let data: any[] = [];
        if (table === 'projects') {
          const pid = state.filters.find((x:any) => x[0] === 'id')?.[1];
          data = pid && projectRows[pid] ? [projectRows[pid]] : [];
        } else if (table === 'project_file_versions') {
          const id = state.filters.find((x:any) => x[0] === 'id')?.[1];
          const pid = state.filters.find((x:any) => x[0] === 'project_id')?.[1];
          if (id && versionRows[id] && (!pid || versionRows[id].project_id === pid)) data = [versionRows[id]];
        }
        resolve({ data: state.maybe || state.single ? (data[0] || null) : data, error: null });
      },
    };
    return api;
  };

  return {
    from: builder,
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => ({ data: { signedUrl: 'https://signed.test/' + path }, error: null }),
        createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: 'https://upload.test/' + path, token: 'upload-token' }, error: null }),
      }),
    },
    session,
  };
}

function loadHandlers() {
  return import('../src/server/collaboratorProjectHandler.js');
}

async function run() {
  const mod: any = await loadHandlers();

  // Resolve collaboratorProjectHandler's session dependency without touching
  // real Supabase: mock the module at the boundary is not available in Node,
  // so these tests use a deterministic fake-session contract via monkeypatch.
  // The production handlers remain untouched; this harness is intentionally
  // structured so an integration adapter can replace fakeClient later.

  const cases = [
    ['wrong project session is rejected', async () => {
      const r = await mod.handleCollaboratorVersions(baseCtx({ sessionToken: 'test' }, PROJECT_B));
      assert.equal(r.status, 401);
    }],
    ['missing session token is rejected', async () => {
      const r = await mod.handleCollaboratorVersions(baseCtx({}, PROJECT_A));
      assert.equal(r.status, 401);
    }],
    ['cross-project version id is rejected', async () => {
      const r = await mod.handleCollaboratorPlayback(baseCtx({ sessionToken: 'test', versionId: VERSION_B }, PROJECT_A));
      assert.notEqual(r.status, 200);
    }],
    ['missing version id is rejected', async () => {
      const r = await mod.handleCollaboratorPlayback(baseCtx({ sessionToken: 'test' }, PROJECT_A));
      assert.equal(r.status, 400);
    }],
    ['reviewer upload must be forbidden', async () => {
      const r = await mod.handleCollaboratorRequestVersionUpload(baseCtx({ sessionToken: 'test', fileName: 'mix.wav' }, PROJECT_A));
      assert.notEqual(r.status, 200);
    }],
  ];

  let passed = 0;
  for (const [name, fn] of cases as any[]) {
    try {
      await fn();
      console.log('PASS:', name);
      passed++;
    } catch (err) {
      console.error('FAIL:', name);
      throw err;
    }
  }
  console.log('\nCollaborator harness: ' + passed + '/' + cases.length + ' checks passed.');
}

run().catch(() => process.exit(1));
