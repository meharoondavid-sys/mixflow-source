-- MixFlow: Migration for Versioned Audio Review & Timestamped Client Feedback
-- Step 11: Audio Versions and Timestamped Client Feedback

-- ============================================================================
-- 1. Table: public.project_file_versions
-- Stores immutable versions of audio deliverables / mixes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_file_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  song_id uuid REFERENCES public.project_songs(id) ON DELETE SET NULL,
  file_id uuid REFERENCES public.project_files(id) ON DELETE SET NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  duration_seconds numeric(10,2) DEFAULT NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  notes text DEFAULT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deterministic version uniqueness per project & song
CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_proj_song_num 
ON public.project_file_versions(project_id, COALESCE(song_id, '00000000-0000-0000-0000-000000000000'::uuid), version_number);

CREATE INDEX IF NOT EXISTS idx_versions_org_id ON public.project_file_versions(organization_id);
CREATE INDEX IF NOT EXISTS idx_versions_project_id ON public.project_file_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_versions_song_id ON public.project_file_versions(song_id);
CREATE INDEX IF NOT EXISTS idx_versions_created_at ON public.project_file_versions(created_at DESC);

-- Enable RLS on public.project_file_versions
ALTER TABLE public.project_file_versions ENABLE ROW LEVEL SECURITY;

-- Note: Strictly NO UPDATE policy is defined. Versions are immutable once created.

-- SELECT: Organization members can view versions for their organization
DROP POLICY IF EXISTS "Members can view versions in their organization" ON public.project_file_versions;
CREATE POLICY "Members can view versions in their organization"
ON public.project_file_versions
FOR SELECT
TO authenticated
USING (
  private.is_org_member(project_file_versions.organization_id, auth.uid())
);

-- SELECT: Clients can view versions for their assigned projects
DROP POLICY IF EXISTS "Clients can view versions for their assigned projects" ON public.project_file_versions;
CREATE POLICY "Clients can view versions for their assigned projects"
ON public.project_file_versions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    JOIN public.clients ON clients.id = projects.client_id
    WHERE projects.id = project_file_versions.project_id
      AND clients.user_id = auth.uid()
  )
);

-- INSERT: Authorized studio members (owner, admin, engineer, producer) can create new versions
DROP POLICY IF EXISTS "Authorized members can insert versions" ON public.project_file_versions;
CREATE POLICY "Authorized members can insert versions"
ON public.project_file_versions
FOR INSERT
TO authenticated
WITH CHECK (
  private.has_org_role(project_file_versions.organization_id, ARRAY['owner', 'admin', 'engineer', 'producer'], auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_file_versions.project_id
      AND projects.organization_id = project_file_versions.organization_id
  )
);

-- DELETE: Owners, Admins, or uploader can delete versions
DROP POLICY IF EXISTS "Owners, Admins, or uploader can delete versions" ON public.project_file_versions;
CREATE POLICY "Owners, Admins, or uploader can delete versions"
ON public.project_file_versions
FOR DELETE
TO authenticated
USING (
  private.has_org_role(project_file_versions.organization_id, ARRAY['owner', 'admin'], auth.uid())
  OR (
    uploaded_by = auth.uid()
    AND private.is_org_member(project_file_versions.organization_id, auth.uid())
  )
);

GRANT SELECT, INSERT, DELETE ON public.project_file_versions TO authenticated;

-- ============================================================================
-- 2. Table: public.project_feedback
-- Stores timestamped feedback on specific audio versions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  song_id uuid REFERENCES public.project_songs(id) ON DELETE SET NULL,
  version_id uuid NOT NULL REFERENCES public.project_file_versions(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'client' CHECK (author_role IN ('client', 'engineer', 'producer', 'owner', 'admin')),
  timestamp_seconds numeric(10,2) NOT NULL CHECK (timestamp_seconds >= 0),
  comment text NOT NULL CHECK (length(trim(comment)) > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz DEFAULT NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_org_id ON public.project_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_project_id ON public.project_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_version_id ON public.project_feedback(version_id);
CREATE INDEX IF NOT EXISTS idx_feedback_client_id ON public.project_feedback(client_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.project_feedback(created_at DESC);

-- Enable RLS on public.project_feedback
ALTER TABLE public.project_feedback ENABLE ROW LEVEL SECURITY;

-- SELECT: Organization members can view feedback for their projects
DROP POLICY IF EXISTS "Members can view feedback in their organization" ON public.project_feedback;
CREATE POLICY "Members can view feedback in their organization"
ON public.project_feedback
FOR SELECT
TO authenticated
USING (
  private.is_org_member(project_feedback.organization_id, auth.uid())
);

-- SELECT: Clients can view feedback on their assigned projects
DROP POLICY IF EXISTS "Clients can view feedback on their assigned projects" ON public.project_feedback;
CREATE POLICY "Clients can view feedback on their assigned projects"
ON public.project_feedback
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    JOIN public.clients ON clients.id = projects.client_id
    WHERE projects.id = project_feedback.project_id
      AND clients.user_id = auth.uid()
  )
);

-- INSERT: Clients can insert feedback for their assigned projects
DROP POLICY IF EXISTS "Clients can insert feedback on their assigned projects" ON public.project_feedback;
CREATE POLICY "Clients can insert feedback on their assigned projects"
ON public.project_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    JOIN public.clients ON clients.id = projects.client_id
    WHERE projects.id = project_feedback.project_id
      AND clients.user_id = auth.uid()
  )
);

-- INSERT: Organization members can also insert feedback/notes
DROP POLICY IF EXISTS "Members can insert feedback on their projects" ON public.project_feedback;
CREATE POLICY "Members can insert feedback on their projects"
ON public.project_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_org_member(project_feedback.organization_id, auth.uid())
);

-- UPDATE: Organization members can update feedback status (e.g. resolve)
DROP POLICY IF EXISTS "Members can update feedback in their organization" ON public.project_feedback;
CREATE POLICY "Members can update feedback in their organization"
ON public.project_feedback
FOR UPDATE
TO authenticated
USING (
  private.is_org_member(project_feedback.organization_id, auth.uid())
)
WITH CHECK (
  private.is_org_member(project_feedback.organization_id, auth.uid())
);

-- DELETE: Owners, Admins, or feedback author can delete feedback
DROP POLICY IF EXISTS "Owners, Admins, or author can delete feedback" ON public.project_feedback;
CREATE POLICY "Owners, Admins, or author can delete feedback"
ON public.project_feedback
FOR DELETE
TO authenticated
USING (
  private.has_org_role(project_feedback.organization_id, ARRAY['owner', 'admin'], auth.uid())
  OR author_id = auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_feedback TO authenticated;
