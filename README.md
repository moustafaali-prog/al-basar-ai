# Al-Basar school vision screening

Arabic-first React/Vite interface for recording preliminary school vision-screening measurements and research data. It is a data-entry and screening aid; it has not been validated as a diagnostic medical device and does not replace assessment by a qualified clinician.

## Run locally

Requires Node.js.

```sh
npm install
npm run dev
```

Check the TypeScript project and create a production build with:

```sh
npm run lint
npm run build
```

## Offline use and data

When hosted on HTTPS (or localhost), the web app caches its application shell after its first successful load and can then reopen offline. The downloadable standalone HTML is self-contained and can be opened locally. Browser storage is local to the browser and origin; it is not encrypted or backed up automatically. Export records regularly and protect the device and exported files according to the study's approved data-handling plan.

The app stores every screening record locally first (`albasar_master_records_v3`). Cloud sync is optional and disabled until Supabase credentials are configured. When enabled, the examiner can tap **🔄 مزامنة السجلات مع سحابة المشرف** to upsert pending records to the `student_screening_records` table; the local copy remains the source of truth during offline screening. Camera access is requested only when the examiner opens the camera station. The image measurements use examiner-selected points and an assumed HVID conversion reference; they are exploratory inputs, not validated automated clinical measurements.

### Optional Supabase cloud sync setup

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. It creates the SPSS 35+ variable mirror plus indexes, an `updated_at` trigger, and pilot RLS policies.
2. Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase → Project Settings → API.
3. Run `npm run build`. Without valid keys the app stays fully offline-first and the sync action reports that the cloud is not configured.

> **Security note:** the pilot RLS policies allow the public anon key to insert/update/select this one table. For a production multi-tenant deployment, replace them with authenticated examiner policies and a server-side sync endpoint.

Thresholds and categories shown in the app are model settings. Confirm the screening protocol, age-specific optotypes, referral rules, consent process, and reference-standard workflow with the study's responsible clinical and ethics teams before field use.
