-- Step 16: project-scoped collaborator invite/session foundation
create table if not exists public.project_collaborator_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  invited_by uuid not null references auth.users(id) on delete restrict,
  name text,
  email text,
  role text not null default 'contributor' check (role in ('contributor','reviewer')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_collab_invites_project
  on public.project_collaborator_invites(project_id, created_at desc);
create index if not exists idx_project_collab_invites_active
  on public.project_collaborator_invites(project_id, expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.project_collaborator_invites enable row level security;

drop policy if exists "Members can view collaborator invites" on public.project_collaborator_invites;
create policy "Members can view collaborator invites"
on public.project_collaborator_invites for select to authenticated
using (private.is_org_member(organization_id, auth.uid()));

drop policy if exists "Authorized members can create collaborator invites" on public.project_collaborator_invites;
create policy "Authorized members can create collaborator invites"
on public.project_collaborator_invites for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','admin','engineer','producer'], auth.uid())
  and invited_by = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.organization_id = organization_id
  )
);

drop policy if exists "Authorized members can update collaborator invites" on public.project_collaborator_invites;
create policy "Authorized members can update collaborator invites"
on public.project_collaborator_invites for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','engineer','producer'], auth.uid()))
with check (private.has_org_role(organization_id, array['owner','admin','engineer','producer'], auth.uid()));

revoke all on public.project_collaborator_invites from anon;
grant select, insert, update on public.project_collaborator_invites to authenticated;
grant all on public.project_collaborator_invites to service_role;

create table if not exists public.project_collaborator_sessions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.project_collaborator_invites(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  role text not null check (role in ('contributor','reviewer')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_collab_sessions_project
  on public.project_collaborator_sessions(project_id);
create index if not exists idx_project_collab_sessions_active
  on public.project_collaborator_sessions(token_hash, expires_at)
  where revoked_at is null;

alter table public.project_collaborator_sessions enable row level security;
revoke all on public.project_collaborator_sessions from anon, authenticated;
grant all on public.project_collaborator_sessions to service_role;