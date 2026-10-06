-- MixFlow: Migration for Client Portal Foundation
-- Step 10: Client Authentication & Portal Access

-- 1. Add user_id to public.clients to securely link client records to authenticated Supabase users
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- 2. RLS on public.clients: Allow clients to read their own client record
DROP POLICY IF EXISTS "Clients can view their own client profile" ON public.clients;
CREATE POLICY "Clients can view their own client profile"
ON public.clients
FOR SELECT
TO authenticated
USING (
  clients.user_id = auth.uid()
);

-- 3. RLS on public.projects: Allow clients to view projects assigned to them
DROP POLICY IF EXISTS "Clients can view their own assigned projects" ON public.projects;
CREATE POLICY "Clients can view their own assigned projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = projects.client_id
      AND clients.user_id = auth.uid()
  )
);

-- 4. RLS on public.project_songs: Allow clients to view songs belonging to their assigned projects
DROP POLICY IF EXISTS "Clients can view songs for their assigned projects" ON public.project_songs;
CREATE POLICY "Clients can view songs for their assigned projects"
ON public.project_songs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    JOIN public.clients ON clients.id = projects.client_id
    WHERE projects.id = project_songs.project_id
      AND clients.user_id = auth.uid()
  )
);

-- 5. RLS on public.project_files: Allow clients to view files for their assigned projects
DROP POLICY IF EXISTS "Clients can view files for their assigned projects" ON public.project_files;
CREATE POLICY "Clients can view files for their assigned projects"
ON public.project_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    JOIN public.clients ON clients.id = projects.client_id
    WHERE projects.id = project_files.project_id
      AND clients.user_id = auth.uid()
  )
);

-- Note:
-- Clients are strictly granted read-only (SELECT) access.
-- No INSERT, UPDATE, or DELETE policies are granted to clients on projects, songs, or files.
-- All existing organization member policies remain active and unchanged.
-- Step 9 Storage RLS policies on storage.objects are preserved with zero modifications.
