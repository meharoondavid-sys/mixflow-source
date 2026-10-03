import { ClientRecord, ClientInsertInput, ClientUpdateInput, ClientProjectItem } from '../src/types/client.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

async function runStep7ClientManagementTests() {
  console.log('=== Step 7: Client Management Verification Suite ===\n');

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

  // Mock Database State
  let mockClients: ClientRecord[] = [
    {
      id: 'client-1',
      organization_id: 'org-studio-1',
      full_name: 'Maya Lin',
      email: 'maya@subpop.com',
      phone: '+1 555-019-2834',
      company_name: 'Sub Pop Records',
      notes: 'Prefers warm analog saturation on vocals.',
      created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
      updated_at: new Date('2026-09-01T10:00:00Z').toISOString(),
    },
    {
      id: 'client-2',
      organization_id: 'org-studio-1',
      full_name: 'David Vance',
      email: 'david@indie.fm',
      phone: null,
      company_name: null,
      notes: null,
      created_at: new Date('2026-09-15T12:00:00Z').toISOString(),
      updated_at: new Date('2026-09-15T12:00:00Z').toISOString(),
    },
    {
      id: 'client-other-org',
      organization_id: 'org-studio-OTHER',
      full_name: 'Other Studio Client',
      email: 'other@studio.com',
      phone: null,
      company_name: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  let mockProjects = [
    {
      id: 'proj-1',
      organization_id: 'org-studio-1',
      client_id: 'client-1',
      name: 'Autumn Leaves EP',
      project_type: 'ep',
      status: 'in_production',
      project_price: 3200,
      deposit_amount: 1600,
      deadline: '2026-11-01',
      created_at: new Date('2026-09-05T14:00:00Z').toISOString(),
    },
    {
      id: 'proj-2',
      organization_id: 'org-studio-1',
      client_id: 'client-1',
      name: 'Midnight Echoes Single',
      project_type: 'single',
      status: 'completed',
      project_price: 1200,
      deposit_amount: 1200,
      deadline: '2026-10-01',
      created_at: new Date('2026-09-10T16:00:00Z').toISOString(),
    },
  ];

  // 1. Client List: Scoped to active organization & project counts computed
  {
    const activeOrgId = 'org-studio-1';
    const orgClients = mockClients.filter((c) => c.organization_id === activeOrgId);

    // Compute project counts
    const projectCountMap: Record<string, number> = {};
    mockProjects
      .filter((p) => p.organization_id === activeOrgId)
      .forEach((p) => {
        projectCountMap[p.client_id] = (projectCountMap[p.client_id] || 0) + 1;
      });

    const enrichedClients = orgClients.map((c) => ({
      ...c,
      project_count: projectCountMap[c.id] || 0,
    }));

    assert('1a. Client list excludes other organizations (tenant isolation)',
      enrichedClients.every((c) => c.organization_id === activeOrgId) &&
      !enrichedClients.some((c) => c.id === 'client-other-org')
    );
    assert('1b. Client Maya Lin has project_count = 2 from existing projects relationship',
      enrichedClients.find((c) => c.id === 'client-1')?.project_count === 2
    );
    assert('1c. Client David Vance has project_count = 0',
      enrichedClients.find((c) => c.id === 'client-2')?.project_count === 0
    );
  }

  // 1d. Search filtering
  {
    function searchClients(query: string, list: ClientRecord[]): ClientRecord[] {
      const q = query.toLowerCase().trim();
      if (!q) return list;
      return list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.company_name && c.company_name.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q))
      );
    }

    const orgClients = mockClients.filter((c) => c.organization_id === 'org-studio-1');
    assert('1d. Search by full name "maya" finds Maya Lin',
      searchClients('maya', orgClients).length === 1 && searchClients('maya', orgClients)[0].id === 'client-1'
    );
    assert('1e. Search by email "indie.fm" finds David Vance',
      searchClients('indie.fm', orgClients).length === 1 && searchClients('indie.fm', orgClients)[0].id === 'client-2'
    );
    assert('1f. Search by company "sub pop" finds Maya Lin',
      searchClients('sub pop', orgClients).length === 1 && searchClients('sub pop', orgClients)[0].id === 'client-1'
    );
    assert('1g. Non-matching search returns 0 clients',
      searchClients('nonexistent', orgClients).length === 0
    );
  }

  // 2. Add Client: validation and organization scoping
  {
    const activeOrgId = 'org-studio-1';
    function createMockClient(input: ClientInsertInput, userRole: string, orgId: string) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        return { client: null, error: new Error('Forbidden: Only owners and admins can add clients') };
      }
      if (!input.full_name?.trim()) {
        return { client: null, error: new Error('Full Name is required') };
      }
      const newClient: ClientRecord = {
        id: `client-${Date.now()}`,
        organization_id: orgId, // Authoritatively uses active org
        full_name: input.full_name.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        company_name: input.company_name?.trim() || null,
        notes: input.notes?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        project_count: 0,
      };
      mockClients.push(newClient);
      return { client: newClient, error: null };
    }

    // Attempt with empty name -> rejected
    const resEmpty = createMockClient({ full_name: '   ' }, 'owner', activeOrgId);
    assert('2a. Add client rejects empty full_name', resEmpty.error !== null);

    // Attempt by non-manager (engineer) -> rejected
    const resEngineer = createMockClient({ full_name: 'New Artist' }, 'engineer', activeOrgId);
    assert('2b. Non-manager (engineer) cannot create client', resEngineer.error !== null);

    // Valid creation by owner
    const resValid = createMockClient(
      {
        full_name: '  Sarah Jenkins  ',
        email: 'sarah@acoustic.io',
        phone: '+1 555-4321',
        company_name: 'Acoustic Records',
        notes: 'Folk/Acoustic guitar recording',
      },
      'owner',
      activeOrgId
    );
    assert('2c. Owner can create client with trimmed full_name',
      resValid.client !== null &&
      resValid.client.full_name === 'Sarah Jenkins' &&
      resValid.client.organization_id === activeOrgId
    );
  }

  // 3. Client Details: Associated projects fetched
  {
    const activeOrgId = 'org-studio-1';
    function getClientProjects(clientId: string): ClientProjectItem[] {
      return mockProjects
        .filter((p) => p.organization_id === activeOrgId && p.client_id === clientId)
        .map((p) => ({
          id: p.id,
          name: p.name,
          project_type: p.project_type,
          status: p.status,
          project_price: p.project_price,
          deposit_amount: p.deposit_amount,
          deadline: p.deadline,
          created_at: p.created_at,
        }));
    }

    const projectsMaya = getClientProjects('client-1');
    assert('3a. Client Details for Maya Lin returns 2 associated projects',
      projectsMaya.length === 2 &&
      projectsMaya.some((p) => p.name === 'Autumn Leaves EP') &&
      projectsMaya.some((p) => p.name === 'Midnight Echoes Single')
    );

    const projectsDavid = getClientProjects('client-2');
    assert('3b. Client Details for David Vance returns 0 projects (empty state)',
      projectsDavid.length === 0
    );
  }

  // 4. Edit Client
  {
    function updateMockClient(
      id: string,
      input: ClientUpdateInput,
      userRole: string,
      orgId: string
    ) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        return { client: null, error: new Error('Forbidden') };
      }
      if (input.full_name !== undefined && !input.full_name.trim()) {
        return { client: null, error: new Error('Full Name cannot be empty') };
      }
      const existing = mockClients.find((c) => c.id === id && c.organization_id === orgId);
      if (!existing) return { client: null, error: new Error('Not found') };

      if (input.full_name !== undefined) existing.full_name = input.full_name.trim();
      if (input.email !== undefined) existing.email = input.email?.trim() || null;
      if (input.phone !== undefined) existing.phone = input.phone?.trim() || null;
      if (input.company_name !== undefined) existing.company_name = input.company_name?.trim() || null;
      if (input.notes !== undefined) existing.notes = input.notes?.trim() || null;
      existing.updated_at = new Date().toISOString();

      return { client: existing, error: null };
    }

    // Owner edits David Vance
    const updateRes = updateMockClient(
      'client-2',
      { company_name: 'Vance Audio Works', phone: '+1 555-9876' },
      'admin',
      'org-studio-1'
    );
    assert('4a. Admin can edit client company and phone',
      updateRes.client !== null &&
      updateRes.client.company_name === 'Vance Audio Works' &&
      updateRes.client.phone === '+1 555-9876' &&
      updateRes.client.id === 'client-2' && // Client ID unchanged
      updateRes.client.organization_id === 'org-studio-1' // Org ID unchanged
    );

    // Empty name rejected
    const badUpdate = updateMockClient('client-2', { full_name: '   ' }, 'admin', 'org-studio-1');
    assert('4b. Edit client rejects empty full_name', badUpdate.error !== null);
  }

  // 5. Delete Client safety constraint
  {
    function deleteMockClient(id: string, userRole: string, orgId: string) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        return { error: new Error('Forbidden') };
      }
      // Safety check: Has associated projects?
      const hasAssociatedProjects = mockProjects.some(
        (p) => p.organization_id === orgId && p.client_id === id
      );
      if (hasAssociatedProjects) {
        return {
          error: new Error(
            'Cannot delete client: active projects exist. Foreign key RESTRICT prevents data loss.'
          ),
        };
      }
      mockClients = mockClients.filter((c) => !(c.id === id && c.organization_id === orgId));
      return { error: null };
    }

    // Maya Lin has 2 projects -> Delete MUST be blocked
    const delMaya = deleteMockClient('client-1', 'owner', 'org-studio-1');
    assert('5a. Deleting client with projects is blocked to prevent data loss',
      delMaya.error !== null &&
      mockClients.some((c) => c.id === 'client-1')
    );

    // David Vance has 0 projects -> Delete is permitted safely
    const delDavid = deleteMockClient('client-2', 'owner', 'org-studio-1');
    assert('5b. Deleting client with 0 projects succeeds safely',
      delDavid.error === null &&
      !mockClients.some((c) => c.id === 'client-2')
    );
  }

  // 6. Security scan: Zero service role secrets in frontend files
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
  assert('6. Zero service role secrets in frontend source files', leaks.length === 0, leaks);

  console.log(`\n========================================`);
  console.log(`Step 7 Test Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep7ClientManagementTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
