-- Step 16: harden the existing project collaborator invite foundation.
-- Live reconciliation created this table earlier; this migration records the
-- production-safe policy correction and keeps invite records non-deletable.

drop policy if exists "Authorized members can create collaborator invites" on public.project_collaborator_invites;

create policy "Authorized members can create collaborator invites"
on public.project_collaborator_invites for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','admin','engineer','producer'], auth.uid())
  and invited_by = auth.uid()
  and exists (
    select 1
    from public.projects p
    where p.id = project_collaborator_invites.project_id
      and p.organization_id = project_collaborator_invites.organization_id
  )
);

revoke delete on public.project_collaborator_invites from authenticated;
