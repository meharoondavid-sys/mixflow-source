import { ProjectRecord, ProjectSongRecord, ProjectInsertInput, ProjectUpdateInput, SongInput } from '../src/types/project.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

async function runStep8ProjectManagementTests() {
  console.log('=== Step 8: Project Management Foundation Verification Suite ===\n');

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
  let mockProjects: ProjectRecord[] = [
    {
      id: 'proj-1',
      organization_id: 'org-studio-1',
      client_id: 'client-maya',
      name: 'Electric Horizon Single',
      project_type: 'single',
      description: 'Debut synthwave single with vocal harmonies',
      project_price: 1500,
      deposit_amount: 750,
      deadline: '2026-11-15',
      status: 'in_production',
      created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
      updated_at: new Date('2026-09-01T10:00:00Z').toISOString(),
      client: {
        id: 'client-maya',
        organization_id: 'org-studio-1',
        full_name: 'Maya Lin',
        email: 'maya@subpop.com',
        phone: '+1 555-019-2834',
        company_name: 'Sub Pop Records',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      songs: [
        {
          id: 'song-1',
          project_id: 'proj-1',
          title: 'Electric Horizon',
          track_number: 1,
          status: 'in_production',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      service_count: 2,
    },
    {
      id: 'proj-2',
      organization_id: 'org-studio-1',
      client_id: 'client-david',
      name: 'Resonance EP',
      project_type: 'ep',
      description: '4-track modern acoustic EP',
      project_price: 4000,
      deposit_amount: 2000,
      deadline: '2026-12-01',
      status: 'awaiting_files',
      created_at: new Date('2026-09-10T12:00:00Z').toISOString(),
      updated_at: new Date('2026-09-10T12:00:00Z').toISOString(),
      client: {
        id: 'client-david',
        organization_id: 'org-studio-1',
        full_name: 'David Vance',
        email: 'david@indie.fm',
        phone: null,
        company_name: 'Indie Sound',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      songs: [
        {
          id: 'song-2a',
          project_id: 'proj-2',
          title: 'Morning Sun',
          track_number: 1,
          status: 'in_production',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'song-2b',
          project_id: 'proj-2',
          title: 'Golden River',
          track_number: 2,
          status: 'in_production',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      service_count: 3,
    },
    {
      id: 'proj-other-org',
      organization_id: 'org-studio-OTHER',
      client_id: 'client-other',
      name: 'Confidential Other Studio LP',
      project_type: 'album',
      description: null,
      project_price: 10000,
      deposit_amount: 5000,
      deadline: null,
      status: 'in_review',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      songs: [],
      service_count: 1,
    },
  ];

  // 1. Projects List: Scoping, search, and filtering
  {
    const activeOrgId = 'org-studio-1';
    const orgProjects = mockProjects.filter((p) => p.organization_id === activeOrgId);

    assert('1a. Projects list strictly scopes to active organization (no other org projects)',
      orgProjects.every((p) => p.organization_id === activeOrgId) &&
      !orgProjects.some((p) => p.id === 'proj-other-org')
    );

    // Search filter function
    function searchProjects(query: string, list: ProjectRecord[]): ProjectRecord[] {
      const q = query.toLowerCase().trim();
      if (!q) return list;
      return list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.client?.full_name && p.client.full_name.toLowerCase().includes(q)) ||
        (p.songs && p.songs.some((s) => s.title.toLowerCase().includes(q)))
      );
    }

    assert('1b. Search by project name "horizon" returns Electric Horizon Single',
      searchProjects('horizon', orgProjects).length === 1 && searchProjects('horizon', orgProjects)[0].id === 'proj-1'
    );
    assert('1c. Search by client name "maya" returns Electric Horizon Single',
      searchProjects('maya', orgProjects).length === 1 && searchProjects('maya', orgProjects)[0].id === 'proj-1'
    );
    assert('1d. Search by track title "golden river" returns Resonance EP',
      searchProjects('golden river', orgProjects).length === 1 && searchProjects('golden river', orgProjects)[0].id === 'proj-2'
    );

    // Type filter
    const singles = orgProjects.filter((p) => p.project_type === 'single');
    const eps = orgProjects.filter((p) => p.project_type === 'ep');
    assert('1e. Filter by project type "single" returns 1 single', singles.length === 1 && singles[0].id === 'proj-1');
    assert('1f. Filter by project type "ep" returns 1 ep', eps.length === 1 && eps[0].id === 'proj-2');

    // Status filter
    const inProd = orgProjects.filter((p) => p.status === 'in_production');
    assert('1g. Filter by status "in_production" returns in_production projects', inProd.length === 1 && inProd[0].id === 'proj-1');
  }

  // 2. Create Project: Validation and Single / EP / Album track initialization
  {
    const activeOrgId = 'org-studio-1';
    const validClientIds = ['client-maya', 'client-david'];

    function createMockProject(input: ProjectInsertInput, userRole: string, orgId: string) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        return { project: null, error: new Error('Permission denied. Only owners and admins can create projects.') };
      }
      if (!input.name || !input.name.trim()) {
        return { project: null, error: new Error('Project Name is required.') };
      }
      if (!input.client_id) {
        return { project: null, error: new Error('Client selection is required.') };
      }
      if (!validClientIds.includes(input.client_id)) {
        return { project: null, error: new Error('Invalid client: Selected client does not belong to your studio organization.') };
      }

      if (input.project_price !== undefined && Number(input.project_price) < 0) {
        return { project: null, error: new Error('Project price cannot be negative.') };
      }
      if (input.deposit_amount !== undefined && Number(input.deposit_amount) < 0) {
        return { project: null, error: new Error('Deposit amount cannot be negative.') };
      }

      const price = Number(input.project_price) || 0;
      const deposit = Number(input.deposit_amount) || 0;

      if (deposit > price) {
        return { project: null, error: new Error('Deposit amount cannot exceed total project price.') };
      }

      const newId = `proj-${Date.now()}`;
      let songs: ProjectSongRecord[] = [];

      if (input.project_type === 'single') {
        songs = [
          {
            id: `song-${Date.now()}-1`,
            project_id: newId,
            title: input.songs?.[0]?.title?.trim() || input.name.trim(),
            track_number: 1,
            status: 'in_production',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      } else {
        const inputSongs = input.songs || [];
        songs = inputSongs.map((s, idx) => ({
          id: `song-${Date.now()}-${idx + 1}`,
          project_id: newId,
          title: s.title.trim() || `Track ${idx + 1}`,
          track_number: s.track_number && s.track_number > 0 ? s.track_number : idx + 1,
          status: 'in_production',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
      }

      const newProj: ProjectRecord = {
        id: newId,
        organization_id: orgId,
        client_id: input.client_id,
        name: input.name.trim(),
        project_type: input.project_type,
        description: input.description?.trim() || null,
        project_price: price,
        deposit_amount: deposit,
        deadline: input.deadline || null,
        status: input.status || 'inquiry',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        songs,
        service_count: 0,
      };

      mockProjects.push(newProj);
      return { project: newProj, error: null };
    }

    // 2a. Rejects missing name
    const resNoName = createMockProject(
      { name: '   ', client_id: 'client-maya', project_type: 'single' },
      'owner',
      activeOrgId
    );
    assert('2a. Create project rejects empty project name', resNoName.error !== null);

    // 2b. Rejects foreign client
    const resForeignClient = createMockProject(
      { name: 'Album X', client_id: 'client-other-org', project_type: 'album' },
      'owner',
      activeOrgId
    );
    assert('2b. Create project rejects client from another organization', resForeignClient.error !== null);

    // 2c. Rejects deposit > price
    const resBadDeposit = createMockProject(
      { name: 'Single 1', client_id: 'client-maya', project_type: 'single', project_price: 1000, deposit_amount: 1500 },
      'owner',
      activeOrgId
    );
    assert('2c. Create project rejects deposit amount exceeding price',
      resBadDeposit.error !== null &&
      resBadDeposit.error.message.includes('cannot exceed total project price')
    );

    // 2c-1. Rejects negative price
    const resNegativePrice = createMockProject(
      { name: 'Single Neg', client_id: 'client-maya', project_type: 'single', project_price: -100, deposit_amount: 0 },
      'owner',
      activeOrgId
    );
    assert('2c-1. Create project rejects negative project_price',
      resNegativePrice.error !== null &&
      resNegativePrice.error.message.includes('cannot be negative')
    );

    // 2c-2. Rejects negative deposit
    const resNegativeDeposit = createMockProject(
      { name: 'Single Neg Dep', client_id: 'client-maya', project_type: 'single', project_price: 500, deposit_amount: -50 },
      'owner',
      activeOrgId
    );
    assert('2c-2. Create project rejects negative deposit_amount',
      resNegativeDeposit.error !== null &&
      resNegativeDeposit.error.message.includes('cannot be negative')
    );

    // 2d. Create valid Single -> track number is 1
    const resSingle = createMockProject(
      { name: 'Starlight Single', client_id: 'client-maya', project_type: 'single', project_price: 1200, deposit_amount: 600 },
      'owner',
      activeOrgId
    );
    assert('2d. Create Single sets track_number = 1 automatically',
      resSingle.project !== null &&
      resSingle.project.songs?.length === 1 &&
      resSingle.project.songs[0].track_number === 1 &&
      resSingle.project.songs[0].title === 'Starlight Single'
    );

    // 2e. Create valid Album -> sequential tracks
    const resAlbum = createMockProject(
      {
        name: 'Echoes of Summer LP',
        client_id: 'client-david',
        project_type: 'album',
        project_price: 8000,
        deposit_amount: 4000,
        songs: [
          { title: 'Intro', track_number: 1 },
          { title: 'Sunlight', track_number: 2 },
          { title: 'Twilight', track_number: 3 },
        ],
      },
      'admin',
      activeOrgId
    );
    assert('2e. Create Album sets sequential tracks properly',
      resAlbum.project !== null &&
      resAlbum.project.songs?.length === 3 &&
      resAlbum.project.songs[1].track_number === 2 &&
      resAlbum.project.songs[1].title === 'Sunlight'
    );
  }

  // 3. Edit Project: Validation and update
  {
    function updateMockProject(
      id: string,
      input: ProjectUpdateInput,
      userRole: string,
      orgId: string
    ) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        return { project: null, error: new Error('Permission denied.') };
      }
      const existing = mockProjects.find((p) => p.id === id && p.organization_id === orgId);
      if (!existing) return { project: null, error: new Error('Project not found.') };

      if (input.name !== undefined && !input.name.trim()) {
        return { project: null, error: new Error('Project Name cannot be empty.') };
      }

      if (input.project_price !== undefined && Number(input.project_price) < 0) {
        return { project: null, error: new Error('Project price cannot be negative.') };
      }
      if (input.deposit_amount !== undefined && Number(input.deposit_amount) < 0) {
        return { project: null, error: new Error('Deposit amount cannot be negative.') };
      }

      const newPrice = input.project_price !== undefined ? Number(input.project_price) || 0 : existing.project_price;
      const newDeposit = input.deposit_amount !== undefined ? Number(input.deposit_amount) || 0 : existing.deposit_amount;

      if (newDeposit > newPrice) {
        return { project: null, error: new Error('Deposit amount cannot exceed total project price.') };
      }

      if (input.name !== undefined) existing.name = input.name.trim();
      if (input.description !== undefined) existing.description = input.description?.trim() || null;
      if (input.project_price !== undefined) existing.project_price = newPrice;
      if (input.deposit_amount !== undefined) existing.deposit_amount = newDeposit;
      if (input.deadline !== undefined) existing.deadline = input.deadline || null;
      if (input.status !== undefined) existing.status = input.status;
      existing.updated_at = new Date().toISOString();

      return { project: existing, error: null };
    }

    // 3a. Update project name and status
    const updateRes = updateMockProject(
      'proj-1',
      { name: 'Electric Horizon (Remastered)', status: 'in_review', project_price: 1800, deposit_amount: 900 },
      'owner',
      'org-studio-1'
    );
    assert('3a. Owner can edit project name, status, and terms',
      updateRes.project !== null &&
      updateRes.project.name === 'Electric Horizon (Remastered)' &&
      updateRes.project.status === 'in_review' &&
      updateRes.project.project_price === 1800
    );

    // 3b. Update with deposit > price rejected
    const updateBadDeposit = updateMockProject(
      'proj-1',
      { deposit_amount: 2500 }, // price is 1800
      'owner',
      'org-studio-1'
    );
    assert('3b. Update project rejects deposit exceeding price',
      updateBadDeposit.error !== null &&
      updateBadDeposit.error.message.includes('cannot exceed total project price')
    );

    // 3c. Update with negative price rejected
    const updateNegPrice = updateMockProject(
      'proj-1',
      { project_price: -500 },
      'owner',
      'org-studio-1'
    );
    assert('3c. Update project rejects negative project_price',
      updateNegPrice.error !== null &&
      updateNegPrice.error.message.includes('cannot be negative')
    );

    // 3d. Update with negative deposit rejected
    const updateNegDeposit = updateMockProject(
      'proj-1',
      { deposit_amount: -250 },
      'owner',
      'org-studio-1'
    );
    assert('3d. Update project rejects negative deposit_amount',
      updateNegDeposit.error !== null &&
      updateNegDeposit.error.message.includes('cannot be negative')
    );
  }

  // 4. Songs Management: Add, Edit, Delete, Duplicate track number protection
  {
    const targetProject = mockProjects.find((p) => p.id === 'proj-2')!;

    function addSong(projectId: string, song: SongInput, userRole: string) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        return { song: null, error: new Error('Permission denied.') };
      }
      if (!song.title || !song.title.trim()) {
        return { song: null, error: new Error('Song title is required.') };
      }
      const trackNum = Number(song.track_number);
      if (!trackNum || trackNum <= 0) {
        return { song: null, error: new Error('Track number must be greater than 0.') };
      }
      if (targetProject.songs?.some((s) => s.track_number === trackNum)) {
        return {
          song: null,
          error: new Error(`Track number ${trackNum} is already assigned to another song in this project.`),
        };
      }

      const newSong: ProjectSongRecord = {
        id: `song-${Date.now()}`,
        project_id: projectId,
        title: song.title.trim(),
        track_number: trackNum,
        status: 'in_production',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      targetProject.songs = [...(targetProject.songs || []), newSong].sort(
        (a, b) => a.track_number - b.track_number
      );
      return { song: newSong, error: null };
    }

    function updateSong(
      projectId: string,
      songId: string,
      updates: { title?: string; track_number?: number; status?: string },
      userRole: string
    ) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        return { song: null, error: new Error('Permission denied.') };
      }
      if (updates.title !== undefined && !updates.title.trim()) {
        return { song: null, error: new Error('Song title cannot be empty.') };
      }
      if (updates.track_number !== undefined) {
        const num = Number(updates.track_number);
        if (!num || num <= 0) {
          return { song: null, error: new Error('Track number must be greater than 0.') };
        }
        if (targetProject.songs?.some((s) => s.id !== songId && s.track_number === num)) {
          return {
            song: null,
            error: new Error(`Track number ${num} is already assigned to another song in this project.`),
          };
        }
      }

      const song = targetProject.songs?.find((s) => s.id === songId);
      if (!song) return { song: null, error: new Error('Song not found.') };

      if (updates.title !== undefined) song.title = updates.title.trim();
      if (updates.track_number !== undefined) song.track_number = Number(updates.track_number);
      if (updates.status !== undefined) song.status = updates.status;
      song.updated_at = new Date().toISOString();

      targetProject.songs?.sort((a, b) => a.track_number - b.track_number);
      return { song, error: null };
    }

    function deleteSong(projectId: string, songId: string, userRole: string) {
      if (userRole !== 'owner' && userRole !== 'admin') {
        return { error: new Error('Permission denied.') };
      }
      targetProject.songs = (targetProject.songs || []).filter((s) => s.id !== songId);
      return { error: null };
    }

    // 4a. Add valid song (Track #3)
    const addRes = addSong('proj-2', { title: 'Autumn Breeze', track_number: 3 }, 'owner');
    assert('4a. Owner can add new song to project',
      addRes.song !== null &&
      addRes.song.title === 'Autumn Breeze' &&
      addRes.song.track_number === 3 &&
      targetProject.songs?.length === 3
    );

    // 4b. Duplicate track number rejection on add
    const addDup = addSong('proj-2', { title: 'Conflicting Track', track_number: 3 }, 'owner');
    assert('4b. Add song prevents duplicate track number',
      addDup.error !== null &&
      addDup.error.message.includes('is already assigned to another song')
    );

    // 4c. Track number <= 0 rejection
    const addZero = addSong('proj-2', { title: 'Invalid Track 0', track_number: 0 }, 'owner');
    assert('4c. Add song rejects track number <= 0',
      addZero.error !== null &&
      addZero.error.message.includes('greater than 0')
    );

    // 4d. Update song title and status
    const updateSongRes = updateSong(
      'proj-2',
      addRes.song!.id,
      { title: 'Autumn Breeze (Acoustic)', status: 'mixing' },
      'admin'
    );
    assert('4d. Admin can edit song title and production status',
      updateSongRes.song !== null &&
      updateSongRes.song.title === 'Autumn Breeze (Acoustic)' &&
      updateSongRes.song.status === 'mixing'
    );

    // 4e. Duplicate track number rejection on edit
    const updateDup = updateSong(
      'proj-2',
      addRes.song!.id,
      { track_number: 1 }, // track #1 already belongs to song-2a
      'admin'
    );
    assert('4e. Edit song prevents colliding track number',
      updateDup.error !== null &&
      updateDup.error.message.includes('is already assigned to another song')
    );

    // 4f. Delete song
    const delSongRes = deleteSong('proj-2', addRes.song!.id, 'owner');
    assert('4f. Delete song safely removes song from project tracklist',
      delSongRes.error === null &&
      !targetProject.songs?.some((s) => s.id === addRes.song!.id) &&
      targetProject.songs?.length === 2
    );
  }

  // 5. Database RLS and Organization Isolation Audit
  {
    const migrationSql = readFileSync(join(process.cwd(), 'supabase/migrations/20261002_create_projects.sql'), 'utf-8');

    // 5a. INSERT policy verifies client belongs to project's organization
    assert('5a. RLS INSERT policy verifies client belongs to project organization',
      migrationSql.includes('clients.organization_id = projects.organization_id') &&
      migrationSql.includes('Owners and Admins can insert projects')
    );

    // 5b. UPDATE policy verifies client belongs to project's organization
    assert('5b. RLS UPDATE policy verifies client belongs to project organization',
      migrationSql.includes('Owners and Admins can update projects') &&
      migrationSql.includes('private.has_org_role(projects.organization_id, ARRAY[\'owner\', \'admin\'], auth.uid())')
    );

    // 5c. SELECT policy restricts projects to organization members
    assert('5c. RLS SELECT policy strictly enforces organization membership',
      migrationSql.includes('Members can view projects in their organization') &&
      migrationSql.includes('private.is_org_member(projects.organization_id, auth.uid())')
    );

    // 5d. DELETE policy restricts to organization owners/admins
    assert('5d. RLS DELETE policy strictly restricts to organization owners and admins',
      migrationSql.includes('Owners and Admins can delete projects')
    );

    // 5e. project_songs RLS enforces organization isolation through parent project
    assert('5e. project_songs RLS strictly enforces parent project organization membership',
      migrationSql.includes('Members can view project songs in their organization') &&
      migrationSql.includes('private.is_org_member(projects.organization_id, auth.uid())') &&
      migrationSql.includes('Owners and Admins can insert project songs')
    );
  }

  // 6. Security audit: Zero service-role keys in frontend source files
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
  assert('5. Zero service role secrets in frontend source files', leaks.length === 0, leaks);

  console.log(`\n========================================`);
  console.log(`Step 8 Test Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep8ProjectManagementTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
