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

### Optional Supabase cloud sync setup (authenticated examiners)

1. Create a Supabase project (`eu-west-1`) and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. It creates:
   - `student_screening_records` with internal `owner_id` for RLS
   - `examiner_profiles` table and the `handle_new_examiner()` trigger linked to `auth.users`
   - Security-definer function `is_supervisor()` and RLS policies restricting select/insert/update to authenticated users, examiners can only see their own rows, supervisors can read all rows.
   - Row-level privileges revoke `anon` access entirely.
2. In **Authentication → Providers → Email** disable public sign-ups. Create examiner accounts manually via **Authentication → Users → Add user**. Promote the lead supervisor by running:
   ```sql
   update public.examiner_profiles
   set role = 'supervisor'
   where user_id = '00000000-0000-0000-0000-000000000000'; -- replace with UID
   ```
   or via the Supabase dashboard.
3. Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API. **Do not store a service-role key** in the browser build.
4. Build with `npm run build`. The app remains 100% offline-first: local screening never requires login. Cloud sync is gated by an examiner session; the login button opens in the sync status bar only when online.
5. When a session is active, syncing upserts only records owned by `auth.uid()`. The SPSS 35-variable export is unchanged and excludes `owner_id`.

> **Security note:** Anon RLS policies are removed. Sync requires a logged-in Supabase session. Records remain local first; a signed-out examiner can continue screening offline and sync later after signing in.


Thresholds and categories shown in the app are model settings. Confirm the screening protocol, age-specific optotypes, referral rules, consent process, and reference-standard workflow with the study's responsible clinical and ethics teams before field use.
