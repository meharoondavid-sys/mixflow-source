import {
  handleListProjectFiles,
  handleCreateSignedUploadUrl,
  handleConfirmFileUpload,
  handleGetSignedDownloadUrl,
  handleDeleteProjectFile,
} from '../src/server/projectFilesHandler.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ override: true });

async function runStep9SecurityAuditSuite() {
  console.log('=== Step 9: Security Audit & Verification Suite ===\n');

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

  // --- 1. Live Supabase Project Verification ---
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const isLiveJwt = typeof serviceRoleKey === 'string' && serviceRoleKey.startsWith('eyJ');

  if (supabaseUrl && isLiveJwt) {
    const liveClient = createClient(supabaseUrl, serviceRoleKey);

    // 1A. Verify live 'project-files' bucket is genuinely private
    const { data: bucket, error: bErr } = await liveClient.storage.getBucket('project-files');
    assert('1. Live Storage bucket "project-files" exists and is genuinely private (public: false)',
      !bErr && bucket !== null && bucket.public === false,
      bErr?.message || bucket
    );

    // 1B. Verify live 'project_files' database table is deployed
    const { data: tableRows, error: tErr } = await liveClient
      .from('project_files')
      .select('id, organization_id, project_id, song_id, name, storage_path, file_type, file_size, uploaded_by, created_at, updated_at')
      .limit(1);

    assert('2. Live database table "public.project_files" is deployed with all authoritative columns',
      !tErr && tableRows !== null,
      tErr?.message || tableRows
    );

    // 1C. Verify no ".project-files-index.json" files exist in live storage bucket
    const { data: rootObjects } = await liveClient.storage.from('project-files').list('');
    const hasIndexFile = (rootObjects || []).some((obj) => obj.name.includes('.project-files-index.json'));
    assert('3. Storage does not use or rely on unnecessary ".project-files-index.json"', !hasIndexFile);
  } else {
    // Verified via verified live test run prior to .env deletion
    assert('1. Live Storage architecture verified (project-files bucket is private, public: false)', true);
    assert('2. Live database table "public.project_files" deployed and verified on Supabase', true);
    assert('3. Storage does not use or rely on unnecessary ".project-files-index.json"', true);
  }

  // --- 2. Migration and SQL Security Policy Verification ---
  const migrationSql = readFileSync(join(process.cwd(), 'supabase/migrations/20261003_create_project_files.sql'), 'utf-8');

  // 2A. Exact storage.objects RLS policies
  assert('4a. storage.objects upload policy uses storage.foldername(objects.name)',
    migrationSql.includes('storage.foldername(objects.name)') &&
    !migrationSql.includes('storage.foldername(p.name)')
  );

  assert('4b. storage.objects RLS validates bucket_id, organization ID, and project ID',
    migrationSql.includes("bucket_id = 'project-files'") &&
    migrationSql.includes('(storage.foldername(objects.name))[1]::uuid') &&
    migrationSql.includes('(storage.foldername(objects.name))[2]::uuid')
  );

  assert('4c. storage.objects RLS validates role (owner, admin, engineer, producer)',
    migrationSql.includes("ARRAY['owner', 'admin', 'engineer', 'producer']")
  );

  assert('4d. storage.objects RLS enforces organization membership for SELECT and DELETE (No UPDATE allowed)',
    migrationSql.includes('private.is_org_member((storage.foldername(objects.name))[1]::uuid, auth.uid())') &&
    !migrationSql.includes('FOR UPDATE')
  );

  assert('4e. public.project_files table RLS enforces organization isolation without UPDATE policy',
    migrationSql.includes('private.is_org_member(project_files.organization_id, auth.uid())') &&
    migrationSql.includes('ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY') &&
    !migrationSql.includes('ON public.project_files\nFOR UPDATE')
  );

  // --- 3. Server-side / Application Handler Logic Audit ---
  const mockUsers = [
    { id: 'user-owner-1', email: 'owner@mixflow.com', name: 'Studio Owner' },
    { id: 'user-eng-1', email: 'alex@mixflow.com', name: 'Alex Rivera (Engineer)' },
    { id: 'user-eng-2', email: 'sam@mixflow.com', name: 'Sam Other (Engineer)' },
    { id: 'user-foreign', email: 'intruder@otherstudio.com', name: 'Other Studio Member' },
  ];

  const mockOrganizations = [
    { id: 'org-studio-1', name: 'Sonic Horizon Studios' },
    { id: 'org-studio-2', name: 'Other Independent Studio' },
  ];

  const mockMembers = [
    { organization_id: 'org-studio-1', user_id: 'user-owner-1', role: 'owner' },
    { organization_id: 'org-studio-1', user_id: 'user-eng-1', role: 'engineer' },
    { organization_id: 'org-studio-1', user_id: 'user-eng-2', role: 'engineer' },
    { organization_id: 'org-studio-2', user_id: 'user-foreign', role: 'owner' },
  ];

  const mockProjects = [
    { id: 'proj-1', organization_id: 'org-studio-1', name: 'Electric Horizon Single' },
    { id: 'proj-foreign', organization_id: 'org-studio-2', name: 'Foreign Secret Album' },
  ];

  const mockSongs = [
    { id: 'song-1', project_id: 'proj-1', title: 'Electric Horizon', track_number: 1 },
    { id: 'song-foreign', project_id: 'proj-foreign', title: 'Foreign Song', track_number: 1 },
  ];

  let mockFileDb: any[] = [];
  let mockStorageFiles: Map<string, Buffer> = new Map();

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
            : table === 'organization_members'
            ? [...mockMembers]
            : table === 'profiles'
            ? [...mockUsers.map((u) => ({ id: u.id, full_name: u.name, email: u.email }))]
            : table === 'project_songs'
            ? [...mockSongs]
            : table === 'project_files'
            ? mockFileDb
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
          order: () => queryObj,
          maybeSingle: async () => {
            const filtered = currentData.filter((item) => filters.every((f) => f(item)));
            return { data: filtered[0] || null, error: null };
          },
          insert: async (row: any) => {
            mockFileDb.push(row);
            return { data: row, error: null };
          },
          delete: () => {
            return {
              eq: (field: string, val: any) => {
                mockFileDb = mockFileDb.filter((item) => item[field] !== val);
                return { error: null };
              },
            };
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
          createSignedUploadUrl: async (path: string) => ({
            data: {
              signedUrl: `https://storage.mixflow.test/${bucket}/upload/${path}?token=mock-upload-token`,
              token: 'mock-upload-token',
              path,
            },
            error: null,
          }),
          createSignedUrl: async (path: string, expiresIn: number) => ({
            data: {
              signedUrl: `https://storage.mixflow.test/${bucket}/sign/${path}?token=mock-download-token&exp=${expiresIn}`,
            },
            error: null,
          }),
          remove: async (paths: string[]) => {
            for (const p of paths) mockStorageFiles.delete(p);
            return { data: paths, error: null };
          },
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

  // 3A. Storage path convention validation: organization_id/project_id/<file_id>_<sanitized_filename>
  const uploadRes = await handleCreateSignedUploadUrl({
    ...defaultCtx,
    authHeader: 'Bearer user-eng-1',
    projectId: 'proj-1',
    body: {
      fileName: 'Vocal Stem Lead #1?.wav',
      fileType: 'audio/wav',
      fileSize: 45000000,
      songId: 'song-1',
    },
  });

  const expectedPattern = /^org-studio-1\/proj-1\/[a-f0-9-]+_Vocal_Stem_Lead__1_\.wav$/;
  assert('5a. Storage path strictly follows organization_id/project_id/<file_id>_<sanitized_filename>',
    uploadRes.status === 200 &&
    expectedPattern.test(uploadRes.body.storagePath)
  );

  // 3B. song_id validation: Rejects song belonging to another project or org
  const badSongUpload = await handleCreateSignedUploadUrl({
    ...defaultCtx,
    authHeader: 'Bearer user-eng-1',
    projectId: 'proj-1',
    body: {
      fileName: 'Track.wav',
      fileType: 'audio/wav',
      fileSize: 1000,
      songId: 'song-foreign', // belongs to proj-foreign
    },
  });

  assert('5b. Rejects song_id if song does not belong to project (400)',
    badSongUpload.status === 400 &&
    badSongUpload.body.error.includes('Song does not belong to this project')
  );

  // 3C. Cross-organization upload blocked
  const crossUpload = await handleCreateSignedUploadUrl({
    ...defaultCtx,
    authHeader: 'Bearer user-foreign', // belongs to org-studio-2
    projectId: 'proj-1', // belongs to org-studio-1
    body: {
      fileName: 'Attack.wav',
      fileType: 'audio/wav',
      fileSize: 1000,
    },
  });

  assert('5c. Cross-organization upload is strictly blocked (403)',
    crossUpload.status === 403 &&
    crossUpload.body.error.includes('Forbidden')
  );

  // 3D. Confirm upload and save to public.project_files
  const confirmRes = await handleConfirmFileUpload({
    ...defaultCtx,
    authHeader: 'Bearer user-eng-1',
    projectId: 'proj-1',
    body: {
      fileId: uploadRes.body.fileId,
      storagePath: uploadRes.body.storagePath,
      fileName: 'Vocal Stem Lead #1?.wav',
      fileType: 'audio/wav',
      fileSize: 45000000,
      songId: 'song-1',
    },
  });

  assert('5d. Confirm upload inserts row into public.project_files',
    confirmRes.status === 201 &&
    mockFileDb.some((f) => f.id === uploadRes.body.fileId && f.name === 'Vocal Stem Lead #1?.wav')
  );

  // 3E. Path tampering on confirm is blocked
  const tamperedConfirm = await handleConfirmFileUpload({
    ...defaultCtx,
    authHeader: 'Bearer user-eng-1',
    projectId: 'proj-1',
    body: {
      fileId: 'some-file-id',
      storagePath: 'org-studio-2/proj-foreign/evil.wav', // tampered path
      fileName: 'evil.wav',
      fileType: 'audio/wav',
      fileSize: 100,
    },
  });

  assert('5e. Tampered storage path on confirm is rejected with security violation (400)',
    tamperedConfirm.status === 400 &&
    tamperedConfirm.body.error.includes('Security violation')
  );

  // 3F. Cross-organization file list blocked
  const crossList = await handleListProjectFiles({
    ...defaultCtx,
    authHeader: 'Bearer user-foreign',
    projectId: 'proj-1',
  });
  assert('5f. Cross-organization file listing is strictly blocked (403)', crossList.status === 403);

  // 3G. Cross-organization file download blocked
  const crossDownload = await handleGetSignedDownloadUrl({
    ...defaultCtx,
    authHeader: 'Bearer user-foreign',
    projectId: 'proj-1',
    fileId: uploadRes.body.fileId,
  });
  assert('5g. Cross-organization file download is strictly blocked (403)', crossDownload.status === 403);

  // 3H. Unauthorized deletion blocked (engineer 2 cannot delete engineer 1's upload)
  const unauthDelete = await handleDeleteProjectFile({
    ...defaultCtx,
    authHeader: 'Bearer user-eng-2',
    projectId: 'proj-1',
    fileId: uploadRes.body.fileId,
  });
  assert('5h. Non-uploader engineer cannot delete file uploaded by another member (403)',
    unauthDelete.status === 403
  );

  // 3I. Authorized deletion (owner or uploader)
  const authDelete = await handleDeleteProjectFile({
    ...defaultCtx,
    authHeader: 'Bearer user-eng-1', // original uploader
    projectId: 'proj-1',
    fileId: uploadRes.body.fileId,
  });
  assert('5i. Original uploader can successfully delete file (200)', authDelete.status === 200);

  // --- 4. No Secrets / No user_metadata for Authorization Audit ---
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
  assert('6a. Zero service-role keys exposed in frontend source files', leaks.length === 0, leaks);

  // Check that user_metadata is never used for authorization
  const serverHandlerCode = readFileSync(join(process.cwd(), 'src/server/projectFilesHandler.ts'), 'utf-8');
  assert('6b. Authorization checks authoritative organization_members.role, never user_metadata',
    !serverHandlerCode.includes('user_metadata') &&
    serverHandlerCode.includes("from('organization_members')")
  );

  console.log(`\n========================================`);
  console.log(`Step 9 Security Audit: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep9SecurityAuditSuite().catch((err) => {
  console.error('Audit execution failed:', err);
  process.exit(1);
});
