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

-- تحديث ذاكرة PostgREST فوراً حتى لا تُرجع الواجهة خطأ PGRST204
NOTIFY pgrst, 'reload schema';
