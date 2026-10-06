-- MixFlow: Migration for public.project_deliveries
-- Step 14: Final Delivery Foundation

-- 1. Create table public.project_deliveries
CREATE TABLE IF NOT EXISTS public.project_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  song_id uuid REFERENCES public.project_songs(id) ON DELETE SET NULL,
  version_id uuid NOT NULL REFERENCES public.project_file_versions(id) ON DELETE RESTRICT,
  file_id uuid REFERENCES public.project_files(id) ON DELETE SET NULL,
  deliverable_type text NOT NULL CHECK (deliverable_type IN ('master', 'instrumental', 'stems', 'other')),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  file_type text,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'delivered')),
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Constraints & Uniqueness Indexes
-- Prevent duplicate active final deliveries for the same project, song, deliverable_type, and version
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_deliveries_unique_release
ON public.project_deliveries (
  project_id,
  COALESCE(song_id, '00000000-0000-0000-0000-000000000000'::uuid),
  deliverable_type,
  version_id
);

-- Performance and isolation indexes
CREATE INDEX IF NOT EXISTS idx_project_deliveries_org_id ON public.project_deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_project_id ON public.project_deliveries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_song_id ON public.project_deliveries(song_id);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_version_id ON public.project_deliveries(version_id);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_status ON public.project_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_created_at ON public.project_deliveries(created_at DESC);

-- 3. Auto-update updated_at timestamp trigger
DROP TRIGGER IF EXISTS set_project_deliveries_updated_at ON public.project_deliveries;
CREATE TRIGGER set_project_deliveries_updated_at
BEFORE UPDATE ON public.project_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 4. Immutable Audit Trail: Prevent deletion trigger
CREATE OR REPLACE FUNCTION public.prevent_project_deliveries_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of final delivery records is forbidden. Final deliverables are immutable studio releases for audit and archival integrity.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_project_deliveries_deletion ON public.project_deliveries;
CREATE TRIGGER trg_prevent_project_deliveries_deletion
BEFORE DELETE ON public.project_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_project_deliveries_deletion();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.project_deliveries ENABLE ROW LEVEL SECURITY;

-- 6. Permissions and Grants
REVOKE ALL ON public.project_deliveries FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.project_deliveries TO authenticated;
GRANT ALL ON public.project_deliveries TO service_role;

-- 7. RLS Policies
-- Policy 1: SELECT (Studio Staff) - Members can view deliveries for their organization
DROP POLICY IF EXISTS "Members can view deliveries in their organization" ON public.project_deliveries;
CREATE POLICY "Members can view deliveries in their organization"
ON public.project_deliveries
FOR SELECT
TO authenticated
USING (
  private.is_org_member(project_deliveries.organization_id, auth.uid())
);

-- Policy 2: SELECT (Clients) - Assigned clients can view deliveries for their projects
DROP POLICY IF EXISTS "Clients can view deliveries for their assigned projects" ON public.project_deliveries;
CREATE POLICY "Clients can view deliveries for their assigned projects"
ON public.project_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    JOIN public.clients ON clients.id = projects.client_id
    WHERE projects.id = project_deliveries.project_id
      AND clients.user_id = auth.uid()
  )
);

-- Policy 3: INSERT - Owner, Admin, and Engineer can release final deliveries
DROP POLICY IF EXISTS "Owner, admin, engineer can create deliveries" ON public.project_deliveries;
CREATE POLICY "Owner, admin, engineer can create deliveries"
ON public.project_deliveries
FOR INSERT
TO authenticated
WITH CHECK (
  private.has_org_role(project_deliveries.organization_id, ARRAY['owner', 'admin', 'engineer'], auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_deliveries.project_id
      AND projects.organization_id = project_deliveries.organization_id
  )
  AND EXISTS (
    SELECT 1 FROM public.project_file_versions pfv
    WHERE pfv.id = project_deliveries.version_id
      AND pfv.project_id = project_deliveries.project_id
      AND pfv.organization_id = project_deliveries.organization_id
  )
);

-- Policy 4: UPDATE - Authorized studio staff can update delivery status
DROP POLICY IF EXISTS "Owner, admin, engineer can update deliveries" ON public.project_deliveries;
CREATE POLICY "Owner, admin, engineer can update deliveries"
ON public.project_deliveries
FOR UPDATE
TO authenticated
USING (
  private.has_org_role(project_deliveries.organization_id, ARRAY['owner', 'admin', 'engineer'], auth.uid())
)
WITH CHECK (
  private.has_org_role(project_deliveries.organization_id, ARRAY['owner', 'admin', 'engineer'], auth.uid())
);

-- Note: NO DELETE policy is defined. Deletions are forbidden by default deny and blocked by trigger.
