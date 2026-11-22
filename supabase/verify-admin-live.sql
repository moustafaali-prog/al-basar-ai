-- Al-Basar AI — live supervisor/sync verification
-- Run in Supabase SQL Editor (project trtdzybvatxvdqmklmwx).
-- Read-only checks first.

-- 1) Is the supervisor role stored in app_metadata (trusted) and not user_metadata?
select
  id,
  email,
  raw_app_meta_data ->> 'role' as app_role,
  raw_user_meta_data ->> 'role' as user_role
from auth.users
order by created_at;

-- 2) Did examiner records actually reach the cloud?
select count(*) as total_records
from public.student_screening_records;

select
  owner_id,
  count(*) as records,
  min(created_at) as first_record,
  max(created_at) as last_record
from public.student_screening_records
group by owner_id
order by last_record desc;

-- 3) Which owners are behind the rows?
select child_id, owner_id, examiner_id, school_name, examination_date
from public.student_screening_records
order by examination_date desc
limit 20;

-- 4) Are the owner/admin RLS policies and grants present?
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'student_screening_records'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'student_screening_records'
order by grantee, privilege_type;

-- 5) Fix the supervisor role if app_role is not admin.
-- This writes the server-trusted field that public.is_albasar_admin() reads.
-- Replace the email if needed.
update auth.users
set raw_app_meta_data =
  jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'::jsonb,
    true
  )
where lower(email) = lower('greenlanterxx@gmail.com');

select id, email, raw_app_meta_data ->> 'role' as app_role
from auth.users
where lower(email) = lower('greenlanterxx@gmail.com');

-- 6) Re-apply the RLS, grants and private photo policies if they are missing.
-- Run supabase/schema.sql in the SQL Editor after the checks above.
