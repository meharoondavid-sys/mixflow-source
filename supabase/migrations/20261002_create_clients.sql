-- MixFlow: Migration for public.clients table
-- Creates clients table, indexes, updated_at trigger, and RLS policies

-- 1. Create table public.clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  company_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for organization isolation and search performance
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON public.clients(full_name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at DESC);

-- 3. Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies using existing organization_members
-- Policy 1: SELECT (All members of the organization can read clients)
DROP POLICY IF EXISTS "Members can view clients in their organization" ON public.clients;
CREATE POLICY "Members can view clients in their organization"
ON public.clients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = clients.organization_id
      AND organization_members.user_id = auth.uid()
  )
);

-- Policy 2: INSERT (Owner and Admin can insert clients)
DROP POLICY IF EXISTS "Owners and Admins can insert clients" ON public.clients;
CREATE POLICY "Owners and Admins can insert clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = clients.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
  )
);

-- Policy 3: UPDATE (Owner and Admin can update clients)
DROP POLICY IF EXISTS "Owners and Admins can update clients" ON public.clients;
CREATE POLICY "Owners and Admins can update clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = clients.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = clients.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
  )
);

-- Policy 4: DELETE (Owner and Admin can delete clients)
DROP POLICY IF EXISTS "Owners and Admins can delete clients" ON public.clients;
CREATE POLICY "Owners and Admins can delete clients"
ON public.clients
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = clients.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
  )
);

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
