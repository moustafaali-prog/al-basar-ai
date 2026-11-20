-- ============================================================
-- Al-Basar AI · الأعمدة الناقصة + حاوية صور العين
-- (بدون المساس بالبيانات الحالية — آمن للتشغيل المتكرر)
--
-- ⚠️ اسم الجدول الصحيح هو public.student_screening_records
--    (وليس public.screening_records — وهو غير موجود وسيُتخطى بصمت)
--
-- ✅ لا يحتوي هذا الملف على "grant all on storage.objects to anon, authenticated":
--    - على Supabase Cloud، storage.objects مملوك لحساب postgres (storage.super_user)
--      وقد منحه Supabase أصلاً كل الصلاحيات لـ anon/authenticated
--      (migration 0046)؛ فالسطر كان تكراراً بلا فائدة.
--    - grant all يمنح DELETE غير مبرّر، ويجعل السكريبت يفشل بـ 42501
--      "must be owner of table objects" في أي مشروع غيّر فيه storage.super_user.
--    - الوصول للصور يُدار بالكامل عبر سياسات RLS أدناه.
--
-- ✅ سياسة UPDATE تحتوي USING و WITH CHECK معاً (شرط PostgreSQL)،
--    فيُسمح بإعادة تصوير نفس التلميذ عبر upsert.
-- ============================================================

-- ---------- 1) الأعمدة الناقصة ----------
alter table public.student_screening_records
  add column if not exists external_eye_findings jsonb default '[]'::jsonb,
  add column if not exists eye_photo_url text,
  add column if not exists owner_id uuid default auth.uid(),
  add column if not exists examiner_full_name text,
  add column if not exists device_id text;

-- ---------- 2) حاوية صور العين ----------
-- public = true مطلوب: التطبيق يبني رابط الصورة مباشرة عبر getPublicUrl()
-- دون توقيع روابط برمجياً. الصور مُرمّزة بـ Child_ID فقط ولا تحوي أسماء التلاميذ.
-- 📋 أخلاقيات البحث (IRB): فور انتهاء جمع البيانات اجعل الحاوية
--    private (public = false) واحصر القراءة بحساب المشرف فقط.
insert into storage.buckets (id, name, public)
values ('screening-photos', 'screening-photos', true)
on conflict (id) do update set public = excluded.public;

-- ---------- 3) سياسات RLS ----------
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

-- ملاحظة: لا توجد سياسة DELETE — وبما أن RLS denies افتراضياً،
-- فالحذف ممنوع عن anon/authenticated حتى لو منحهم Supabase صلاحية
-- الجدول على مستوى المنصة.

-- ---------- 4) صلاحيات جدول storage (اختيارية + لا تُفشل السكريبت) ----------
-- Supabase منح anon/authenticated صلاحيات SELECT/INSERT/UPDATE/DELETE أصلاً
-- (migration 0046). هذا المقطع يضمن الـ SELECT/INSERT/UPDATE فقط إن اختلفت
-- إعدادات المشروع، ولا يقوّي DELETE أبداً. أي فشل هنا لا يوقف التنفيذ.
do $$
begin
  grant select, insert, update on storage.objects to anon, authenticated;
exception
  when insufficient_privilege then
    raise notice 'تعذّر منح صلاحيات storage.objects (غير مالك للجدول) — سياسات RLS أعلاه تكفي.';
end $$;

-- ---------- 5) تحديث ذاكرة PostgREST فوراً حتى لا تُرجع الواجهة خطأ PGRST204 ----------
NOTIFY pgrst, 'reload schema';
