-- ============================================================
-- Al-Basar AI · الأعمدة الناقصة فقط (بدون المساس بالبيانات الحالية)
-- ⚠️ اسم الجدول الصحيح هو public.student_screening_records
--    (وليس public.screening_records — وهو غير موجود وسيُتخطى بصمت)
-- ============================================================

alter table public.student_screening_records
  add column if not exists external_eye_findings jsonb default '[]'::jsonb,
  add column if not exists eye_photo_url text,
  add column if not exists owner_id uuid default auth.uid(),
  add column if not exists examiner_full_name text,
  add column if not exists device_id text;

-- ============================================================
-- حاوية صور العين (تُنشأ تلقائياً إن لم تكن موجودة)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('screening-photos', 'screening-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "albasar photo open read" on storage.objects;
create policy "albasar photo open read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'screening-photos');

drop policy if exists "albasar photo open insert" on storage.objects;
create policy "albasar photo open insert"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'screening-photos');

drop policy if exists "albasar photo open update" on storage.objects;
create policy "albasar photo open update"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'screening-photos')
  with check (bucket_id = 'screening-photos');

grant all on storage.objects to anon, authenticated;

-- تحديث ذاكرة PostgREST فوراً حتى لا تُرجع الواجهة خطأ PGRST204
NOTIFY pgrst, 'reload schema';
