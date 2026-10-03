-- MixFlow: Migration for public.organization_invitations
-- Phase 1: Database Foundation for Organization Invitations

-- 1. Create table public.organization_invitations
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'admin',
    'engineer',
    'producer',
    'assistant',
    'finance'
  )),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'accepted',
    'revoked',
    'expired'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for Organization Isolation, Email Lookup, and Partial Pending Uniqueness
-- Case-insensitive partial unique index: ensures no duplicate pending invitations exist
-- for the same email in the same organization, while preserving historical records (accepted/revoked/expired).
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_org_email_pending
ON public.organization_invitations (organization_id, lower(email))
WHERE status = 'pending';

-- Performance index for organization-level queries
CREATE INDEX IF NOT EXISTS idx_org_invitations_organization_id
ON public.organization_invitations (organization_id);

-- Performance index for recipient email lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_org_invitations_email_lower
ON public.organization_invitations (lower(email));

-- Performance index for status filtering
CREATE INDEX IF NOT EXISTS idx_org_invitations_status
ON public.organization_invitations (status);

-- Performance index for audit/tracking who created the invitation
CREATE INDEX IF NOT EXISTS idx_org_invitations_invited_by
ON public.organization_invitations (invited_by);

-- 3. Reuse existing updated_at trigger function
DROP TRIGGER IF EXISTS set_organization_invitations_updated_at ON public.organization_invitations;
CREATE TRIGGER set_organization_invitations_updated_at
BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies using authoritative organization_members table
-- Policy 1: SELECT - Only Owner and Admin can view invitations belonging to their organization
DROP POLICY IF EXISTS "Owners and Admins can view invitations in their organization" ON public.organization_invitations;
CREATE POLICY "Owners and Admins can view invitations in their organization"
ON public.organization_invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_invitations.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);

-- Policy 2: DELETE - Only Owner and Admin can delete/revoke invitations belonging to their organization
DROP POLICY IF EXISTS "Owners and Admins can delete invitations in their organization" ON public.organization_invitations;
CREATE POLICY "Owners and Admins can delete invitations in their organization"
ON public.organization_invitations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_invitations.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);

-- Note: Normal authenticated users do NOT have INSERT or UPDATE policies.
-- Privileged invitation creation will be executed via secure server-side endpoint.

-- 6. Permissions: Grant SELECT and DELETE to authenticated users; revoke all from anon
GRANT SELECT, DELETE ON public.organization_invitations TO authenticated;
REVOKE ALL ON public.organization_invitations FROM anon;
