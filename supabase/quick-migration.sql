-- ============================================================
-- Al-Basar AI · الأعمدة الناقصة + حاوية صور العين (خاصة)
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
-- ✅ سياسات جدول السجلات الآن مقيّدة بـ owner_id = auth.uid():
--    كل فاحص يرى سجلاته فقط، والمشرف (app_metadata.role = 'admin') يرى الكل.
--    لا توجد سياسة DELETE إطلاقاً.
--
-- ✅ حاوية الصور private (public = false) — أخلاقيات البحث (IRB):
--    صور عيون الأطفال بيانات بيومترية حساسة؛ لا تُقرأ إلا عبر Signed URL
--    صالحة ساعة واحدة، ويصعدها الفاحص داخل مجلده {auth.uid()}/… فقط.
--
-- ✅ سياسة UPDATE تحتوي USING و WITH CHECK معاً (شرط PostgreSQL)،
--    فيُسمح بإعادة تصوير نفس التلميذ عبر upsert.
-- ============================================================

-- ---------- 1) دالة الصلاحية (تقرأ app_metadata حصراً) ----------
-- app_metadata محفوظ في auth.users.raw_app_meta_data ولا يعدّله المستخدم
-- (updateUser يعدّل user_metadata فقط). لذلك هي المصدر الوحيد الموثوق.
create or replace function public.is_albasar_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ---------- 2 + 3) الأعمدة الناقصة + RLS الصارم على جدول السجلات ----------
-- كل ما يخص جدول السجلات داخل كتلة DO واحدة: إن كان الجدول غير موجود
-- (مشروع جديد) تُتخطى هذه الخطوات برسالة واضحة بدل أن يفشل السكربت
-- بالكامل ويلغي إنشاء الحاوية والسياسات (SQL Editor يعمل داخل معاملة).
do $$
begin
  if to_regclass('public.student_screening_records') is null then
    raise notice 'الجدول public.student_screening_records غير موجود — تُتخطى خطوات الجدول. شغّل schema.sql أولاً (Bootstrap كامل).';
    return;
  end if;

  alter table public.student_screening_records
    add column if not exists external_eye_findings jsonb default '[]'::jsonb,
    add column if not exists eye_photo_url text,
    add column if not exists owner_id uuid default auth.uid(),
    add column if not exists examiner_full_name text,
    add column if not exists device_id text,
    add column if not exists examination_date timestamptz;

  alter table public.student_screening_records enable row level security;

  -- إسقاط أي سياسة مفتوحة سابقة (تمنع تسريب بيانات التلاميذ عبر anon).
  drop policy if exists "albasar open select" on public.student_screening_records;
  drop policy if exists "albasar open insert" on public.student_screening_records;
  drop policy if exists "albasar open update" on public.student_screening_records;
  drop policy if exists "allow_anon_all" on public.student_screening_records;
  drop policy if exists "albasar_select_own_or_admin" on public.student_screening_records;
  drop policy if exists "albasar_insert_own_or_admin" on public.student_screening_records;
  drop policy if exists "albasar_update_own_or_admin" on public.student_screening_records;

  -- الفاحص يرى/يضيف/يحدث سجلاته فقط، والمشرف يرى ويدير كل سجلات الطلبة.
  create policy "albasar_select_own_or_admin"
    on public.student_screening_records for select
    to authenticated
    using (owner_id = auth.uid() or public.is_albasar_admin());

  create policy "albasar_insert_own_or_admin"
    on public.student_screening_records for insert
    to authenticated
    with check (owner_id = auth.uid() or public.is_albasar_admin());

  create policy "albasar_update_own_or_admin"
    on public.student_screening_records for update
    to authenticated
    using (owner_id = auth.uid() or public.is_albasar_admin())
    with check (owner_id = auth.uid() or public.is_albasar_admin());

  -- 🔒 سحب صلاحيات anon من جدول السجلات (دفاع في العمق):
  --    RLS هي الحاجز الحقيقي (لا توجد أي سياسة لـ anon)، لكن سحب GRANT
  --    يجعل التبويق واضحاً: المفتاح المنشور لا يفتح جدول التلاميذ إطلاقاً.
  revoke select, insert, update, delete on public.student_screening_records from anon;
end $$;

-- لا توجد سياسة DELETE — وبما أن RLS denies افتراضياً، فالحذف ممنوع
-- حتى على مستوى الدور الإداري. حمايتان: RLS + غياب صلاحية DELETE.

-- ---------- 4) حاوية صور العين (خاصة تماماً) ----------
-- المسار المعتمد في imageCompress.ts هو: {authUserId}/{childId}/{timestamp}.jpg
insert into storage.buckets (id, name, public)
values ('screening-photos', 'screening-photos', false)
on conflict (id) do update set public = false;

-- ---------- 5) سياسات RLS على كائنات التخزين ----------
drop policy if exists "albasar photo open read" on storage.objects;
drop policy if exists "albasar photo open insert" on storage.objects;
drop policy if exists "albasar photo open update" on storage.objects;
drop policy if exists "albasar_photo_select_own_or_admin" on storage.objects;
drop policy if exists "albasar_photo_insert_own_or_admin" on storage.objects;
drop policy if exists "albasar_photo_update_own_or_admin" on storage.objects;

create policy "albasar_photo_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'screening-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_albasar_admin())
  );

create policy "albasar_photo_insert_own_or_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'screening-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_albasar_admin())
  );

create policy "albasar_photo_update_own_or_admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'screening-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_albasar_admin())
  )
  with check (
    bucket_id = 'screening-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_albasar_admin())
  );

-- ملاحظة: لا توجد سياسة DELETE على storage.objects إطلاقاً.

-- ---------- 6) صلاحيات جدول storage (اختيارية + لا تُفشل السكريبت) ----------
-- Supabase منح anon/authenticated صلاحيات SELECT/INSERT/UPDATE/DELETE أصلاً
-- (migration 0046). هذا المقطع يضمن الـ SELECT/INSERT/UPDATE فقط إن اختلفت
-- إعدادات المشروع، ولا يقوّي DELETE أبداً. أي فشل هنا لا يوقف التنفيذ.
-- ⚠️ ملاحظة أمنية: منح جدول storage لـ anon يبقى غير ضروري بعد تطبيق
--    السياسات أعلاه، لأن RLS يمنع anon من المرور بها (لا توجد سياسات لـ anon).
do $$
begin
  grant select, insert, update on storage.objects to anon, authenticated;
exception
  when insufficient_privilege then
    raise notice 'تعذّر منح صلاحيات storage.objects (غير مالك للجدول) — سياسات RLS أعلاه تكفي.';
end $$;

-- ---------- 7) تحديث ذاكرة PostgREST فوراً حتى لا تُرجع الواجهة خطأ PGRST204 ----------
NOTIFY pgrst, 'reload schema';
