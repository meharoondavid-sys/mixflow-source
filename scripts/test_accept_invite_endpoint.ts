import { handleAcceptInvitation } from '../src/server/acceptInviteHandler.js';

interface MockInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  invited_by: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MockOrgMember {
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

async function runTestSuite() {
  console.log('=== Step 6C Endpoint Security & Logic Verification Suite ===\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, actual: any) {
    if (condition) {
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${name}`);
      console.error('  Actual output:', JSON.stringify(actual, null, 2));
      failed++;
    }
  }

  // Test 1: Unauthenticated request -> 401
  const res1 = await handleAcceptInvitation({
    authHeader: undefined,
    body: { invitation_id: 'inv-123' },
    supabaseUrl: 'https://mock.supabase.co',
    supabaseAnonKey: 'mock-anon',
    supabaseServiceRoleKey: 'mock-service',
  });
  assert('1. Unauthenticated request returns 401', res1.status === 401, res1);

  // Test 1b: Malformed / empty token -> 401
  const res1b = await handleAcceptInvitation({
    authHeader: 'Bearer ',
    body: {},
    supabaseUrl: 'https://mock.supabase.co',
    supabaseAnonKey: 'mock-anon',
    supabaseServiceRoleKey: 'mock-service',
  });
  assert('1b. Empty token returns 401', res1b.status === 401, res1b);

  // Helper factory for testing with stateful in-memory mock database
  function createMockEnvironment({
    callerUser = { id: 'user-alice-uuid', email: 'alice@studio.com' },
    initialInvitations = [] as MockInvitation[],
    initialMembers = [] as MockOrgMember[],
    authError = null as any,
  }) {
    let invitations: MockInvitation[] = JSON.parse(JSON.stringify(initialInvitations));
    let members: MockOrgMember[] = JSON.parse(JSON.stringify(initialMembers));

    const mockCreateClient = (url: string, key: string) => {
      return {
        auth: {
          getUser: async (_token: string) => {
            if (authError) return { data: { user: null }, error: authError };
            return { data: { user: callerUser }, error: null };
          },
        },
        from: (table: string) => {
          let selectedCols = '*';
          let filters: Record<string, any> = {};

          const queryBuilder: any = {
            select: (cols: string) => {
              selectedCols = cols;
              return queryBuilder;
            },
            eq: (col: string, val: any) => {
              filters[col] = val;
              return queryBuilder;
            },
            ilike: (col: string, val: any) => {
              filters[col] = val.toLowerCase();
              return queryBuilder;
            },
            order: (_col: string, _opts: any) => {
              return queryBuilder;
            },
            maybeSingle: async () => {
              if (table === 'organization_invitations') {
                const found = invitations.find((i) => {
                  for (const [k, v] of Object.entries(filters)) {
                    if (k === 'email') {
                      if (i.email.toLowerCase() !== String(v).toLowerCase()) return false;
                    } else if (i[k as keyof MockInvitation] !== v) {
                      return false;
                    }
                  }
                  return true;
                });
                return { data: found || null, error: null };
              }
              if (table === 'organization_members') {
                const found = members.find((m) => {
                  for (const [k, v] of Object.entries(filters)) {
                    if (m[k as keyof MockOrgMember] !== v) return false;
                  }
                  return true;
                });
                return { data: found || null, error: null };
              }
              return { data: null, error: null };
            },
            single: async () => {
              const res = await queryBuilder.maybeSingle();
              if (!res.data) return { data: null, error: { message: 'Row not found' } };
              return res;
            },
            insert: (record: any) => {
              return {
                select: () => ({
                  single: async () => {
                    if (table === 'organization_members') {
                      // Check unique violation (organization_id, user_id)
                      const existing = members.find(
                        (m) =>
                          m.organization_id === record.organization_id &&
                          m.user_id === record.user_id
                      );
                      if (existing) {
                        return { data: null, error: { code: '23505', message: 'duplicate key' } };
                      }
                      const newMem: MockOrgMember = {
                        organization_id: record.organization_id,
                        user_id: record.user_id,
                        role: record.role,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };
                      members.push(newMem);
                      return { data: newMem, error: null };
                    }
                    return { data: record, error: null };
                  },
                }),
              };
            },
            update: (updates: any) => {
              return {
                eq: (col: string, val: any) => {
                  if (table === 'organization_invitations') {
                    for (const i of invitations) {
                      if (i[col as keyof MockInvitation] === val) {
                        Object.assign(i, updates, { updated_at: new Date().toISOString() });
                      }
                    }
                  }
                  return Promise.resolve({ error: null });
                },
              };
            },
            then: (resolve: any) => {
              // Supports `await queryBuilder`
              if (table === 'organization_invitations') {
                const matched = invitations.filter((i) => {
                  for (const [k, v] of Object.entries(filters)) {
                    if (k === 'email') {
                      if (i.email.toLowerCase() !== String(v).toLowerCase()) return false;
                    } else if (i[k as keyof MockInvitation] !== v) {
                      return false;
                    }
                  }
                  return true;
                });
                return Promise.resolve({ data: matched, error: null }).then(resolve);
              }
              return Promise.resolve({ data: [], error: null }).then(resolve);
            },
          };

          return queryBuilder;
        },
      };
    };

    return {
      mockCreateClient,
      getInvitations: () => invitations,
      getMembers: () => members,
    };
  }

  // Test 2: Authenticated user with no invitation -> 404
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-bob-uuid', email: 'bob@studio.com' },
      initialInvitations: [],
    });
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer valid-token',
      body: {},
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('2. Authenticated user with no invitation returns 404', res.status === 404, res);
  }

  // Test 3: Authenticated user with invitation for a different email -> 403
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-eve-uuid', email: 'eve@attacker.com' },
      initialInvitations: [
        {
          id: 'inv-target-1',
          organization_id: 'org-studio-1',
          email: 'alice@studio.com',
          role: 'engineer',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    // Eve attempts to accept Alice's invitation by passing Alice's invitation_id
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer eve-token',
      body: { invitation_id: 'inv-target-1' },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('3. Authenticated user cannot accept invitation for different email (returns 403)', res.status === 403, res);
    assert('3b. Database state unchanged after 403 attempt', env.getMembers().length === 0, env.getMembers());
  }

  // Test 4: Valid invited user accepting invitation -> 200, member created, invitation accepted
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-alice-uuid', email: 'alice@studio.com' },
      initialInvitations: [
        {
          id: 'inv-alice-1',
          organization_id: 'org-studio-1',
          email: 'alice@studio.com',
          role: 'engineer',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer alice-token',
      body: { invitation_id: 'inv-alice-1' },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('4. Valid invited user accepting invitation returns 200', res.status === 200 && res.body.success === true, res);
    const members = env.getMembers();
    assert('4b. Organization member row created with correct org, user, and role',
      members.length === 1 &&
      members[0].organization_id === 'org-studio-1' &&
      members[0].user_id === 'user-alice-uuid' &&
      members[0].role === 'engineer',
      members
    );
    const invites = env.getInvitations();
    assert('4c. Invitation status changed from pending to accepted', invites[0].status === 'accepted', invites[0]);
  }

  // Test 5: Same user accepting the same invitation twice -> Idempotent 200 response
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-alice-uuid', email: 'alice@studio.com' },
      initialInvitations: [
        {
          id: 'inv-alice-1',
          organization_id: 'org-studio-1',
          email: 'alice@studio.com',
          role: 'engineer',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    // First acceptance
    await handleAcceptInvitation({
      authHeader: 'Bearer alice-token',
      body: { invitation_id: 'inv-alice-1' },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });

    // Second acceptance attempt
    const res2 = await handleAcceptInvitation({
      authHeader: 'Bearer alice-token',
      body: { invitation_id: 'inv-alice-1' },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });

    assert('5. Second acceptance returns safe idempotent 200 with already_member=true',
      res2.status === 200 && res2.body.success === true && res2.body.already_member === true,
      res2
    );
    assert('5b. Exactly one membership row remains in database', env.getMembers().length === 1, env.getMembers());
  }

  // Test 6: Invitation for engineer -> member created with role 'engineer'
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-eng-uuid', email: 'eng@studio.com' },
      initialInvitations: [
        {
          id: 'inv-eng',
          organization_id: 'org-studio-1',
          email: 'eng@studio.com',
          role: 'engineer',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer eng-token',
      body: {},
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('6. Invitation for engineer creates membership with role engineer',
      res.status === 200 && res.body.member?.role === 'engineer' && env.getMembers()[0]?.role === 'engineer',
      res
    );
  }

  // Test 7: Invitation for producer -> member created with role 'producer'
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-prod-uuid', email: 'producer@studio.com' },
      initialInvitations: [
        {
          id: 'inv-prod',
          organization_id: 'org-studio-1',
          email: 'producer@studio.com',
          role: 'producer',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer prod-token',
      body: {},
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('7. Invitation for producer creates membership with role producer',
      res.status === 200 && res.body.member?.role === 'producer' && env.getMembers()[0]?.role === 'producer',
      res
    );
  }

  // Test 8: Invitation for admin -> member created with role 'admin'
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-admin-uuid', email: 'admin@studio.com' },
      initialInvitations: [
        {
          id: 'inv-admin',
          organization_id: 'org-studio-1',
          email: 'admin@studio.com',
          role: 'admin',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer admin-token',
      body: {},
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('8. Invitation for admin creates membership with role admin',
      res.status === 200 && res.body.member?.role === 'admin' && env.getMembers()[0]?.role === 'admin',
      res
    );
  }

  // Test 9: Attempt to manipulate organization_id in request body
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-tamper-uuid', email: 'tamper@studio.com' },
      initialInvitations: [
        {
          id: 'inv-tamper',
          organization_id: 'org-real-456',
          email: 'tamper@studio.com',
          role: 'engineer',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    // Request body tries to hijack membership into 'org-victim-999'
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer tamper-token',
      body: {
        invitation_id: 'inv-tamper',
        organization_id: 'org-victim-999',
      },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('9. Tampered organization_id in request is ignored (uses authoritative invitation org)',
      res.status === 200 &&
      res.body.member?.organization_id === 'org-real-456' &&
      env.getMembers()[0]?.organization_id === 'org-real-456',
      res
    );
  }

  // Test 10: Attempt to manipulate role in request body (e.g. asking for 'owner' or 'admin')
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-rolehacker-uuid', email: 'hacker@studio.com' },
      initialInvitations: [
        {
          id: 'inv-hacker',
          organization_id: 'org-studio-1',
          email: 'hacker@studio.com',
          role: 'assistant',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    // Body maliciously asks for role: 'owner'
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer hacker-token',
      body: {
        invitation_id: 'inv-hacker',
        role: 'owner',
      },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('10. Tampered role in request is ignored (membership gets authoritative role assistant)',
      res.status === 200 &&
      res.body.member?.role === 'assistant' &&
      env.getMembers()[0]?.role === 'assistant',
      res
    );
  }

  // Test 11: Verify resulting "organization_members" row structure and isolation
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-iso-uuid', email: 'iso@studio.com' },
      initialInvitations: [
        {
          id: 'inv-iso',
          organization_id: 'org-iso-777',
          email: 'iso@studio.com',
          role: 'producer',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer iso-token',
      body: {},
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    const memberRow = env.getMembers()[0];
    assert('11. Resulting organization_members row has exact authoritative schema & values',
      res.status === 200 &&
      memberRow.organization_id === 'org-iso-777' &&
      memberRow.user_id === 'user-iso-uuid' &&
      memberRow.role === 'producer',
      memberRow
    );
  }

  // Test 12: Verify invitation status transition from "pending" to "accepted"
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-trans-uuid', email: 'trans@studio.com' },
      initialInvitations: [
        {
          id: 'inv-trans',
          organization_id: 'org-trans-888',
          email: 'trans@studio.com',
          role: 'finance',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    assert('12a. Invitation is pending prior to acceptance', env.getInvitations()[0].status === 'pending', env.getInvitations()[0]);
    await handleAcceptInvitation({
      authHeader: 'Bearer trans-token',
      body: {},
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('12b. Invitation status transitions to accepted after call', env.getInvitations()[0].status === 'accepted', env.getInvitations()[0]);
  }

  // Test 13: Case-insensitive email matching
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-case-uuid', email: 'CaseSensitive@Studio.COM' },
      initialInvitations: [
        {
          id: 'inv-case',
          organization_id: 'org-case-1',
          email: 'casesensitive@studio.com',
          role: 'engineer',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer case-token',
      body: {},
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('13. Case-insensitive email matching succeeds', res.status === 200 && res.body.success === true, res);
  }

  // Test 14: Reject invitation if marked revoked or expired
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-rev-uuid', email: 'revoked@studio.com' },
      initialInvitations: [
        {
          id: 'inv-rev',
          organization_id: 'org-rev-1',
          email: 'revoked@studio.com',
          role: 'engineer',
          invited_by: 'owner-uuid',
          status: 'revoked',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer rev-token',
      body: { invitation_id: 'inv-rev' },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('14. Revoked invitation is rejected with 409', res.status === 409, res);
  }

  // Test 15: Disallow invitation trying to grant owner role
  {
    const env = createMockEnvironment({
      callerUser: { id: 'user-own-uuid', email: 'wannabeowner@studio.com' },
      initialInvitations: [
        {
          id: 'inv-own',
          organization_id: 'org-own-1',
          email: 'wannabeowner@studio.com',
          role: 'owner',
          invited_by: 'owner-uuid',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const res = await handleAcceptInvitation({
      authHeader: 'Bearer own-token',
      body: { invitation_id: 'inv-own' },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: env.mockCreateClient as any,
    });
    assert('15. Disallows creating owner membership via invitation (returns 400)', res.status === 400, res);
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
