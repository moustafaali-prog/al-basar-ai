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

## 🔐 النموذج الأمني (RLAC صارم — enforced by PostgreSQL)

| الطبقة | كيف تعمل |
|---|---|
| **الدور** | `app_metadata.role` في JWT فقط. `user_metadata` قابل للتعديل من العميل فلا يُقرأ أبداً، ولا يوجد أي بريد مشرف مكتوب داخل الحزمة. |
| **الفاحص** | يرى/يضيف/يحدث **سجلاته فقط** (`owner_id = auth.uid()`). |
| **المشرف** | `app_metadata.role = 'admin'` → يرى ويدير كل السجلات. |
| **`anon`** | **لا صلاحية إطلاقاً** على جدول السجلات (RLD + `REVOKE`) — المفتاح المنشور لا يفتح بيانات التلاميذ. |
| **الحذف** | لا توجد سياسة `DELETE` إطلاقاً → RLS denies افتراضياً، فالسجل المُرفع لا يُحذف (ALCOA+ / SPIRIT-AI audit trail). |
| **الصور** | حاوية **خاصة** `public = false`، لا تُقرأ إلا برابط موقّع صالح ساعة، ولا يرفعها الفاحص إلا داخل مجلده `{auth.uid()}/…`. |

> ⚠️ **الأثر الميداني:** المزامنة السحابية تتطلب تسجيل دخول حقيقي. من يعمل بلا إنترنت
> تُحفظ سجلاته محلياً في الجهاز وتبقى `pending` حتى يسجّل الدخول، فتُرفع عندها
> مرتبطة بـ `owner_id` صحيح. لا يوجد أي «مسار احتياطي» عبر `anon`.

### ترقية حساب إلى مشرف

من **Supabase → Authentication → Users**، أو عبر SQL Editor:

```sql
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
 where email = 'YOUR_ADMIN_EMAIL';
```

ثم **سجّل الخروج وأعد الدخول** مرة واحدة ليُصدر الخادم JWT جديداً يحمل `app_metadata.role`.

---

## الخيار ١ (موصى به): ملف schema.sql كامل

انسخ محتوى `schema.sql` كاملاً والصقه في **Supabase → SQL Editor → New Query** ثم اضغط **Run**.

الملف **Idempotent**: يمكن تشغيله مرات متعددة بأمان، ولا يحذف أي بيانات قائمة.
يشمل:
- إنشاء الجدول بأعمدة الـ 35+ متغيّراً (SPSS) + الأعمدة الداخلية (61 عموداً).
- ترقية آمنة للجداول القديمة عبر `add column if not exists` لكل عمود (بما فيها `examination_date`).
- سياسات RLS المقيّدة بـ `owner_id = auth.uid()` + دالة `public.is_albasar_admin()`.
- حاوية `screening-photos` **خاصة** + 3 سياسات تخزين مقيّدة بمجلد صاحب الحساب.
- `NOTIFY pgrst, 'reload schema';` في النهاية لتحديث ذاكرة PostgREST فوراً.

---

## الخيار ٢ (سريع): الأعمدة الناقصة + حاوية الصور

نفّذ في SQL Editor محتوى **`supabase/quick-migration.sql`** كاملاً (6 أعمدة + RLS + الحاوية + السياسات).

الأعمدة الستة: `external_eye_findings` · `eye_photo_url` · `owner_id` ·
`examiner_full_name` · `device_id` · `examination_date`

> هذا الملف **لا ينشئ الجدول** — إنه ترحيل (migration) لمشروع قائم فيه
> `public.student_screening_records`. إن لم يكن الجدول موجوداً، تُتخطى خطوات
> الجدول برسالة `NOTICE` واضحة، بينما **تُنشأ الحاوية وسياسات التخزين فعلاً**
> (كل خطوة مرتبطة بالجدول داخل كتلة `DO` واحدة، فلا يُلغى السكربت بالكامل).
> لمشروع جديد استخدم `schema.sql` مباشرة.

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

الحاوية `public = false`. التطبيق يرفع الصورة داخل `{auth.uid()}/{child_id}/{ts}.jpg`
ويخزّن **مسار الكائن** فقط في `eye_photo_url`، ثم يقرأه عبر
`createSignedUrl(path, 3600)` عند العرض. لا رابط عام ثابت، ولا اسم تلميذ في المسار.

---

## التحقق بعد التنفيذ

### ١) الأعمدة (يجب أن يعيد 6 صفوف)
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'student_screening_records'
  and column_name in ('external_eye_findings','eye_photo_url','owner_id','examiner_full_name','device_id','examination_date')
order by column_name;
```

> ⚠️ `examination_date` تحديداً: التطبيق يكتب هذا العمود في كل مزامنة.
> لو غاب عن الجدول، يفشل الـ upsert بـ `PGRST204` — لذلك هو ضمن قائمة
> `add column if not exists` في **الملفين** (وهو أصلح خطأ كان يوقف
> إنشاء الفهرس `idx_ssr_examination_date` في `schema.sql`).

### ١-ب) نوع عمودَي الزمن — يجب أن يكونا `numeric` لا `integer`
```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'student_screening_records'
  and column_name in ('paper_time_sec','smart_time_sec')
order by column_name;
```
> يجب أن يعيد `numeric` للعمودين.

**لماذا؟** المؤقتان في المحطتين يسجّلان الزمن بعُشر الثانية:
`setPaperTimeSec(+elapsed.toFixed(1))` و `setSmartTimeSec(+elapsed.toFixed(1))`.
فتحصل قيمة مثل `74.5`، فإذا كان العمود `integer` يرفضها PostgreSQL بـ:

```
HTTP 400 (22P02): invalid input syntax for type integer: "74.5"
```

وتُفشل المزامنة كاملة. التحويل إلى `numeric` يحل الخطأ **ويحافظ** على دقة
أجزاء الثانية التي يحتاجها تحليل المقارنة الزمنية في SPSS.

> ⚠️ `add column if not exists` **لا يغيّر نوع عمود موجود**، لذلك يجب أن يحتوي
> كل من `schema.sql` و `quick-migration.sql` أمر تحويل صريح:
> ```sql
> alter table public.student_screening_records
>   alter column paper_time_sec type numeric using paper_time_sec::numeric,
>   alter column smart_time_sec type numeric using smart_time_sec::numeric;
> ```
> هذا الأمر يُعيد كتابة الجدول (قفل `ACCESS EXCLUSIVE`) — فوري على جدول صغير،
> ونفّذه في نافذة صيانة على جدول كبير.

**الحماية الثانية (في الكود):** `src/utils/supabaseClient.ts` يمرّر كل عمود
رقمي عبر دالة تحقّق (`toSafeInt` لعمود `integer`، `toSafeNum` لعمود الزمن،
`toSafeNum63` لعمود `numeric(6,3)`)، فلا يصل خطأ نوع إلى قاعدة البيانات.

### ٢) الحاوية والسياسات (يجب أن يعيد 4 صفوف)
```sql
select id, public from storage.buckets where id = 'screening-photos';

select policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```
> `public` يجب أن يظهر `f` (خاصة) و `roles` يجب أن يظهر `{authenticated}`.

### ٣) أن `anon` لم يعد able على قراءة الجدول
```sql
-- يجب أن يعيد 0 (لا صفوف) لا خطأً:
set role anon;
select count(*) from public.student_screening_records;
reset role;
```

### ٤) من التطبيق
سجّل الدخول بحساب مشرف ← افتح **🧰/📊 ← لوحة البيانات ← «تحديث البيانات الحية»** ←
يجب أن تظهر KPIStrip وعدد الفاحصين. جرّب «مزامنة» وتأكد أن `droppedColumns` يصبح فارغاً.

---

## ملاحظات

- `owner_id` يُملأ تلقائياً بـ `auth.uid()` عند الإدراج من حساب مسجّل الدخول.
- لا يمكن تطبيق DDL من التطبيق: مفتاح `anon` لا يملك صلاحيات `ALTER TABLE`.
  التنفيذ اليدوي في SQL Editor هو الطريقة الوحيدة (أو مفتاح `service_role`).
- الحاوية `screening-photos` لا يمكن إنشاؤها من الـ Storage API بمفتاح `anon`
  (إنشاء الحاويات يتطلب `service_role`) — لذلك تُنشأ من SQL Editor.
- المعرّفات الآن بصيغة `BAB-<بادئة جهاز من 3 خانات>-<رقم>` (مثل `BAB-A4F-101`)
  لمنع تصادم أكواد التلاميذ بين الفرق التي تعمل بلا إنترنت.
