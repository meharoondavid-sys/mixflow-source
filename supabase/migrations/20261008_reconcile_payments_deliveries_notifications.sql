-- MixFlow live-schema reconciliation migration
-- This migration was applied to the existing production Supabase project.
-- It intentionally does NOT replay the earlier Step 13-15 migrations because
-- the live database already contains the preceding schema and hardened RLS helpers.
--
-- Important design decisions:
-- 1. Payment and final-delivery history uses RESTRICT on project/org parents.
--    These records must not disappear through cascade deletion.
-- 2. Notification recipients may update only read_at directly.
-- 3. Notifications are inserted by trusted server-side code.
--
-- The complete applied SQL is preserved in Supabase migration history under:
-- 20261006075933 / 20261008_reconcile_payments_deliveries_notifications

CREATE TABLE IF NOT EXISTS public.project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL CHECK (status IN ('pending','paid','failed','refunded')),
  payment_method text DEFAULT NULL,
  reference text DEFAULT NULL,
  paid_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_payments_org_id ON public.project_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_project_id ON public.project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_client_id ON public.project_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_status ON public.project_payments(status);
CREATE INDEX IF NOT EXISTS idx_project_payments_created_at ON public.project_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_payments_paid_at ON public.project_payments(paid_at DESC);

DROP TRIGGER IF EXISTS set_project_payments_updated_at ON public.project_payments;
CREATE TRIGGER set_project_payments_updated_at BEFORE UPDATE ON public.project_payments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_project_payments_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Payment history records are immutable financial records and cannot be deleted.';
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS trg_prevent_project_payments_deletion ON public.project_payments;
CREATE TRIGGER trg_prevent_project_payments_deletion BEFORE DELETE ON public.project_payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_project_payments_deletion();

ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_payments FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.project_payments TO authenticated;
GRANT ALL ON public.project_payments TO service_role;

DROP POLICY IF EXISTS "Members can view payments in their organization" ON public.project_payments;
CREATE POLICY "Members can view payments in their organization" ON public.project_payments
FOR SELECT TO authenticated USING (private.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Clients can view payments for their assigned projects" ON public.project_payments;
CREATE POLICY "Clients can view payments for their assigned projects" ON public.project_payments
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.projects
    JOIN public.clients ON clients.id = projects.client_id
    WHERE projects.id = project_payments.project_id AND clients.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owner, admin, finance can create payments" ON public.project_payments;
CREATE POLICY "Owner, admin, finance can create payments" ON public.project_payments
FOR INSERT TO authenticated WITH CHECK (
  private.has_org_role(organization_id, ARRAY['owner','admin','finance'], auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_payments.project_id
      AND projects.organization_id = project_payments.organization_id
  )
  AND (
    client_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = project_payments.client_id
        AND clients.organization_id = project_payments.organization_id
    )
  )
);

DROP POLICY IF EXISTS "Owner, admin, finance can update payments" ON public.project_payments;
CREATE POLICY "Owner, admin, finance can update payments" ON public.project_payments
FOR UPDATE TO authenticated
USING (private.has_org_role(organization_id, ARRAY['owner','admin','finance'], auth.uid()))
WITH CHECK (private.has_org_role(organization_id, ARRAY['owner','admin','finance'], auth.uid()));

CREATE TABLE IF NOT EXISTS public.project_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  song_id uuid REFERENCES public.project_songs(id) ON DELETE SET NULL,
  version_id uuid NOT NULL REFERENCES public.project_file_versions(id) ON DELETE RESTRICT,
  file_id uuid REFERENCES public.project_files(id) ON DELETE SET NULL,
  deliverable_type text NOT NULL CHECK (deliverable_type IN ('master','instrumental','stems','other')),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  file_type text,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','delivered')),
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_deliveries_unique_release
ON public.project_deliveries (
  project_id,
  COALESCE(song_id, '00000000-0000-0000-0000-000000000000'::uuid),
  deliverable_type,
  version_id
);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_org_id ON public.project_deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_project_id ON public.project_deliveries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_song_id ON public.project_deliveries(song_id);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_version_id ON public.project_deliveries(version_id);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_status ON public.project_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_project_deliveries_created_at ON public.project_deliveries(created_at DESC);

DROP TRIGGER IF EXISTS set_project_deliveries_updated_at ON public.project_deliveries;
CREATE TRIGGER set_project_deliveries_updated_at BEFORE UPDATE ON public.project_deliveries
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_project_deliveries_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of final delivery records is forbidden. Final deliverables are immutable studio releases for audit and archival integrity.';
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS trg_prevent_project_deliveries_deletion ON public.project_deliveries;
CREATE TRIGGER trg_prevent_project_deliveries_deletion BEFORE DELETE ON public.project_deliveries
FOR EACH ROW EXECUTE FUNCTION public.prevent_project_deliveries_deletion();

ALTER TABLE public.project_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_deliveries FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.project_deliveries TO authenticated;
GRANT ALL ON public.project_deliveries TO service_role;

DROP POLICY IF EXISTS "Members can view deliveries in their organization" ON public.project_deliveries;
CREATE POLICY "Members can view deliveries in their organization" ON public.project_deliveries
FOR SELECT TO authenticated USING (private.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Clients can view deliveries for their assigned projects" ON public.project_deliveries;
CREATE POLICY "Clients can view deliveries for their assigned projects" ON public.project_deliveries
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.projects
    JOIN public.clients ON clients.id = projects.client_id
    WHERE projects.id = project_deliveries.project_id AND clients.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owner, admin, engineer can create deliveries" ON public.project_deliveries;
CREATE POLICY "Owner, admin, engineer can create deliveries" ON public.project_deliveries
FOR INSERT TO authenticated WITH CHECK (
  private.has_org_role(organization_id, ARRAY['owner','admin','engineer'], auth.uid())
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

DROP POLICY IF EXISTS "Owner, admin, engineer can update deliveries" ON public.project_deliveries;
CREATE POLICY "Owner, admin, engineer can update deliveries" ON public.project_deliveries
FOR UPDATE TO authenticated
USING (private.has_org_role(organization_id, ARRAY['owner','admin','engineer'], auth.uid()))
WITH CHECK (private.has_org_role(organization_id, ARRAY['owner','admin','engineer'], auth.uid()));

CREATE TABLE IF NOT EXISTS public.project_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN (
    'feedback_added','feedback_resolved','revision_requested','version_uploaded',
    'version_approved','payment_recorded','payment_status_changed','delivery_released',
    'delivery_downloaded','project_created','project_status_changed','project_assigned',
    'collaborator_invited'
  )),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  message text NOT NULL CHECK (length(trim(message)) > 0),
  link_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_notifications_recipient_unread
ON public.project_notifications(recipient_user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_notifications_recipient_all
ON public.project_notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_notifications_org_id ON public.project_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_notifications_project_id ON public.project_notifications(project_id);

ALTER TABLE public.project_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_notifications FROM anon;
GRANT SELECT ON public.project_notifications TO authenticated;
GRANT UPDATE(read_at) ON public.project_notifications TO authenticated;
GRANT ALL ON public.project_notifications TO service_role;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.project_notifications;
CREATE POLICY "Users can view their own notifications" ON public.project_notifications
FOR SELECT TO authenticated USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications read status" ON public.project_notifications;
CREATE POLICY "Users can update their own notifications read status" ON public.project_notifications
FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid());
