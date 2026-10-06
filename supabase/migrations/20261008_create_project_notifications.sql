-- MixFlow: Migration for public.project_notifications
-- Step 15: Notifications Foundation

-- 1. Create table public.project_notifications
CREATE TABLE IF NOT EXISTS public.project_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN (
    'feedback_added',
    'feedback_resolved',
    'revision_requested',
    'version_uploaded',
    'version_approved',
    'payment_recorded',
    'payment_status_changed',
    'delivery_released',
    'delivery_downloaded',
    'project_created',
    'project_status_changed',
    'project_assigned',
    'collaborator_invited'
  )),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  message text NOT NULL CHECK (length(trim(message)) > 0),
  link_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Performance and Query Indexes
CREATE INDEX IF NOT EXISTS idx_project_notifications_recipient_unread
  ON public.project_notifications(recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_notifications_recipient_all
  ON public.project_notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_notifications_org_id
  ON public.project_notifications(organization_id);

CREATE INDEX IF NOT EXISTS idx_project_notifications_project_id
  ON public.project_notifications(project_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.project_notifications ENABLE ROW LEVEL SECURITY;

-- 4. Permissions and Grants
REVOKE ALL ON public.project_notifications FROM anon;
GRANT SELECT, UPDATE ON public.project_notifications TO authenticated;
GRANT ALL ON public.project_notifications TO service_role;

-- 5. Strict Recipient Isolation Policies
-- Policy 1: SELECT - Authenticated users can only read their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.project_notifications;
CREATE POLICY "Users can view their own notifications"
ON public.project_notifications
FOR SELECT
TO authenticated
USING (
  recipient_user_id = auth.uid()
);

-- Policy 2: UPDATE - Authenticated recipients can update read_at on their own notifications
DROP POLICY IF EXISTS "Users can update their own notifications read status" ON public.project_notifications;
CREATE POLICY "Users can update their own notifications read status"
ON public.project_notifications
FOR UPDATE
TO authenticated
USING (
  recipient_user_id = auth.uid()
)
WITH CHECK (
  recipient_user_id = auth.uid()
);

-- Note: NO INSERT policy for authenticated role. Notifications are issued strictly by trusted server-side handlers.
-- Note: NO DELETE policy for authenticated role. Notifications are immutable archival activity records.
