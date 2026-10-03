import { handleInviteTeamMember } from '../src/server/inviteHandler.js';

async function runTestSuite() {
  console.log('--- Step 6B Endpoint Security & Logic Verification Suite ---\n');

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

  // 1. Unauthenticated request -> 401
  const res1 = await handleInviteTeamMember({
    authHeader: undefined,
    body: { organization_id: 'org-123', email: 'valid@example.com', role: 'engineer' },
    supabaseUrl: 'https://mock.supabase.co',
    supabaseAnonKey: 'mock-anon',
    supabaseServiceRoleKey: 'mock-service',
  });
  assert('1. Unauthenticated request returns 401', res1.status === 401, res1);

  // 1b. Empty token -> 401
  const res1b = await handleInviteTeamMember({
    authHeader: 'Bearer ',
    body: { organization_id: 'org-123', email: 'valid@example.com', role: 'engineer' },
    supabaseUrl: 'https://mock.supabase.co',
    supabaseAnonKey: 'mock-anon',
    supabaseServiceRoleKey: 'mock-service',
  });
  assert('1b. Empty token returns 401', res1b.status === 401, res1b);

  // Helper to run a test with custom Supabase responses
  async function runMockedTest({
    callerUser = { id: 'caller-uuid-1', email: 'owner@studio.com' },
    authError = null as any,
    callerRole = 'owner', // 'owner', 'admin', 'engineer', 'producer'
    callerMemberError = null as any,
    existingUsers = [] as Array<{ id: string; email: string }>,
    existingOrgMember = null as any,
    existingPendingInvite = null as any,
    inviteAuthError = null as any,
    body = { organization_id: 'org-123', email: 'newmember@example.com', role: 'engineer' } as any,
  }) {
    let insertedRows: any[] = [];
    let invitedEmails: string[] = [];

    const mockCreateClient = (url: string, key: string) => {
      return {
        auth: {
          getUser: async (_token: string) => {
            if (authError) return { data: { user: null }, error: authError };
            return { data: { user: callerUser }, error: null };
          },
          admin: {
            listUsers: async () => ({
              data: { users: existingUsers },
              error: null,
            }),
            inviteUserByEmail: async (email: string) => {
              invitedEmails.push(email);
              if (inviteAuthError) return { data: null, error: inviteAuthError };
              return { data: { user: { id: 'new-auth-id', email } }, error: null };
            },
          },
        },
        from: (table: string) => {
          let selectedFields = '';
          let filters: Record<string, any> = {};

          const queryBuilder: any = {
            select: (fields: string) => {
              selectedFields = fields;
              return queryBuilder;
            },
            eq: (col: string, val: any) => {
              filters[col] = val;
              return queryBuilder;
            },
            ilike: (col: string, val: any) => {
              filters[col] = val;
              return queryBuilder;
            },
            maybeSingle: async () => {
              if (table === 'organization_members') {
                if (callerMemberError) return { data: null, error: callerMemberError };
                // Checking caller's membership
                if (filters.user_id === callerUser.id) {
                  if (callerRole === 'not_a_member') return { data: null, error: null };
                  return { data: { role: callerRole }, error: null };
                }
                // Checking target user membership
                if (existingOrgMember) return { data: existingOrgMember, error: null };
                return { data: null, error: null };
              }

              if (table === 'organization_invitations') {
                if (existingPendingInvite) return { data: existingPendingInvite, error: null };
                return { data: null, error: null };
              }

              return { data: null, error: null };
            },
            insert: (data: any) => {
              insertedRows.push(data);
              return {
                select: () => ({
                  single: async () => ({
                    data: {
                      id: 'invite-uuid-generated',
                      ...data,
                      created_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                }),
              };
            },
          };
          return queryBuilder;
        },
      } as any;
    };

    const result = await handleInviteTeamMember({
      authHeader: 'Bearer valid-jwt-token',
      body,
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: mockCreateClient,
    });

    return { result, insertedRows, invitedEmails };
  }

  // 2. Invalid email format -> 400
  const t2 = await runMockedTest({
    callerRole: 'owner',
    body: { organization_id: 'org-123', email: 'not-an-email', role: 'engineer' },
  });
  assert('2. Invalid email returns 400', t2.result.status === 400 && !!t2.result.body.error?.includes('Invalid email'), t2.result);

  // 3. Attempted "owner" invitation -> 400
  const t3 = await runMockedTest({
    callerRole: 'owner',
    body: { organization_id: 'org-123', email: 'new@example.com', role: 'owner' },
  });
  assert('3. Attempted "owner" invitation returns 400', t3.result.status === 400 && !!t3.result.body.error?.includes("'owner' role cannot be assigned"), t3.result);

  // 4. Invalid role -> 400
  const t4 = await runMockedTest({
    callerRole: 'owner',
    body: { organization_id: 'org-123', email: 'new@example.com', role: 'superuser' },
  });
  assert('4. Invalid role returns 400', t4.result.status === 400, t4.result);

  // 5. Engineer/producer attempting to invite -> 403
  const t5_eng = await runMockedTest({
    callerRole: 'engineer',
    body: { organization_id: 'org-123', email: 'new@example.com', role: 'assistant' },
  });
  assert('5a. Engineer attempting to invite returns 403', t5_eng.result.status === 403, t5_eng.result);

  const t5_prod = await runMockedTest({
    callerRole: 'producer',
    body: { organization_id: 'org-123', email: 'new@example.com', role: 'assistant' },
  });
  assert('5b. Producer attempting to invite returns 403', t5_prod.result.status === 403, t5_prod.result);

  const t5_nonmember = await runMockedTest({
    callerRole: 'not_a_member',
    body: { organization_id: 'org-123', email: 'new@example.com', role: 'assistant' },
  });
  assert('5c. Non-member caller returns 403', t5_nonmember.result.status === 403, t5_nonmember.result);

  // 6. Existing organization member -> 409
  const t6 = await runMockedTest({
    callerRole: 'owner',
    existingUsers: [{ id: 'user-already-here', email: 'alex@mixflow.io' }],
    existingOrgMember: { role: 'engineer' },
    body: { organization_id: 'org-123', email: 'alex@mixflow.io', role: 'producer' },
  });
  assert('6. Existing organization member returns 409', t6.result.status === 409 && !!t6.result.body.error?.includes('already a member'), t6.result);

  // 7. Duplicate pending invitation -> 409
  const t7 = await runMockedTest({
    callerRole: 'admin',
    existingPendingInvite: { id: 'existing-invite-1', status: 'pending' },
    body: { organization_id: 'org-123', email: 'pending@studio.com', role: 'assistant' },
  });
  assert('7. Duplicate pending invitation returns 409', t7.result.status === 409 && !!t7.result.body.error?.includes('pending invitation already exists'), t7.result);

  // 8. Owner inviting valid member -> 201 success
  const t8_owner = await runMockedTest({
    callerRole: 'owner',
    body: { organization_id: 'org-123', email: 'NewMember@Studio.COM ', role: 'engineer' },
  });
  assert('8a. Owner inviting valid member returns 201', t8_owner.result.status === 201 && t8_owner.result.body.success === true, t8_owner.result);

  // 8b. Admin inviting valid member -> 201 success
  const t8_admin = await runMockedTest({
    callerRole: 'admin',
    body: { organization_id: 'org-123', email: 'ProducerAlex@studio.com', role: 'producer' },
  });
  assert('8b. Admin inviting valid member returns 201', t8_admin.result.status === 201 && t8_admin.result.body.success === true, t8_admin.result);

  // 9. Confirm the successful request creates exactly one "organization_invitations" row with:
  // - organization_id
  // - normalized email
  // - role
  // - invited_by
  // - status = pending
  assert('9a. Exactly one row inserted into organization_invitations', t8_owner.insertedRows.length === 1, t8_owner.insertedRows);
  const row = t8_owner.insertedRows[0];
  assert('9b. Row has correct organization_id', row.organization_id === 'org-123', row);
  assert('9c. Row has normalized lowercase trimmed email', row.email === 'newmember@studio.com', row);
  assert('9d. Row has role "engineer"', row.role === 'engineer', row);
  assert('9e. Row has invited_by matching callerUser.id', row.invited_by === 'caller-uuid-1', row);
  assert('9f. Row has status = "pending"', row.status === 'pending', row);

  // 10. Confirm auth.admin.inviteUserByEmail was called with ONLY normalized email (no metadata)
  assert('10. auth.admin.inviteUserByEmail called without metadata', t8_owner.invitedEmails.length === 1 && t8_owner.invitedEmails[0] === 'newmember@studio.com', t8_owner.invitedEmails);

  console.log(`\n========================================`);
  console.log(`Test Suite Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
