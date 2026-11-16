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

When hosted on HTTPS (or localhost), the web app caches its application shell after its first successful load and can then reopen offline. The downloadable standalone HTML is self-contained and can be opened locally. Browser storage is local to the browser and origin; it is not encrypted, backed up, or synchronized between the hosted app and a separately opened HTML file. Export records regularly and protect the device and exported files according to the study's approved data-handling plan.

The current app code does not send screening records or eye images to a cloud service. Camera access is requested only when the examiner opens the camera station. The image measurements use examiner-selected points and an assumed HVID conversion reference; they are exploratory inputs, not validated automated clinical measurements.

Thresholds and categories shown in the app are model settings. Confirm the screening protocol, age-specific optotypes, referral rules, consent process, and reference-standard workflow with the study's responsible clinical and ethics teams before field use.
