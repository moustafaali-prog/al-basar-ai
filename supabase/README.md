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

---

## الخيار ١ (موصى به): ملف schema.sql كامل

انسخ محتوى `schema.sql` كاملاً والصقه في **Supabase → SQL Editor → New Query** ثم اضغط **Run**.

الملف **Idempotent**: يمكن تشغيله مرات متعددة بأمان، ولا يحذف أي بيانات قائمة.
يشمل:
- إنشاء الجدول بأعمدة الـ 35+ متغيّراً (SPSS) + الأعمدة الداخلية (61 عموداً).
- ترقية آمنة للجداول القديمة عبر `add column if not exists` لكل عمود.
- سياسات RLS للسماح بـ `anon` و `authenticated` على `SELECT` / `INSERT` / `UPDATE`.
- `GRANT` على مستوى الجدول (بدونه يُرجع الـ Data API خطأ "permission denied").
- حاوية `screening-photos` + 3 سياسات تخزين.
- `NOTIFY pgrst, 'reload schema';` في النهاية لتحديث ذاكرة PostgREST فوراً.

---

## الخيار ٢ (سريع): الأعمدة الناقصة + حاوية الصور

نفّذ في SQL Editor محتوى **`supabase/quick-migration.sql`** كاملاً (5 أعمدة + الحاوية + السياسات).

### ⚠️ لماذا لا يوجد `grant all on storage.objects to anon, authenticated`؟

هذا السطر **محذوف عمداً** من الملفين:

1. **تكرار بلا فائدة** — على Supabase Cloud، `storage.objects` مملوك لحساب `postgres`
   (المتغيّر `storage.super_user`)، وقد منحه Supabase أصلاً كل الصلاحيات لـ
   `anon` و `authenticated` في migration `0046`:
   ```sql
   grant all on storage.buckets, storage.objects
     to service_role, authenticated_role, anon_role;
   ```
   ثم سُحبت منه `TRUNCATE/REFERENCES/TRIGGER/MAINTAIN` فقط في migration `0073`.
2. **يمنح DELETE غير مبرّر** — التطبيق يحتاج `SELECT` + `INSERT` + `UPDATE` فقط.
3. **يجعل السكريبت هشّاً** — إذا اختلف `storage.super_user` في مشروع ما، يفشل السطر
   بـ `42501 must be owner of table objects` ويوقف بقية الـ migration.
4. **الحماية الفعلية من الحذف تأتي من RLS** — لا توجد سياسة `DELETE`، و RLS denies
   افتراضياً، فالحذف ممنوع عن `anon`/`authenticated` حتى لو منحهم Supabase صلاحية
   الجدول على مستوى المنصة.

> ملاحظة: `storage.objects` **ليس** مملوكاً لـ `supabase_storage_admin` على Supabase Cloud
> (هذا الدور يخدم الـ storage-api داخلياً)؛ المالك هو `postgres`، لذا `CREATE POLICY`
> على `storage.objects` من SQL Editor يعمل بشكل طبيعي.

### ✅ سياسة UPDATE تحتوي `USING` و `WITH CHECK` معاً

شرط PostgreSQL لسياسة `FOR UPDATE`. بدون `USING` تفشل سياسة التحديث، فيتعذّر على التطبيق
إعادة رفع صورة التلميذ نفسه (مسار `upsert: true`).

### 📋 أخلاقيات البحث (IRB) — صور التلاميذ

الحاوية `public = true` لأن التطبيق يبني رابط الصورة مباشرة عبر `getPublicUrl()`
دون الحاجة لتوقيع روابط برمجياً. الصور مُرمّزة بـ `Child_ID` فقط ولا تحتوي أسماء التلاميذ.

**عند انتهاء جمع البيانات**: اجعل الحاوية `private` واحصر القراءة بحساب المشرف:
```sql
update storage.buckets set public = false where id = 'screening-photos';
```

---

## التحقق بعد التنفيذ

### ١) الأعمدة (يجب أن يعيد 5 صفوف)
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'student_screening_records'
  and column_name in ('external_eye_findings','eye_photo_url','owner_id','examiner_full_name','device_id')
order by column_name;
```

### ٢) الحاوية والسياسات (يجب أن يعيد 4 صفوف)
```sql
select id, public from storage.buckets where id = 'screening-photos';

select policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```

### ٣) من التطبيق
افتح **لوحة المشرف ← السحابة والمزامنة ← `[🔍 فحص الاتصال الآن]`** ← يجب أن يظهر
`✅ HTTP 200`. جرّب «المتابعة والمزامنة السريعة بكود الفاحص فقط» وتأكد من
اختفاء تنبيه تخطّي الحقول (`droppedColumns` يجب أن يصبح فارغاً).

---

## ملاحظات

- `owner_id` يُملأ تلقائياً بـ `auth.uid()` عند الإدراج من حساب مسجّل الدخول.
  عند الإدراج بمفتاح `anon` يبقى `NULL` — وهذا مقصود لأن سياسات RLS مفتوحة
  أثناء مرحلة التجربة.
- لا يمكن تطبيق DDL من التطبيق: مفتاح `anon` لا يملك صلاحيات `ALTER TABLE`.
  التنفيذ اليدوي في SQL Editor هو الطريقة الوحيدة (أو مفتاح `service_role`).
- الحاوية `screening-photos` لا يمكن إنشاؤها من الـ Storage API بمفتاح `anon`
  (إنشاء الحاويات يتطلب `service_role`) — لذلك تُنشأ من SQL Editor.
