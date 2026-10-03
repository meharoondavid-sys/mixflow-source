-- MixFlow: Migration for public.project_files table and Supabase Storage bucket
-- Step 9: Project File Management

-- 1. Create table public.project_files
CREATE TABLE IF NOT EXISTS public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  song_id uuid REFERENCES public.project_songs(id) ON DELETE SET NULL,
  name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Performance and isolation indexes
CREATE INDEX IF NOT EXISTS idx_project_files_org_id ON public.project_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_song_id ON public.project_files(song_id);
CREATE INDEX IF NOT EXISTS idx_project_files_created_at ON public.project_files(created_at DESC);

-- 3. Auto-update updated_at timestamp trigger
DROP TRIGGER IF EXISTS set_project_files_updated_at ON public.project_files;
CREATE TRIGGER set_project_files_updated_at
BEFORE UPDATE ON public.project_files
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for public.project_files

-- SELECT: Organization members can view files for projects belonging to their organization
DROP POLICY IF EXISTS "Members can view project files in their organization" ON public.project_files;
CREATE POLICY "Members can view project files in their organization"
ON public.project_files
FOR SELECT
TO authenticated
USING (
  private.is_org_member(project_files.organization_id, auth.uid())
);

-- INSERT: Authorized organization members can upload files for projects in their organization
DROP POLICY IF EXISTS "Members can insert project files in their organization" ON public.project_files;
CREATE POLICY "Members can insert project files in their organization"
ON public.project_files
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_org_member(project_files.organization_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_files.project_id
      AND projects.organization_id = project_files.organization_id
  )
  AND (
    project_files.song_id IS NULL OR EXISTS (
      SELECT 1 FROM public.project_songs
      WHERE project_songs.id = project_files.song_id
        AND project_songs.project_id = project_files.project_id
    )
  )
);

-- UPDATE: Authorized roles (owner, admin, engineer, producer) can update file metadata
DROP POLICY IF EXISTS "Authorized roles can update project files" ON public.project_files;
CREATE POLICY "Authorized roles can update project files"
ON public.project_files
FOR UPDATE
TO authenticated
USING (
  private.has_org_role(project_files.organization_id, ARRAY['owner', 'admin', 'engineer', 'producer'], auth.uid())
)
WITH CHECK (
  private.has_org_role(project_files.organization_id, ARRAY['owner', 'admin', 'engineer', 'producer'], auth.uid())
);

-- DELETE: Owners, Admins, or the original uploader can delete project files
DROP POLICY IF EXISTS "Owners, Admins, or uploader can delete project files" ON public.project_files;
CREATE POLICY "Owners, Admins, or uploader can delete project files"
ON public.project_files
FOR DELETE
TO authenticated
USING (
  private.has_org_role(project_files.organization_id, ARRAY['owner', 'admin'], auth.uid())
  OR (
    uploaded_by = auth.uid() 
    AND private.is_org_member(project_files.organization_id, auth.uid())
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
