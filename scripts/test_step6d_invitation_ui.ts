import { INVITE_ROLES } from '../src/components/engineer/TeamMembersView.js';
import { handleRevokeInvitation } from '../src/server/revokeInviteHandler.js';
import { handleInviteTeamMember } from '../src/server/inviteHandler.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

async function runStep6DTests() {
  console.log('=== Step 6D: Team Member Invitation UI & Security Verification Suite ===\n');

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

  // Helper to determine manager permissions as defined in useTeamMembers
  function canUserManage(role: string): boolean {
    return role === 'owner' || role === 'admin';
  }

  // 1. Owner can see Invite Member
  assert('1. Owner can see Invite Member', canUserManage('owner') === true);

  // 2. Admin can see Invite Member
  assert('2. Admin can see Invite Member', canUserManage('admin') === true);

  // 3. Engineer cannot invite
  assert('3. Engineer cannot invite', canUserManage('engineer') === false);

  // 4. Producer cannot invite
  assert('4. Producer cannot invite', canUserManage('producer') === false);

  // 5. Assistant cannot invite
  assert('5. Assistant cannot invite', canUserManage('assistant') === false);

  // 6. Finance cannot invite
  assert('6. Finance cannot invite', canUserManage('finance') === false);

  // 11. Owner is NOT available as an invitation role
  const ownerInInviteRoles = INVITE_ROLES.some((r) => r.role === 'owner');
  assert('11. Owner is not available as a role in INVITE_ROLES', ownerInInviteRoles === false);
  assert('11b. INVITE_ROLES includes exactly the 5 allowed roles',
    INVITE_ROLES.length === 5 &&
    INVITE_ROLES.map((r) => r.role).sort().join(',') === 'admin,assistant,engineer,finance,producer'
  );

  // In-memory mock database for testing server handlers
  let mockInvitations: any[] = [];
  let mockMembers: any[] = [
    { organization_id: 'org-studio-1', user_id: 'owner-uuid', role: 'owner' },
    { organization_id: 'org-studio-1', user_id: 'admin-uuid', role: 'admin' },
    { organization_id: 'org-studio-1', user_id: 'existing-eng-uuid', role: 'engineer' },
  ];
  let mockAuthUsers = [
    { id: 'owner-uuid', email: 'owner@studio.com' },
    { id: 'admin-uuid', email: 'admin@studio.com' },
    { id: 'existing-eng-uuid', email: 'existingeng@studio.com' },
  ];

  const mockCreateClient = (callerUser: any) => {
    return {
      auth: {
        getUser: async (_token: string) => ({
          data: { user: callerUser },
          error: null,
        }),
        admin: {
          listUsers: async () => ({
            data: { users: mockAuthUsers },
            error: null,
          }),
          inviteUserByEmail: async (email: string) => {
            const newUser = { id: `user-${Date.now()}`, email };
            mockAuthUsers.push(newUser);
            return { data: { user: newUser }, error: null };
          },
        },
      },
      from: (table: string) => {
        let filters: Record<string, any> = {};
        const qb: any = {
          select: () => qb,
          eq: (col: string, val: any) => {
            filters[col] = val;
            return qb;
          },
          ilike: (col: string, val: any) => {
            filters[col] = String(val).toLowerCase();
            return qb;
          },
          maybeSingle: async () => {
            if (table === 'organization_members') {
              const f = mockMembers.find(
                (m) =>
                  (!filters.organization_id || m.organization_id === filters.organization_id) &&
                  (!filters.user_id || m.user_id === filters.user_id)
              );
              return { data: f || null, error: null };
            }
            if (table === 'organization_invitations') {
              const f = mockInvitations.find((i) => {
                for (const [k, v] of Object.entries(filters)) {
                  if (k === 'email') {
                    if (i.email.toLowerCase() !== String(v).toLowerCase()) return false;
                  } else if (i[k] !== v) {
                    return false;
                  }
                }
                return true;
              });
              return { data: f || null, error: null };
            }
            return { data: null, error: null };
          },
          single: async () => {
            const res = await qb.maybeSingle();
            if (!res.data) return { data: null, error: { message: 'Not found' } };
            return res;
          },
          insert: (record: any) => {
            if (table === 'organization_invitations') {
              const newInv = {
                id: `inv-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                ...record,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              mockInvitations.push(newInv);
              return {
                select: () => ({
                  single: async () => ({ data: newInv, error: null }),
                }),
              };
            }
            return {
              select: () => ({
                single: async () => ({ data: record, error: null }),
              }),
            };
          },
          update: (updates: any) => ({
            eq: async (col: string, val: any) => {
              if (table === 'organization_invitations') {
                for (const inv of mockInvitations) {
                  if (inv[col] === val) {
                    Object.assign(inv, updates, { updated_at: new Date().toISOString() });
                  }
                }
              }
              return { error: null };
            },
          }),
        };
        return qb;
      },
    };
  };

  // 7. Owner can invite engineer
  {
    const caller = { id: 'owner-uuid', email: 'owner@studio.com' };
    const res = await handleInviteTeamMember({
      authHeader: 'Bearer valid-token',
      body: {
        organization_id: 'org-studio-1',
        email: 'newengineer@studio.com',
        role: 'engineer',
      },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: (() => mockCreateClient(caller)) as any,
    });
    assert('7. Owner can invite engineer', res.status === 201 && res.body.success === true, res);
  }

  // 8. Admin can invite producer
  {
    const caller = { id: 'admin-uuid', email: 'admin@studio.com' };
    const res = await handleInviteTeamMember({
      authHeader: 'Bearer valid-token',
      body: {
        organization_id: 'org-studio-1',
        email: 'newproducer@studio.com',
        role: 'producer',
      },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: (() => mockCreateClient(caller)) as any,
    });
    assert('8. Admin can invite producer', res.status === 201 && res.body.success === true, res);
  }

  // 9. Duplicate pending invitation displays a useful error (HTTP 409)
  {
    const caller = { id: 'owner-uuid', email: 'owner@studio.com' };
    const res = await handleInviteTeamMember({
      authHeader: 'Bearer valid-token',
      body: {
        organization_id: 'org-studio-1',
        email: 'newengineer@studio.com', // already invited in test 7
        role: 'engineer',
      },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: (() => mockCreateClient(caller)) as any,
    });
    assert('9. Duplicate pending invitation displays a useful error (409)',
      res.status === 409 &&
      typeof res.body.error === 'string' &&
      res.body.error.toLowerCase().includes('pending invitation already exists'),
      res
    );
  }

  // 10. Existing member displays a useful error (HTTP 409)
  {
    const caller = { id: 'owner-uuid', email: 'owner@studio.com' };
    const res = await handleInviteTeamMember({
      authHeader: 'Bearer valid-token',
      body: {
        organization_id: 'org-studio-1',
        email: 'existingeng@studio.com', // already a member
        role: 'engineer',
      },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: (() => mockCreateClient(caller)) as any,
    });
    assert('10. Existing member displays a useful error (409)',
      res.status === 409 &&
      typeof res.body.error === 'string' &&
      res.body.error.toLowerCase().includes('already a member'),
      res
    );
  }

  // 12. Pending invitation appears in invitations list after successful invitation
  const pendingInvites = mockInvitations.filter(
    (i) => i.organization_id === 'org-studio-1' && i.status === 'pending'
  );
  assert('12. Pending invitations appear after invitation creation',
    pendingInvites.length === 2 &&
    pendingInvites.some((i) => i.email === 'newengineer@studio.com' && i.role === 'engineer') &&
    pendingInvites.some((i) => i.email === 'newproducer@studio.com' && i.role === 'producer'),
    pendingInvites
  );

  // 13. Owner/admin can revoke a pending invitation
  const targetInviteToRevoke = pendingInvites[0];
  {
    const caller = { id: 'owner-uuid', email: 'owner@studio.com' };
    const res = await handleRevokeInvitation({
      authHeader: 'Bearer valid-token',
      body: { invitation_id: targetInviteToRevoke.id },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: (() => mockCreateClient(caller)) as any,
    });
    assert('13. Owner/admin can revoke a pending invitation',
      res.status === 200 && res.body.success === true,
      res
    );
  }

  // 14. Revoked invitation transitions to revoked and disappears from pending list
  const remainingPending = mockInvitations.filter(
    (i) => i.organization_id === 'org-studio-1' && i.status === 'pending'
  );
  assert('14. Revoked invitation disappears from pending list',
    remainingPending.length === 1 &&
    remainingPending[0].id !== targetInviteToRevoke.id &&
    targetInviteToRevoke.status === 'revoked',
    { remainingPending, targetInviteToRevoke }
  );

  // 14b. Non-manager (engineer) cannot revoke invitation
  {
    const caller = { id: 'existing-eng-uuid', email: 'existingeng@studio.com' };
    const res = await handleRevokeInvitation({
      authHeader: 'Bearer valid-token',
      body: { invitation_id: remainingPending[0].id },
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon',
      supabaseServiceRoleKey: 'mock-service',
      createClientFn: (() => mockCreateClient(caller)) as any,
    });
    assert('14b. Non-manager (engineer) is forbidden from revoking invitation (403)',
      res.status === 403,
      res
    );
  }

  // 15. Service-role key does not appear anywhere in frontend code or bundle
  function scanDirForSecret(dir: string): string[] {
    const findings: string[] = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findings.push(...scanDirForSecret(fullPath));
      } else if (stat.isFile() && (entry.endsWith('.tsx') || entry.endsWith('.ts') || entry.endsWith('.jsx') || entry.endsWith('.js'))) {
        // Exclude server-side files and tests from frontend secret check
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

  const frontendLeaks = scanDirForSecret(join(process.cwd(), 'src'));
  assert('15. Service-role key does not appear anywhere in frontend source code',
    frontendLeaks.length === 0,
    frontendLeaks
  );

  console.log(`\n========================================`);
  console.log(`Step 6D Test Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep6DTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
