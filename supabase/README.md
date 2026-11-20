# Al-Basar AI · Supabase schema

## ⚠️ اسم الجدول الصحيح

| | |
|---|---|
| ✅ اسم الجدول الفعلي | `public.student_screening_records` |
| ❌ اسم غير موجود | `public.screening_records` |

استخدام `public.screening_records` مع `ALTER TABLE IF EXISTS` **لا يُنتج خطأ** — بل
يتخطّى الجدول بصمت ويطبع `NOTICE: relation "screening_records" does not exist, skipping`
فتظن أن العمود أُضيف بينما لم يحدث شيء.

تحقّق دائماً من الجدول قبل التعديل:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name like '%screen%';
```

## الخيار ١ (موصى به): ملف schema.sql كامل

انسخ محتوى `schema.sql` كاملاً والصقه في **Supabase → SQL Editor → New Query** ثم اضغط **Run**.

الملف **Idempotent**: يمكن تشغيله مرات متعددة بأمان، ولا يحذف أي بيانات قائمة.
يشمل:
- إنشاء الجدول بأعمدة الـ 35+ متغيّراً (SPSS) + الأعمدة الداخلية.
- ترقية آمنة للجداول القديمة عبر `add column if not exists` لكل عمود.
- سياسات RLS للسماح بـ `anon` و `authenticated` على `SELECT` / `INSERT` / `UPDATE`.
- `GRANT` على مستوى الجدول (بدونه يُرجع الـ Data API خطأ "permission denied").
- `NOTIFY pgrst, 'reload schema';` في النهاية لتحديث ذاكرة PostgREST فوراً.

## الخيار ٢ (سريع): الأعمدة الثلاثة الناقصة فقط

نفّذ في SQL Editor:

```sql
alter table public.student_screening_records
  add column if not exists external_eye_findings jsonb default '[]'::jsonb,
  add column if not exists eye_photo_url text,
  add column if not exists owner_id uuid default auth.uid();

NOTIFY pgrst, 'reload schema';
```

الملف الجاهز لهذا الإجراء موجود في: `supabase/quick-migration.sql`

## التحقق بعد التنفيذ

```sql
-- يجب أن يعيد 3 صفوف
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'student_screening_records'
  and column_name in ('external_eye_findings', 'eye_photo_url', 'owner_id');
```

ثم من التطبيق: افتح نافذة السحابة ← `[🔍 فحص الاتصال الآن]` ← يجب أن يظهر
`✅ HTTP 200`. جرّب «المتابعة والمزامنة السريعة بكود الفاحص فقط» وتأكد من
اختفاء تنبيه تخطّي الحقول.

## ملاحظات

- `owner_id` يُملأ تلقائياً بـ `auth.uid()` عند الإدراج من حساب مسجّل الدخول.
  عند الإدراج بمفتاح `anon` يبقى `NULL` — وهذا مقصود لأن سياسات RLS مفتوحة
  أثناء مرحلة التجربة.
- لا يمكن تطبيق DDL من التطبيق: مفتاح `anon` لا يملك صلاحيات `ALTER TABLE`.
  التنفيذ اليدوي في SQL Editor هو الطريقة الوحيدة (أو مفتاح `service_role`).
