-- =========================================================
-- Al-Basar AI v3 · Supabase schema (SPSS 35+ variable mirror)
-- Idempotent: safe to re-run inside Supabase → SQL Editor.
-- Local storage remains the primary source during offline screening.
--
-- Field sync requires a real, signed-in Supabase session.
-- The `anon` role is no longer granted any privilege on the records table:
-- RLS scopes every row to `owner_id = auth.uid()` (or a supervisor whose
-- JWT carries `app_metadata.role = 'admin'`). A publishable key can never
-- pull the children's dataset. Offline work stays in the device's local
-- store until the examiner signs in.
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
  examiner_full_name text,
  device_id text,
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
  external_eye_findings jsonb default '[]'::jsonb,
  examination_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Internal row owner for optional supervisor RLS. Not part of the SPSS export.
  owner_id uuid default auth.uid()
);

-- Safe migration for older pilot tables: add every column if missing.
alter table public.student_screening_records
  add column if not exists paper_examiner_id text,
  add column if not exists paper_started_at timestamptz,
  add column if not exists paper_completed_at timestamptz,
  add column if not exists smart_examiner_id text,
  add column if not exists smart_started_at timestamptz,
  add column if not exists smart_completed_at timestamptz,
  add column if not exists parental_consent integer,
  add column if not exists child_assent text,
  add column if not exists school_name text,
  add column if not exists school_sector text,
  add column if not exists examiner_full_name text,
  add column if not exists device_id text,
  add column if not exists grade_level integer,
  add column if not exists age_years integer,
  add column if not exists gender text,
  add column if not exists wears_glasses integer,
  add column if not exists who_pre_screen jsonb,
  add column if not exists who_screening jsonb,
  add column if not exists external_eye_findings jsonb default '[]'::jsonb,
  add column if not exists who_referral_flag integer,
  add column if not exists crossover_sequence text,
  add column if not exists paper_snellen_od text,
  add column if not exists paper_logmar_od numeric(6, 3),
  add column if not exists paper_snellen_os text,
  add column if not exists paper_logmar_os numeric(6, 3),
  add column if not exists paper_logmar_worse numeric(6, 3),
  add column if not exists paper_time_sec integer,
  add column if not exists paper_referral integer,
  add column if not exists smart_snellen_od text,
  add column if not exists smart_acuity_od_below_test_range boolean,
  add column if not exists smart_logmar_od numeric(6, 3),
  add column if not exists smart_snellen_os text,
  add column if not exists smart_acuity_os_below_test_range boolean,
  add column if not exists smart_logmar_os numeric(6, 3),
  add column if not exists smart_logmar_worse numeric(6, 3),
  add column if not exists smart_iod_logmar numeric(6, 3),
  add column if not exists smart_time_sec integer,
  add column if not exists hirschberg_asym_mm numeric(6, 3),
  add column if not exists hirschberg_prism_diopters integer,
  add column if not exists mrd1_min_mm numeric(6, 3),
  add column if not exists triage_ocular_flag integer,
  add column if not exists ai_quality_flag integer,
  add column if not exists asthenopia_score integer,
  add column if not exists final_triage_referral integer,
  add column if not exists referral_urgency text,
  add column if not exists referral_phcc text,
  add column if not exists follow_up_status integer,
  add column if not exists spectacles_prescribed_fitted integer,
  add column if not exists gold_standard_confirmed integer,
  add column if not exists gold_standard_method text,
  add column if not exists gold_standard_examiner_id text,
  add column if not exists gold_standard_date text,
  add column if not exists gold_standard_criteria text,
  add column if not exists gold_standard_masked text,
  add column if not exists eye_photo_url text,
  add column if not exists examination_date timestamptz,
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
-- Examiner accounts and roles (optional authenticated features)
-- =========================================================
create table if not exists public.examiner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'examiner' check (role in ('examiner', 'supervisor', 'admin')),
  display_name text,
  examiner_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.examiner_profiles enable row level security;

-- Security-definer helper: avoids recursive RLS lookups on examiner_profiles.
-- The role is accepted from EITHER source:
--   * `app_metadata.role` in the JWT  — the authoritative, server-only source.
--   * the mirrored `examiner_profiles.role` row — kept in sync by the trigger
--     below so the table stays useful for reporting.
create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or exists (
      select 1
      from public.examiner_profiles
      where user_id = auth.uid()
        and role in ('supervisor', 'admin')
    );
$$;

revoke all on function public.is_supervisor() from public;
grant execute on function public.is_supervisor() to authenticated;

-- Every new Auth user receives an examiner profile automatically.
-- The role is copied from `raw_app_meta_data`, which the user cannot modify.
create or replace function public.handle_new_examiner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.examiner_profiles (user_id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'examiner' end
  )
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

grant usage on schema public to authenticated;
grant usage on schema public to anon;
grant select on public.examiner_profiles to authenticated;
revoke all on public.examiner_profiles from anon;

-- =========================================================
-- Server-trusted RBAC helper
-- =========================================================
-- app_metadata lives in auth.users.raw_app_meta_data and is writable ONLY by
-- the Supabase dashboard / a service_role key. `user_metadata` is writable by
-- the user through auth.updateUser(), so it is never consulted for a role.
create or replace function public.is_albasar_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- =========================================================
-- Row Level Security for screening records (owner-scoped)
-- =========================================================
alter table public.student_screening_records enable row level security;

-- Remove every earlier pilot policy if this schema is re-run.
drop policy if exists "albasar anon insert" on public.student_screening_records;
drop policy if exists "albasar anon update" on public.student_screening_records;
drop policy if exists "albasar anon select" on public.student_screening_records;
drop policy if exists "albasar examiner insert" on public.student_screening_records;
drop policy if exists "albasar record read" on public.student_screening_records;
drop policy if exists "albasar record update" on public.student_screening_records;
drop policy if exists "albasar open insert" on public.student_screening_records;
drop policy if exists "albasar open select" on public.student_screening_records;
drop policy if exists "albasar open update" on public.student_screening_records;
drop policy if exists "allow_anon_all" on public.student_screening_records;
drop policy if exists "albasar_select_own_or_admin" on public.student_screening_records;
drop policy if exists "albasar_insert_own_or_admin" on public.student_screening_records;
drop policy if exists "albasar_update_own_or_admin" on public.student_screening_records;

-- An examiner reads/writes ONLY the rows they own (`owner_id = auth.uid()`).
-- A supervisor (app_metadata.role = 'admin') reads and manages every row.
-- There is no `anon` policy at all: an unauthenticated client is rejected by
-- the database, so the publishable key can never pull the children's dataset.
create policy "albasar_select_own_or_admin"
  on public.student_screening_records
  for select
  to authenticated
  using (owner_id = auth.uid() or public.is_albasar_admin());

create policy "albasar_insert_own_or_admin"
  on public.student_screening_records
  for insert
  to authenticated
  with check (owner_id = auth.uid() or public.is_albasar_admin());

create policy "albasar_update_own_or_admin"
  on public.student_screening_records
  for update
  to authenticated
  using (owner_id = auth.uid() or public.is_albasar_admin())
  with check (owner_id = auth.uid() or public.is_albasar_admin());

-- There is intentionally NO delete policy: RLS denies by default, so a
-- synced research record can never be removed — not even by a supervisor.
-- ALCOA+ / SPIRIT-AI audit trail is preserved.

-- Table privileges are separate from RLS policies. Without these GRANTs the
-- Data API returns "permission denied for table" even when policies exist.
-- Only `authenticated` is granted here; `anon` is intentionally left out.
grant select, insert, update on public.student_screening_records to authenticated;
revoke select, insert, update, delete on public.student_screening_records from anon;

-- =========================================================
-- Ocular photo storage (PRIVATE bucket — IRB compliant)
-- =========================================================
-- The examiner app compresses each ocular photo to 1024 px / q0.85 and stores
-- it offline in IndexedDB. During cloud sync the blob is uploaded under the
-- folder `{authUserId}/{childId}/{timestamp}.jpg`, and only that OBJECT PATH
-- is written to `eye_photo_url`. The app resolves the path into a signed URL
-- (1 hour) on demand through `createSignedUrl()`.
insert into storage.buckets (id, name, public)
values ('screening-photos', 'screening-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "albasar photo open read" on storage.objects;
drop policy if exists "albasar photo open insert" on storage.objects;
drop policy if exists "albasar photo open update" on storage.objects;
drop policy if exists "albasar_photo_select_own_or_admin" on storage.objects;
drop policy if exists "albasar_photo_insert_own_or_admin" on storage.objects;
drop policy if exists "albasar_photo_update_own_or_admin" on storage.objects;

create policy "albasar_photo_select_own_or_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'screening-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_albasar_admin())
  );

create policy "albasar_photo_insert_own_or_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'screening-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_albasar_admin())
  );

create policy "albasar_photo_update_own_or_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'screening-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_albasar_admin())
  )
  with check (
    bucket_id = 'screening-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_albasar_admin())
  );

-- ⚠️ لا تُنفّذ "grant all on storage.objects to anon, authenticated" هنا:
--    - على Supabase Cloud، storage.objects مملوك لحساب postgres (storage.super_user)
--      وقد منحه Supabase أصلاً كل الصلاحيات لـ anon/authenticated
--      (migration 0046)؛ فالسطر كان تكراراً بلا فائدة.
--    - grant all يمنح DELETE غير مبرّر، ويجعل السكريبت يفشل بـ 42501
--      "must be owner of table objects" في أي مشروع غيّر فيه storage.super_user.
--
-- 📋 أخلاقيات البحث (IRB): الحاوية خاصة (public = false). صور عيون الأطفال
--    بيانات بيومترية حساسة؛ لا تُقرأ إلا برابط موقّع صالح ساعة واحدة، ولا
--    يرفعها الفاحص إلا داخل مجلده {auth.uid()}/…، ولا يطّلع عليها المشرف
--    إلا عبر نفس الواجهة.

-- لا توجد سياسة DELETE على storage.objects إطلاقاً.

-- صلاحيات جدول storage (اختيارية + لا تُفشل السكريبت): Supabase منح
-- anon/authenticated صلاحيات SELECT/INSERT/UPDATE/DELETE أصلاً (migration 0046).
-- هذا المقطع يضمن الـ SELECT/INSERT/UPDATE فقط إن اختلفت إعدادات المشروع،
-- ولا يقوّي DELETE أبداً. حماية القراءة الفعلية تأتي من سياسات RLS أعلاه
-- (لا توجد سياسة لـ anon).
do $$
begin
  grant select, insert, update on storage.objects to anon, authenticated;
exception
  when insufficient_privilege then
    raise notice 'تعذّر منح صلاحيات storage.objects (غير مالك للجدول) — سياسات RLS أعلاه تكفي.';
end $$;

NOTIFY pgrst, 'reload schema';
