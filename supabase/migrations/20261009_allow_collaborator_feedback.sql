-- Step 16: allow project collaborators to author timestamped feedback
alter table public.project_feedback
  drop constraint if exists project_feedback_author_role_check;

alter table public.project_feedback
  add constraint project_feedback_author_role_check
  check (author_role = any (array[
    'client',
    'engineer',
    'producer',
    'owner',
    'admin',
    'collaborator'
  ]));