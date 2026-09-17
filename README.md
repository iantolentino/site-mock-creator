# Mockup Studio

Upload a personal HTML mockup and receive a public link on this single website:

`https://your-site.vercel.app/view/asset-inventory-test-mockup`

Enter `asset-inventory` (or `asset-inventory-test-mockup`): the app consistently adds one `-test-mockup` suffix. Uploaded HTML is stored in **Neon PostgreSQL**. No Blob store, deployment API token, or rebuild per upload is needed. The app creates its database table automatically.

## Deploy on Vercel Hobby

1. Put this folder in its own GitHub repository and import it in Vercel under your free **Hobby** account.
2. Framework: **Other**. Node.js: **24.x**. Output directory: **public**. Leave the build command empty. The install step runs `npm install` automatically; commit `package-lock.json`.
3. Set `ADMIN_PASSWORD` to a unique password of at least 16 characters and `SESSION_SECRET` to a random secret of at least 32 characters. Generate a secret with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. In the Vercel project's **Storage** tab, choose **Neon**, select its **Free** plan, and connect it to this project for **Production**. Keep the default environment variable prefix so the integration supplies `DATABASE_URL` automatically. The app also recognizes `POSTGRES_URL`, `DATABASE_URL_UNPOOLED` and `POSTGRES_URL_NON_POOLING`. Use a dedicated database for this app. No connection string needs to be pasted manually when the integration is connected correctly.
5. Deploy/redeploy after configuring storage and variables. Open the website, sign in, choose a name and HTML file, then click **Publish mockup**.
6. Open the generated link in an incognito window. Confirm it renders and that updates appear at the same address. This final live check requires your actual Vercel account and Neon connection.

**That is the whole setup.** No SQL editor, schema command, migration command, or manual table creation is needed. After sign-in, opening your collection creates `public.mockup_studio_pages` if it does not exist. Existing rows are preserved. Subsequent uploads only save HTML and return a link.

If you deployed the previous Blob version: connect Neon, keep your existing `ADMIN_PASSWORD` and `SESSION_SECRET`, and redeploy the latest `main` commit. Old Blob objects are left untouched and are not imported automatically; re-upload any HTML you want served by this version, using the same names to keep the public paths.

Use the production website when publishing links. Links copied from localhost or a protected preview deployment will not be publicly accessible. If production has Vercel Authentication enabled, disable it for the production site so visitors can open mockup links; the uploader itself remains password protected.

## How it works

- Upload one UTF-8 `.html` or `.htm` file, up to 2 MB. CSS and JavaScript should be inline; images/fonts must be embedded or use public URLs. Separate relative files are not uploaded. PHP/backends are not supported.
- Names use 1–80 letters, numbers or single hyphens, followed by `-test-mockup`. Names only need to be unique inside your own uploader, not globally across Vercel.
- Each database row contains the mockup name, full HTML, and creation/update timestamps. The public `/view/<name>-test-mockup` route reads the HTML and displays it in the browser.
- **Anyone with the public link can view it.** Database credentials stay server-side; the viewer applies isolation headers to uploaded HTML.
- Click **Update**, select a new HTML file, and publish to replace that mockup while preserving its address. Without the update checkbox, duplicate names are rejected atomically by storage.
- The collection lists saved mockups alphabetically across browsers, with pagination. HTML content is not loaded with the collection. Files survive app redeployments.
- No expiration is set. Access still depends on keeping the website/database, your accounts, and available free quotas. Keep your original HTML files as backups.

## Free allowance

Choose **Vercel Hobby** for hosting and **Neon Free** for the database. Both have usage limits; this app does not enable a paid plan or change billing settings. Each uploaded HTML document counts toward database storage, including embedded images. Views consume database compute and Vercel function/transfer usage. A sleeping Neon database may take longer on the first request. Check your account dashboards for current quotas.

[Neon pricing](https://neon.com/pricing) · [Neon integration in Vercel](https://vercel.com/marketplace/neon/neon)

## Local preview

```sh
npm install
# Copy .env.example to .env.local, then set ADMIN_PASSWORD and SESSION_SECRET.
npm run dev
# Open http://127.0.0.1:3040
```

The example config sets `LOCAL_STORAGE_DIR=.local/mockups`, so local uploads work without any cloud account. Local files are ignored by Git and not copied to Vercel. `LOCAL_STORAGE_DIR` is always ignored in Vercel production: cloud deployments use Neon. Upload your desired HTML again on the live site after deployment. To use Neon locally instead, remove `LOCAL_STORAGE_DIR` and set `DATABASE_URL` in the ignored `.env.local` file.

## Security and compatibility

The uploader requires a signed eight-hour HttpOnly session, with SameSite=Strict and Secure cookies on Vercel. Mutations require same-origin JSON requests. Password changes invalidate sessions; logout clears the browser cookie. Secrets remain server-side. A short failed-login delay is included; it is not a distributed rate limiter. Use a strong random password.

Uploaded HTML is served with a browser sandbox policy and an opaque origin. Inline JavaScript, styles, and public assets can work, but uploaded scripts cannot read the uploader's cookies or browser storage. Frames, service workers, form submissions and same-origin access are blocked. Mockups that depend on localStorage, cookies, relative files, or authenticated APIs need changes to work in this sandbox. No HTML sanitization claim is made; scripts still execute in the isolated document.

The viewer reads current HTML from the database and sends no-store, so same-link updates are visible immediately. All values use parameterized SQL. Duplicate names are protected by a primary key; replacement is an atomic upsert. Automatic schema creation uses a transaction-scoped advisory lock so cold server instances can initialize safely. The database role needs permission to create the app table. No automatic deletions or resets occur.

## Verification

`npm test` covers naming, size/type validation, session security, real local uploads, duplicate protection, updates, listing, anonymous viewing, missing files, traversal rejection, and production's refusal to use local storage. PostgreSQL tests run the actual application SQL in PGlite, including automatic schema creation, UTF-8 storage, duplicate conflicts, updates, pagination, SQL-like HTML, database size constraints, and reuse after initialization. PGlite is a development-only test dependency.

Optional browser suite: install Playwright separately or point `PLAYWRIGHT_MODULE` at an existing installation, then run `node tests/browser.cjs`. Set `BROWSER_PATH` to an installed Chromium/Edge executable if needed. The suite starts an isolated local server, uses real local files, verifies uploaded JavaScript works, verifies sandbox isolation, and checks desktop/mobile layouts. Evidence is saved under ignored `.local/qa/`. Local tests do not verify your live Neon credentials, networking, or billing configuration.
