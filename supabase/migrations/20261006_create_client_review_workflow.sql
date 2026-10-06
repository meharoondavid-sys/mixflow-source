-- Client review status workflow
-- Applied to production Supabase project as migration: add_client_review_status_workflow

create table if not exists public.project_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version_id uuid null references public.project_file_versions(id) on delete set null,
  from_status text null,
  to_status text not null,
  action text not null check (action in ('revision_requested','mix_approved','status_changed')),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('client','owner','admin','engineer','producer','assistant','finance','collaborator')),
  note text null,
  created_at timestamptz not null default now()
);

alter table public.project_status_history enable row level security;

create index if not exists idx_project_status_history_project_created
  on public.project_status_history(project_id, created_at desc);

alter table public.project_file_versions
  add column if not exists status text not null default 'ready';

alter table public.project_file_versions
  drop constraint if exists project_file_versions_status_check;

alter table public.project_file_versions
  add constraint project_file_versions_status_check
  check (status = any (array[
    'ready'::text,
    'in_review'::text,
    'revision_requested'::text,
    'approved'::text,
    'superseded'::text
  ]));

create or replace function public.client_review_action(
  p_project_id uuid,
  p_version_id uuid,
  p_action text,
  p_note text default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_version public.project_file_versions;
  v_client public.clients;
  v_from_status text;
  v_to_status text;
  v_version_status text;
  v_actor_role text := 'client';
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_action not in ('revision_requested', 'mix_approved') then
    raise exception 'Invalid review action';
  end if;

  select p.* into v_project
  from public.projects p
  join public.clients c on c.id = p.client_id
  where p.id = p_project_id
    and c.user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Project not found or client access denied';
  end if;

  select v.* into v_version
  from public.project_file_versions v
  where v.id = p_version_id
    and v.project_id = p_project_id
  for update;

  if not found then
    raise exception 'Version not found for this project';
  end if;

  select c.* into v_client
  from public.clients c
  where c.id = v_project.client_id
    and c.user_id = (select auth.uid());

  if not found then
    raise exception 'Client access denied';
  end if;

  if v_project.status <> 'in_review' then
    raise exception 'Project is not currently in review';
  end if;

  if p_action = 'revision_requested' then
    v_to_status := 'needs_revision';
    v_version_status := 'revision_requested';
  else
    if exists (
      select 1 from public.project_feedback f
      where f.project_id = p_project_id
        and f.version_id = p_version_id
        and f.status = 'open'
    ) then
      raise exception 'Resolve all open feedback before approving the mix';
    end if;
    v_to_status := 'approved';
    v_version_status := 'approved';
  end if;

  v_from_status := v_project.status;

  update public.project_file_versions
  set status = v_version_status
  where id = p_version_id;

  update public.projects
  set status = v_to_status, updated_at = now()
  where id = p_project_id
  returning * into v_project;

  insert into public.project_status_history (
    organization_id, project_id, version_id, from_status, to_status,
    action, actor_user_id, actor_role, note
  )
  values (
    v_project.organization_id, v_project.id, p_version_id, v_from_status,
    v_to_status, p_action, (select auth.uid()), v_actor_role,
    nullif(trim(p_note), '')
  );

  insert into public.project_notifications (
    organization_id, project_id, recipient_user_id, actor_user_id,
    type, title, message, link_url
  )
  select
    v_project.organization_id,
    v_project.id,
    om.user_id,
    (select auth.uid()),
    case when p_action = 'revision_requested'
      then 'revision_requested' else 'version_approved' end,
    case when p_action = 'revision_requested'
      then 'Revision requested' else 'Mix approved' end,
    case when p_action = 'revision_requested'
      then v_client.full_name || ' requested a revision.'
      else v_client.full_name || ' approved the mix.' end,
    '/projects/' || v_project.id::text || '/review'
  from public.organization_members om
  where om.organization_id = v_project.organization_id
    and om.user_id <> (select auth.uid());

  return v_project;
end;
$$;

revoke execute on function public.client_review_action(uuid, uuid, text, text) from public;
revoke execute on function public.client_review_action(uuid, uuid, text, text) from anon;
grant execute on function public.client_review_action(uuid, uuid, text, text) to authenticated;

create policy "Members can view project status history"
on public.project_status_history
for select to authenticated
using (private.is_org_member(organization_id, (select auth.uid())));

create policy "Clients can view their project status history"
on public.project_status_history
for select to authenticated
using (
  exists (
    select 1
    from public.projects p
    join public.clients c on c.id = p.client_id
    where p.id = project_status_history.project_id
      and c.user_id = (select auth.uid())
  )
);
