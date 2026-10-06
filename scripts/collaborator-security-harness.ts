import { strict as assert } from 'node:assert';
import crypto from 'node:crypto';
import {
  handleCollaboratorFileDownload,
  handleCollaboratorPlayback,
  handleCollaboratorRequestVersionUpload,
  handleCollaboratorConfirmVersion,
  handleCollaboratorCreateFeedback,
} from '../src/server/collaboratorProjectHandler.js';
import { handleAcceptCollaboratorInvite, resolveCollaboratorSession } from '../src/server/collaboratorHandler.js';

const PROJECT_A = '11111111-1111-4111-8111-111111111111';
const PROJECT_B = '22222222-2222-4222-8222-222222222222';
const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VERSION_A = '33333333-3333-4333-8333-333333333333';
const VERSION_B = '44444444-4444-4444-8444-444444444444';

const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();

type State = {
  sessions: any[];
  invites: any[];
  projects: any[];
  versions: any[];
  files: any[];
  feedback: any[];
};

function createState(overrides: Partial<State> = {}): State {
  return {
    sessions: [{
      id: 'session-contributor',
      project_id: PROJECT_A,
      role: 'contributor',
      token_hash: sha('contributor-token'),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      revoked_at: null,
    }, {
      id: 'session-reviewer',
      project_id: PROJECT_A,
      role: 'reviewer',
      token_hash: sha('reviewer-token'),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      revoked_at: null,
    }, {
      id: 'session-expired',
      project_id: PROJECT_A,
      role: 'contributor',
      token_hash: sha('expired-token'),
      expires_at: new Date(Date.now() - 1000).toISOString(),
      revoked_at: null,
    }, {
      id: 'session-revoked',
      project_id: PROJECT_A,
      role: 'contributor',
      token_hash: sha('revoked-token'),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      revoked_at: now(),
    }],
    invites: [{
      id: 'invite-a',
      project_id: PROJECT_A,
      organization_id: ORG_A,
      name: 'Raphael',
      email: 'raphael@example.com',
      role: 'contributor',
      token_hash: sha('invite-token'),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      accepted_at: null,
      revoked_at: null,
    }],
    projects: [
      { id: PROJECT_A, organization_id: ORG_A },
      { id: PROJECT_B, organization_id: ORG_B },
    ],
    versions: [
      { id: VERSION_A, project_id: PROJECT_A, song_id: null, storage_path: `${ORG_A}/${PROJECT_A}/${VERSION_A}_mix.wav`, version_number: 1 },
      { id: VERSION_B, project_id: PROJECT_B, song_id: null, storage_path: `${ORG_B}/${PROJECT_B}/${VERSION_B}_mix.wav`, version_number: 1 },
    ],
    files: [{
      id: 'file-a',
      project_id: PROJECT_A,
      name: 'multitrack.zip',
      file_type: 'application/zip',
      storage_path: `${ORG_A}/${PROJECT_A}/file-a_multitrack.zip`,
    }, {
      id: 'file-spoof',
      project_id: PROJECT_A,
      name: 'spoof.wav',
      file_type: 'audio/wav',
      storage_path: `${ORG_B}/${PROJECT_B}/file-spoof.wav`,
    }],
    feedback: [],
    ...overrides,
  };
}

function createClient(state: State) {
  return (_url: string, _key: string) => {
    const client: any = {
      from(table: string) {
        const query: any = {
          op: 'select',
          filters: [] as [string, any][],
          payload: null as any,
          limitValue: Infinity,
          update(values: any) { query.op = 'update'; query.payload = values; return query; },
          insert(values: any) { query.op = 'insert'; query.payload = values; return query; },
          select() { query.selectAfterWrite = true; return query; },
          eq(field: string, value: any) { query.filters.push([field, value]); return query; },
          is(field: string, value: any) { query.filters.push([field, { is: value }]); return query; },
          order() { return query; },
          limit(value: number) { query.limitValue = value; return query; },
          maybeSingle() { query.singleMode = 'maybe'; return query; },
          single() { query.singleMode = 'single'; return query; },
          then(resolve: (value: any) => any, reject?: (reason: any) => any) {
            try {
              const rows = (state as any)[table === 'project_collaborator_sessions' ? 'sessions' :
                table === 'project_collaborator_invites' ? 'invites' :
                table === 'projects' ? 'projects' :
                table === 'project_file_versions' ? 'versions' :
                table === 'project_files' ? 'files' :
                table === 'project_feedback' ? 'feedback' : 'unknown'] || [];

              const matches = (row: any) => query.filters.every(([field, expected]) =>
                typeof expected === 'object' && expected && 'is' in expected
                  ? (expected.is === null ? row[field] == null : row[field] === expected.is)
                  : row[field] === expected
              );

              if (query.op === 'insert') {
                const values = Array.isArray(query.payload) ? query.payload : [query.payload];
                state[(table === 'project_collaborator_sessions' ? 'sessions' :
                  table === 'project_feedback' ? 'feedback' :
                  table === 'project_file_versions' ? 'versions' : 'unknown')].push(...values);
                const data = values[0];
                return Promise.resolve(resolve({ data, error: null }));
              }

              if (query.op === 'update') {
                const affected = rows.filter(matches);
                affected.forEach((row: any) => Object.assign(row, query.payload));
                return Promise.resolve(resolve({ data: query.singleMode ? (affected[0] || null) : affected, error: null }));
              }

              const found = rows.filter(matches).slice(0, query.limitValue);
              const data = query.singleMode ? (found[0] || null) : found;
              return Promise.resolve(resolve({ data, error: null }));
            } catch (e) {
              if (reject) return Promise.resolve(reject(e));
              throw e;
            }
          },
        };
        return query;
      },
      storage: {
        from() {
          return {
            createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed.test/${path}` }, error: null }),
            createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://upload.test/${path}`, token: 'upload-token' }, error: null }),
          };
        },
      },
    };
    return client;
  };
}

const ctx = (state: State, body: any, projectId = PROJECT_A) => ({
  body,
  projectId,
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-anon',
  supabaseServiceRoleKey: 'test-service-role',
  createClientFn: createClient(state) as any,
});

async function run() {
  const checks: [string, () => Promise<void>][] = [
    ['fresh invite can be accepted once', async () => {
      const state = createState();
      const first = await handleAcceptCollaboratorInvite(ctx(state, { inviteToken: 'invite-token' }));
      assert.equal(first.status, 200);
      assert.ok(first.body.session_token);
      assert.equal(state.invites[0].accepted_at !== null, true);

      const second = await handleAcceptCollaboratorInvite(ctx(state, { inviteToken: 'invite-token' }));
      assert.equal(second.status, 410);
    }],
    ['missing session is rejected', async () => {
      const r = await handleCollaboratorPlayback(ctx(createState(), { versionId: VERSION_A }, PROJECT_A));
      assert.equal(r.status, 401);
    }],
    ['session cannot cross projects', async () => {
      const r = await handleCollaboratorPlayback(ctx(createState(), { sessionToken: 'contributor-token', versionId: VERSION_A }, PROJECT_B));
      assert.equal(r.status, 401);
    }],
    ['expired session is rejected', async () => {
      const r = await handleCollaboratorPlayback(ctx(createState(), { sessionToken: 'expired-token', versionId: VERSION_A }));
      assert.equal(r.status, 401);
    }],
    ['revoked session is rejected', async () => {
      const r = await handleCollaboratorPlayback(ctx(createState(), { sessionToken: 'revoked-token', versionId: VERSION_A }));
      assert.equal(r.status, 401);
    }],
    ['reviewer cannot request upload URL', async () => {
      const r = await handleCollaboratorRequestVersionUpload(ctx(createState(), { sessionToken: 'reviewer-token', fileName: 'mix.wav' }));
      assert.equal(r.status, 403);
    }],
    ['cross-project version cannot be played', async () => {
      const r = await handleCollaboratorPlayback(ctx(createState(), { sessionToken: 'contributor-token', versionId: VERSION_B }));
      assert.equal(r.status, 404);
    }],
    ['spoofed file storage path is blocked', async () => {
      const r = await handleCollaboratorFileDownload(ctx(createState(), { sessionToken: 'contributor-token', fileId: 'file-spoof' }));
      assert.equal(r.status, 403);
    }],
    ['version storage path must match version ID', async () => {
      const r = await handleCollaboratorConfirmVersion(ctx(createState(), {
        sessionToken: 'contributor-token',
        versionId: VERSION_A,
        storagePath: `${ORG_A}/${PROJECT_A}/${VERSION_B}_spoof.wav`,
        fileName: 'spoof.wav',
      }));
      assert.equal(r.status, 400);
    }],
    ['cross-project feedback is blocked', async () => {
      const r = await handleCollaboratorCreateFeedback(ctx(createState(), {
        sessionToken: 'contributor-token',
        versionId: VERSION_B,
        timestampSeconds: 12,
        comment: 'Cross-project attempt',
      }));
      assert.equal(r.status, 400);
    }],
    ['valid collaborator feedback is accepted', async () => {
      const state = createState();
      const r = await handleCollaboratorCreateFeedback(ctx(state, {
        sessionToken: 'contributor-token',
        versionId: VERSION_A,
        timestampSeconds: 12,
        comment: 'Kick needs more weight',
      }));
      assert.equal(r.status, 201);
      assert.equal(state.feedback.length, 1);
      assert.equal(state.feedback[0].author_role, 'collaborator');
      assert.equal(state.feedback[0].author_name, 'Raphael');
    }],
    ['contributor can request upload URL', async () => {
      const r = await handleCollaboratorRequestVersionUpload(ctx(createState(), {
        sessionToken: 'contributor-token',
        fileName: 'mix v2.wav',
      }));
      assert.equal(r.status, 200);
      assert.match(r.body.storagePath, new RegExp(`^${ORG_A}/${PROJECT_A}/`));
    }],
    ['valid session resolver updates last-seen state', async () => {
      const state = createState();
      const r = await resolveCollaboratorSession(ctx(state, {}), 'contributor-token');
      assert.ok(r);
      assert.equal(r?.project_id, PROJECT_A);
      assert.ok(state.sessions.find(s => s.id === 'session-contributor')?.last_seen_at);
    }],
  ];

  let passed = 0;
  for (const [name, check] of checks) {
    await check();
    console.log(`PASS  ${name}`);
    passed++;
  }

  console.log(`\\nCollaborator security harness: ${passed}/${checks.length} checks passed.`);
}

run().catch(error => {
  console.error('FAIL  collaborator security harness');
  console.error(error);
  process.exit(1);
});
