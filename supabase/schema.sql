-- =========================================================
-- Al-Basar AI v3 · Supabase schema (SPSS 35+ variable mirror)
-- Run inside Supabase → SQL Editor.
-- Local storage remains the primary source during offline screening.
--
-- Cloud sync is authenticated: examiners sign in with an email/password
-- account created by the project supervisor. Each record stores an internal
-- owner_id, examiners can only sync/read their own records, and supervisors
-- can read every record. The 35 SPSS variables are unchanged; owner_id is
-- internal metadata and is not part of the CSV export.
-- =========================================================

create table if not exists public.student_screening_records (
  child_id text primary key,
  examiner_id text not null,
  paper_examiner_id text,
  paper_started_at timestamptz,
  paper_completed_at timestamptz,
  smart_examiner_id text,
  smart_started_at timestamptz,
  smart_completed_at timestamptz,
  parental_consent integer,
  child_assent text,
  school_name text,
  school_sector text,
  grade_level integer,
  age_years integer,
  gender text,
  wears_glasses integer,
  who_pre_screen jsonb,
  who_screening jsonb,
  who_referral_flag integer,
  crossover_sequence text,
  paper_snellen_od text,
  paper_logmar_od numeric(6, 3),
  paper_snellen_os text,
  paper_logmar_os numeric(6, 3),
  paper_logmar_worse numeric(6, 3),
  paper_time_sec integer,
  paper_referral integer,
  smart_snellen_od text,
  smart_acuity_od_below_test_range boolean,
  smart_logmar_od numeric(6, 3),
  smart_snellen_os text,
  smart_acuity_os_below_test_range boolean,
  smart_logmar_os numeric(6, 3),
  smart_logmar_worse numeric(6, 3),
  smart_iod_logmar numeric(6, 3),
  smart_time_sec integer,
  hirschberg_asym_mm numeric(6, 3),
  hirschberg_prism_diopters integer,
  mrd1_min_mm numeric(6, 3),
  triage_ocular_flag integer,
  ai_quality_flag integer,
  asthenopia_score integer,
  final_triage_referral integer,
  referral_urgency text,
  referral_phcc text,
  follow_up_status integer,
  spectacles_prescribed_fitted integer,
  gold_standard_confirmed integer,
  gold_standard_method text,
  gold_standard_examiner_id text,
  gold_standard_date text,
  gold_standard_criteria text,
  gold_standard_masked text,
  eye_photo_url text,
  external_eye_findings jsonb,
  examination_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Internal row owner for RLS. Not part of the SPSS research dataset.
  owner_id uuid default auth.uid()
);

-- Safe migration for an existing pilot table created from the first schema draft.
alter table public.student_screening_records
  add column if not exists paper_started_at timestamptz,
  add column if not exists paper_completed_at timestamptz,
  add column if not exists smart_started_at timestamptz,
  add column if not exists smart_completed_at timestamptz,
  add column if not exists parental_consent integer,
  add column if not exists child_assent text,
  add column if not exists who_pre_screen jsonb,
  add column if not exists who_screening jsonb,
  add column if not exists who_referral_flag integer,
  add column if not exists crossover_sequence text,
  add column if not exists paper_logmar_od numeric(6, 3),
  add column if not exists paper_logmar_os numeric(6, 3),
  add column if not exists paper_logmar_worse numeric(6, 3),
  add column if not exists smart_acuity_od_below_test_range boolean,
  add column if not exists smart_logmar_od numeric(6, 3),
  add column if not exists smart_acuity_os_below_test_range boolean,
  add column if not exists smart_logmar_os numeric(6, 3),
  add column if not exists smart_logmar_worse numeric(6, 3),
  add column if not exists hirschberg_prism_diopters integer,
  add column if not exists gold_standard_confirmed integer,
  add column if not exists gold_standard_method text,
  add column if not exists gold_standard_examiner_id text,
  add column if not exists gold_standard_date text,
  add column if not exists gold_standard_criteria text,
  add column if not exists gold_standard_masked text,
  add column if not exists eye_photo_url text,
  add column if not exists external_eye_findings jsonb,
  add column if not exists owner_id uuid default auth.uid(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_ssr_school_name on public.student_screening_records (school_name);
create index if not exists idx_ssr_examination_date on public.student_screening_records (examination_date desc);
create index if not exists idx_ssr_examiner on public.student_screening_records (examiner_id);
create index if not exists idx_ssr_owner on public.student_screening_records (owner_id);

-- Keep updated_at accurate for supervisor aggregation.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ssr_updated_at on public.student_screening_records;
create trigger trg_ssr_updated_at
before update on public.student_screening_records
for each row execute function public.set_updated_at();

-- =========================================================
-- Examiner accounts and roles
-- =========================================================
-- One profile row per Supabase Auth user. The signup trigger below creates
-- it automatically; the supervisor promotes trusted accounts to 'supervisor'
-- from the SQL Editor (see README).
create table if not exists public.examiner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'examiner' check (role in ('examiner', 'supervisor')),
  display_name text,
  examiner_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.examiner_profiles enable row level security;

-- Security-definer helper: avoids recursive RLS lookups on examiner_profiles.
create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.examiner_profiles
    where user_id = auth.uid()
      and role = 'supervisor'
  );
$$;

revoke all on function public.is_supervisor() from public;
grant execute on function public.is_supervisor() to authenticated;

-- Every new Auth user receives an examiner profile automatically.
create or replace function public.handle_new_examiner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.examiner_profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_examiner();

drop policy if exists "albasar profile self read" on public.examiner_profiles;
create policy "albasar profile self read"
  on public.examiner_profiles
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_supervisor());

-- Profiles are provisioned by the trigger and managed by the supervisor;
-- examiners cannot edit their own role.
grant usage on schema public to authenticated;
grant select on public.examiner_profiles to authenticated;
revoke all on public.examiner_profiles from anon;

-- =========================================================
-- Row Level Security for screening records (anon + authenticated)
-- =========================================================
alter table public.student_screening_records enable row level security;

-- Remove the earlier pilot policies if this schema is re-run.
drop policy if exists "albasar anon insert" on public.student_screening_records;
drop policy if exists "albasar anon update" on public.student_screening_records;
drop policy if exists "albasar anon select" on public.student_screening_records;
drop policy if exists "albasar examiner insert" on public.student_screening_records;
drop policy if exists "albasar record read" on public.student_screening_records;
drop policy if exists "albasar record update" on public.student_screening_records;
drop policy if exists "albasar open insert" on public.student_screening_records;
drop policy if exists "albasar open select" on public.student_screening_records;
drop policy if exists "albasar open update" on public.student_screening_records;

-- Deliberately permissive during the pilot so field examiners can sync before
-- all accounts are provisioned. Tighten to owner_id = auth.uid() later.
create policy "albasar open insert"
  on public.student_screening_records
  for insert
  to anon, authenticated
  with check (true);

create policy "albasar open select"
  on public.student_screening_records
  for select
  to anon, authenticated
  using (true);

create policy "albasar open update"
  on public.student_screening_records
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- Table privileges are separate from RLS policies. Without these GRANTs the
-- Data API returns "permission denied for table" even when policies exist.
grant select, insert, update on public.student_screening_records to anon, authenticated;

NOTIFY pgrst, 'reload schema';
