-- =========================================================
-- Al-Basar AI v3 · Supabase schema (SPSS 35+ variable mirror)
-- Run inside Supabase → SQL Editor.
-- Local storage remains the primary source during offline screening.
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
  examination_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_ssr_school_name on public.student_screening_records (school_name);
create index if not exists idx_ssr_examination_date on public.student_screening_records (examination_date desc);
create index if not exists idx_ssr_examiner on public.student_screening_records (examiner_id);

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

-- Row Level Security.
-- Pilot deployment: the PWA uses the public anon key, so allow anonymous
-- insert/update/select for this table only. For a production multi-tenant
-- deployment, replace these policies with authenticated examiner policies.
alter table public.student_screening_records enable row level security;

drop policy if exists "albasar anon insert" on public.student_screening_records;
create policy "albasar anon insert"
  on public.student_screening_records
  for insert
  to anon
  with check (true);

drop policy if exists "albasar anon update" on public.student_screening_records;
create policy "albasar anon update"
  on public.student_screening_records
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "albasar anon select" on public.student_screening_records;
create policy "albasar anon select"
  on public.student_screening_records
  for select
  to anon
  using (true);

-- Table privileges are separate from RLS policies. Without these GRANTs the
-- Data API returns "permission denied for table" even when policies exist.
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.student_screening_records to anon, authenticated;
