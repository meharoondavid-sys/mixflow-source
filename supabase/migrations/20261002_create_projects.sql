-- MixFlow: Migration for public.projects and public.project_songs
-- Phase 2: Real Projects Foundation

-- 1. Create table public.projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  name text NOT NULL,
  project_type text NOT NULL CHECK (project_type IN ('single', 'ep', 'album')),
  description text,
  project_price numeric NOT NULL DEFAULT 0 CHECK (project_price >= 0),
  deposit_amount numeric NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  deadline date,
  status text NOT NULL DEFAULT 'inquiry' CHECK (status IN (
    'inquiry',
    'awaiting_files',
    'in_production',
    'in_review',
    'needs_revision',
    'approved',
    'completed',
    'cancelled'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_deposit_not_exceed_price CHECK (deposit_amount <= project_price)
);

-- 2. Create table public.project_songs
CREATE TABLE IF NOT EXISTS public.project_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  track_number integer NOT NULL DEFAULT 1 CHECK (track_number > 0),
  status text NOT NULL DEFAULT 'in_production',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes for performance, isolation, and uniqueness
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_songs_project_id ON public.project_songs(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_songs_unique_track_number ON public.project_songs(project_id, track_number);

-- 4. Triggers for updated_at
DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_project_songs_updated_at ON public.project_songs;
CREATE TRIGGER set_project_songs_updated_at
BEFORE UPDATE ON public.project_songs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_songs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for public.projects
-- SELECT: Organization members can view projects belonging to their organization
DROP POLICY IF EXISTS "Members can view projects in their organization" ON public.projects;
CREATE POLICY "Members can view projects in their organization"
ON public.projects
FOR SELECT
TO authenticated
USING (
  private.is_org_member(projects.organization_id, auth.uid())
);

-- INSERT: Owners and Admins can create projects in their organization, verifying client also belongs to organization
DROP POLICY IF EXISTS "Owners and Admins can insert projects" ON public.projects;
CREATE POLICY "Owners and Admins can insert projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  private.has_org_role(projects.organization_id, ARRAY['owner', 'admin'], auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = projects.client_id
      AND clients.organization_id = projects.organization_id
  )
);

-- UPDATE: Owners and Admins can update projects in their organization
DROP POLICY IF EXISTS "Owners and Admins can update projects" ON public.projects;
CREATE POLICY "Owners and Admins can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  private.has_org_role(projects.organization_id, ARRAY['owner', 'admin'], auth.uid())
)
WITH CHECK (
  private.has_org_role(projects.organization_id, ARRAY['owner', 'admin'], auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = projects.client_id
      AND clients.organization_id = projects.organization_id
  )
);

-- DELETE: Owners and Admins can delete projects in their organization
DROP POLICY IF EXISTS "Owners and Admins can delete projects" ON public.projects;
CREATE POLICY "Owners and Admins can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  private.has_org_role(projects.organization_id, ARRAY['owner', 'admin'], auth.uid())
);

-- 7. RLS Policies for public.project_songs
-- SELECT: Members can view songs for projects belonging to their organization
DROP POLICY IF EXISTS "Members can view project songs in their organization" ON public.project_songs;
CREATE POLICY "Members can view project songs in their organization"
ON public.project_songs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_songs.project_id
      AND private.is_org_member(projects.organization_id, auth.uid())
  )
);

-- INSERT: Owners and Admins can insert songs for projects in their organization
DROP POLICY IF EXISTS "Owners and Admins can insert project songs" ON public.project_songs;
CREATE POLICY "Owners and Admins can insert project songs"
ON public.project_songs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_songs.project_id
      AND private.has_org_role(projects.organization_id, ARRAY['owner', 'admin'], auth.uid())
  )
);

-- UPDATE: Owners and Admins can update songs for projects in their organization
DROP POLICY IF EXISTS "Owners and Admins can update project songs" ON public.project_songs;
CREATE POLICY "Owners and Admins can update project songs"
ON public.project_songs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_songs.project_id
      AND private.has_org_role(projects.organization_id, ARRAY['owner', 'admin'], auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_songs.project_id
      AND private.has_org_role(projects.organization_id, ARRAY['owner', 'admin'], auth.uid())
  )
);

-- DELETE: Owners and Admins can delete songs for projects in their organization
DROP POLICY IF EXISTS "Owners and Admins can delete project songs" ON public.project_songs;
CREATE POLICY "Owners and Admins can delete project songs"
ON public.project_songs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_songs.project_id
      AND private.has_org_role(projects.organization_id, ARRAY['owner', 'admin'], auth.uid())
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_songs TO authenticated;
