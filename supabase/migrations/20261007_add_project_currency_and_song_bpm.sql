-- Project currency and song BPM
alter table public.projects
  add column if not exists currency text not null default 'INR';

alter table public.projects
  drop constraint if exists projects_currency_check;

alter table public.projects
  add constraint projects_currency_check
  check (currency in ('INR','USD','EUR','GBP','CAD','AUD'));

alter table public.project_songs
  add column if not exists bpm integer;

alter table public.project_songs
  drop constraint if exists project_songs_bpm_check;

alter table public.project_songs
  add constraint project_songs_bpm_check
  check (bpm is null or (bpm >= 1 and bpm <= 400));

comment on column public.projects.currency is 'Currency code used for this project financial amounts.';
comment on column public.project_songs.bpm is 'Optional song tempo in beats per minute.';
