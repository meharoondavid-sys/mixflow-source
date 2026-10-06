-- MixFlow: Migration for public.project_payments table
-- Step 13: Payments & Billing Foundation

-- ============================================================================
-- 1. Table: public.project_payments
-- Authoritative financial records of payments for production projects.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method text DEFAULT NULL,
  reference text DEFAULT NULL,
  paid_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. Indexes for Organization Isolation & Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_project_payments_org_id ON public.project_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_project_id ON public.project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_client_id ON public.project_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_status ON public.project_payments(status);
CREATE INDEX IF NOT EXISTS idx_project_payments_created_at ON public.project_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_payments_paid_at ON public.project_payments(paid_at DESC);

-- ============================================================================
-- 3. Auto-update updated_at timestamp trigger
-- ============================================================================

DROP TRIGGER IF EXISTS set_project_payments_updated_at ON public.project_payments;
CREATE TRIGGER set_project_payments_updated_at
BEFORE UPDATE ON public.project_payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. Payment History Protection: Immutable Ledger
-- Payments represent immutable audit trails. Unauthorized deletion is strictly blocked.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_project_payments_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Payment history records are immutable financial records and cannot be deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_project_payments_deletion ON public.project_payments;
CREATE TRIGGER trg_prevent_project_payments_deletion
BEFORE DELETE ON public.project_payments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_project_payments_deletion();

-- ============================================================================
-- 5. Enable Row Level Security (RLS) & Grants
-- ============================================================================

ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_payments FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.project_payments TO authenticated;
GRANT ALL ON public.project_payments TO service_role;

-- ============================================================================
-- 6. RLS Policies
-- ============================================================================

-- 6A. SELECT: Organization members can view payments within their organization
DROP POLICY IF EXISTS "Members can view payments in their organization" ON public.project_payments;
CREATE POLICY "Members can view payments in their organization"
ON public.project_payments
FOR SELECT
TO authenticated
USING (
  private.is_org_member(project_payments.organization_id, auth.uid())
);

-- 6B. SELECT: Clients can view payments for their assigned project only
DROP POLICY IF EXISTS "Clients can view payments for their assigned projects" ON public.project_payments;
CREATE POLICY "Clients can view payments for their assigned projects"
ON public.project_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    JOIN public.clients ON clients.id = projects.client_id
    WHERE projects.id = project_payments.project_id
      AND clients.user_id = auth.uid()
  )
);

-- 6C. INSERT: Only owner, admin, or finance can record payments
DROP POLICY IF EXISTS "Owner, admin, finance can create payments" ON public.project_payments;
CREATE POLICY "Owner, admin, finance can create payments"
ON public.project_payments
FOR INSERT
TO authenticated
WITH CHECK (
  private.has_org_role(project_payments.organization_id, ARRAY['owner', 'admin', 'finance'], auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_payments.project_id
      AND projects.organization_id = project_payments.organization_id
  )
  AND (
    project_payments.client_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = project_payments.client_id
        AND clients.organization_id = project_payments.organization_id
    )
  )
);

-- 6D. UPDATE: Only owner, admin, or finance can adjust payment status/references (e.g. mark pending as paid)
DROP POLICY IF EXISTS "Owner, admin, finance can update payments" ON public.project_payments;
CREATE POLICY "Owner, admin, finance can update payments"
ON public.project_payments
FOR UPDATE
TO authenticated
USING (
  private.has_org_role(project_payments.organization_id, ARRAY['owner', 'admin', 'finance'], auth.uid())
)
WITH CHECK (
  private.has_org_role(project_payments.organization_id, ARRAY['owner', 'admin', 'finance'], auth.uid())
);

-- Note: Strictly NO DELETE policy is created. Deletions are denied by RLS and forbidden by trigger.
