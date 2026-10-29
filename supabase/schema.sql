-- Run once in the Supabase SQL Editor before using the app.
create extension if not exists pgcrypto;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 10000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  context_problem text not null default '',
  my_action text not null default '',
  result_impact text not null default '',
  competencies text not null default '',
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (user_id, id)
);

create table if not exists public.achievement_evidence (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  achievement_id uuid not null,
  entry_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (achievement_id, entry_id),
  foreign key (user_id, achievement_id) references public.achievements(user_id, id) on delete cascade,
  foreign key (user_id, entry_id) references public.journal_entries(user_id, id) on delete cascade
);

create table if not exists public.achievement_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  context_problem text not null,
  my_action text not null,
  result_impact text not null,
  competencies text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'discarded')),
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (user_id, id)
);

alter table public.achievements add column if not exists source text not null default 'manual' check (source in ('manual', 'ai'));

create table if not exists public.suggestion_evidence (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  suggestion_id uuid not null,
  entry_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, entry_id),
  foreign key (user_id, suggestion_id) references public.achievement_suggestions(user_id, id) on delete cascade,
  foreign key (user_id, entry_id) references public.journal_entries(user_id, id) on delete cascade
);

create index if not exists journal_entries_user_occurred_idx on public.journal_entries(user_id, occurred_at desc);
create index if not exists achievements_user_period_idx on public.achievements(user_id, period_end desc);
create index if not exists achievement_evidence_entry_idx on public.achievement_evidence(user_id, entry_id);
create index if not exists achievement_suggestions_user_status_idx on public.achievement_suggestions(user_id, status, created_at desc);
create index if not exists suggestion_evidence_entry_idx on public.suggestion_evidence(user_id, entry_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists journal_entries_set_updated_at on public.journal_entries;
create trigger journal_entries_set_updated_at before update on public.journal_entries
for each row execute function public.set_updated_at();

drop trigger if exists achievements_set_updated_at on public.achievements;
create trigger achievements_set_updated_at before update on public.achievements
for each row execute function public.set_updated_at();

alter table public.journal_entries enable row level security;
alter table public.achievements enable row level security;
alter table public.achievement_evidence enable row level security;
alter table public.achievement_suggestions enable row level security;
alter table public.suggestion_evidence enable row level security;

drop policy if exists "Users manage their journal entries" on public.journal_entries;
create policy "Users manage their journal entries" on public.journal_entries
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their achievements" on public.achievements;
create policy "Users manage their achievements" on public.achievements
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their achievement evidence" on public.achievement_evidence;
create policy "Users manage their achievement evidence" on public.achievement_evidence
for all to authenticated using (
  (select auth.uid()) = user_id
  and exists (select 1 from public.achievements a where a.id = achievement_id and a.user_id = (select auth.uid()))
  and exists (select 1 from public.journal_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.achievements a where a.id = achievement_id and a.user_id = (select auth.uid()))
  and exists (select 1 from public.journal_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
);

drop policy if exists "Users manage their achievement suggestions" on public.achievement_suggestions;
create policy "Users manage their achievement suggestions" on public.achievement_suggestions
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their suggestion evidence" on public.suggestion_evidence;
create policy "Users manage their suggestion evidence" on public.suggestion_evidence
for all to authenticated using (
  (select auth.uid()) = user_id
  and exists (select 1 from public.achievement_suggestions s where s.id = suggestion_id and s.user_id = (select auth.uid()))
  and exists (select 1 from public.journal_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.achievement_suggestions s where s.id = suggestion_id and s.user_id = (select auth.uid()))
  and exists (select 1 from public.journal_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
);

grant select, insert, update, delete on public.journal_entries to authenticated;
grant select, insert, update, delete on public.achievements to authenticated;
grant select, insert, update, delete on public.achievement_evidence to authenticated;
grant select, insert, update, delete on public.achievement_suggestions to authenticated;
grant select, insert, update, delete on public.suggestion_evidence to authenticated;
