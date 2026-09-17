# Mockup Studio

Upload a personal HTML mockup and receive a public link on this single website:

`https://your-site.vercel.app/view/asset-inventory-test-mockup`

Enter `asset-inventory` (or `asset-inventory-test-mockup`): the app consistently adds one `-test-mockup` suffix. There is **no Vercel deployment API token**, no project creation per upload, and no rebuild per mockup. Uploaded files are stored in Vercel Blob.

## Deploy on Vercel Hobby

1. Put this folder in its own GitHub repository and import it in Vercel under your free **Hobby** account.
2. Framework: **Other**. Node.js: **24.x**. Output directory: **public**. Leave the build command empty. The install step runs `npm install` automatically; commit `package-lock.json`.
3. Set `ADMIN_PASSWORD` to a unique password of at least 16 characters and `SESSION_SECRET` to a random secret of at least 32 characters. Generate a secret with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. In the Vercel project's **Storage** tab, create a **Blob** store with **Private** access and connect it to the project. Use a dedicated store for this app. Vercel supplies the storage connection through `BLOB_STORE_ID` and OIDC credentials, or `BLOB_READ_WRITE_TOKEN`; the app supports both. You do not need `VERCEL_TOKEN` or `VERCEL_TEAM_ID`.
5. Deploy/redeploy after configuring storage and variables. Open the website, sign in, choose a name and HTML file, then click **Publish mockup**.
6. Open the generated link in an incognito window. Confirm it renders and that updates appear at the same address. This final live check requires your actual Vercel account and Blob store.

Use the production website when publishing links. Links copied from localhost or a protected preview deployment will not be publicly accessible. If production has Vercel Authentication enabled, disable it for the production site so visitors can open mockup links; the uploader itself remains password protected.

## How it works

- Upload one UTF-8 `.html` or `.htm` file, up to 2 MB. CSS and JavaScript should be inline; images/fonts must be embedded or use public URLs. Separate relative files are not uploaded. PHP/backends are not supported.
- Names use 1–80 letters, numbers or single hyphens, followed by `-test-mockup`. Names only need to be unique inside your own uploader, not globally across Vercel.
- Files are saved at `mockup-studio/<name>-test-mockup.html` in private Blob storage. The public `/view/<name>-test-mockup` route reads the HTML and displays it in the browser.
- The file is not private to viewers: **anyone with the public link can view it**. Private Blob storage prevents the raw object from being served outside the app's security headers.
- Click **Update**, select a new HTML file, and publish to replace that mockup while preserving its address. Without the update checkbox, duplicate names are rejected atomically by storage.
- The collection lists stored mockups across browsers. There is no database or browser-local storage requirement, and files survive app redeployments.
- No expiration is set. Access still depends on keeping the website/store, your Vercel account, and available free quotas. Keep your original HTML files as backups.

## Free allowance

Vercel Blob is free within Hobby limits. As checked September 17, 2026, the included allowance is 1 GB storage, 10 GB Blob transfer, 10,000 simple operations and 2,000 advanced operations. Uploads and list requests consume operations; views also consume function/transfer resources. Hobby pauses Blob access if limits are exceeded rather than charging overages. Deploy and connect the store under Hobby, not Pro. This app does not change your billing plan.

[Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) · [Private storage setup](https://vercel.com/docs/vercel-blob/private-storage)

## Local preview

```sh
npm install
# Copy .env.example to .env.local, then set ADMIN_PASSWORD and SESSION_SECRET.
npm run dev
# Open http://127.0.0.1:3040
```

The example config sets `LOCAL_STORAGE_DIR=.local/mockups`, so local uploads work without any cloud account. Local files are ignored by Git and not copied to Vercel. `LOCAL_STORAGE_DIR` is always ignored in Vercel production: cloud deployments require durable Blob storage. Upload your desired HTML again on the live site after deployment.

## Security and compatibility

The uploader requires a signed eight-hour HttpOnly session, with SameSite=Strict and Secure cookies on Vercel. Mutations require same-origin JSON requests. Password changes invalidate sessions; logout clears the browser cookie. Secrets remain server-side. A short failed-login delay is included; it is not a distributed rate limiter. Use a strong random password.

Uploaded HTML is served with a browser sandbox policy and an opaque origin. Inline JavaScript, styles, and public assets can work, but uploaded scripts cannot read the uploader's cookies or browser storage. Frames, service workers, form submissions and same-origin access are blocked. Mockups that depend on localStorage, cookies, relative files, or authenticated APIs need changes to work in this sandbox. No HTML sanitization claim is made; scripts still execute in the isolated document.

The viewer bypasses Blob caches for current content and sends no-store. This makes same-link updates visible immediately but uses more read operations than a cached site. No automatic deletions occur. You can remove unwanted objects from Vercel Storage manually.

## Verification

`npm test` covers naming, size/type validation, session security, real local uploads, duplicate protection, updates, listing, anonymous viewing, missing files, traversal rejection, and production's refusal to use local storage.

Optional browser suite: install Playwright separately or point `PLAYWRIGHT_MODULE` at an existing installation, then run `node tests/browser.cjs`. Set `BROWSER_PATH` to an installed Chromium/Edge executable if needed. The suite starts an isolated local server, uses real local files, verifies uploaded JavaScript works, verifies sandbox isolation, and checks desktop/mobile layouts. Evidence is saved under ignored `.local/qa/`. Cloud Blob writes are not exercised by local tests.
