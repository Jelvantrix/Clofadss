# Zejesh

Scandinavian archival e-commerce storefront + studio administration console.

- **Front end:** Vite + React + TypeScript + Tailwind
- **Database / realtime / auth:** Supabase (Postgres, Realtime, Supabase Auth)
- **API:** Express (`server.ts`) — Gemini video generation, targets & coach engine

Firebase has been fully removed. There is no `firebase` package, no `functions/`
directory, and no Firestore/Storage rules left in this repository.

**Design and system references**

- `ZEJESH-DESIGN-SYSTEM.md` — frozen current design system, tokens, imagery, motion, components and governance.
- `docs/SYSTEM-ARCHITECTURE.md` — current-state audit and target control-plane architecture.
- `supabase/migrations/0008_control_plane.sql` — Phase 0 control-plane schema.
- `supabase/migrations/0011_hardening.sql` — audit-chain uniqueness, cost budgets, security analytics, runbook execution and backup drills.
- `supabase/migrations/0012_media_targets.sql` — desktop/mobile/both upload tags for the media library.

---

## 1. Environment

Copy `.env.example` to `.env` and fill it in:

| Variable | Where it lives | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Client + server | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Client + server | Safe to expose; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Bypasses RLS. **Never** prefix with `VITE_` |
| `GEMINI_API_KEY` | Server only | Video generation |
| `TRUST_PROXY` | Server only | Set to `1` when behind nginx/Cloudflare/etc. |
| `CRON_SECRET` | Server only | Bearer secret for `GET /api/cron/health` |
| `SECURITY_HASH_SALT` | Server only | Optional salt for hashed IP addresses in security analytics |
| `NODE_ENV` | Server only | `development` is opt-in via `npm run dev`; everything else runs with production posture |

> The legacy `DEMO_MODE` flag, all seed constants and every fixture were removed.
> The app only ever renders real database content; an empty database produces an
> honest empty state, never invented items.

`SUPABASE_SERVICE_ROLE_KEY` is read through `process.env`, not `import.meta.env`,
so Vite never inlines it. A build-time check (`config.ts`) throws if it is ever
present in a browser context. The `/api` routes return **503** if it is missing,
because they cannot verify administrative roles without it.

---

## 2. Database setup

Run the migrations **in order** in the Supabase SQL Editor (or `supabase db push`):

1. `supabase/migrations/0001_init_schema.sql` — 21 tables, indexes, realtime publication, `pg_cron` daily-stats job
2. `supabase/migrations/0002_production_security.sql` — role helpers, checkout RPCs, Row Level Security
3. `supabase/migrations/0003_suggest_proposals_system.sql` — proposals / waves / votes system
4. `supabase/migrations/0004_owner_only_security.sql` — `is_owner()`, owner-only admin lockdown
5. `supabase/migrations/0005_remove_seed_data.sql` — **purges every seeded row**, resets `settings`/`content` to empty defaults (keeps `public.admins` + `public.owner_config`)
6. `supabase/migrations/0006_media_storage.sql` — public-read `media` Storage bucket (15 MB, restricted mime types, owner-only writes) + `public.media_assets` table
7. `supabase/migrations/0007_media_bucket_fix.sql` — media bucket policy/index correction
8. `supabase/migrations/0008_control_plane.sql` — service catalogue, health results, incidents, alerts, deployments, jobs and the append-only audit trail
9. `supabase/migrations/0009_visibility.sql` — SLO definitions, alert rules, data-quality check definitions and results
10. `supabase/migrations/0010_operations.sql` — feature flags, runbooks, change requests and the durable video job definition
11. `supabase/migrations/0011_hardening.sql` — cross-instance audit-chain safety, cost budgets and snapshots, admin sessions and security events, approval-gated runbook executions, backup/restore drills
12. `supabase/migrations/0012_media_targets.sql` — desktop/mobile/both placement tags on media assets
13. `supabase/setup-first-admin.sql` — **required**, see below

Migrations are idempotent — 0005 and 0006 are safe to re-run from the SQL
Editor at any time.

### 2.0 Verifying the media bucket

After 0006, **Storage → Buckets** must show a bucket named `media` with
**Public bucket** enabled, a 15 MB file size limit and the mime types
`image/jpeg, image/png, image/webp, image/avif, video/mp4, video/webm`.

### 2.0.1 Media placement targets

Every upload from the admin panel asks whether the file is for **Desktop**,
**Mobile**, or **Both** before it is sent to Storage. The choice is stored in
`public.media_assets."target"` (migration `0012`) and shown in the Media
Storage grid.

The shared media picker filters the library to assets that match the slot:
a desktop hero slot shows desktop + shared assets, and a mobile hero slot shows
mobile + shared assets. The tag can be changed later from the asset inspector.

### 2.1 Creating the first administrator

Security model: `public.admins` has no anonymous access, and only an existing
`owner` may insert or update rows in it. The very first row therefore has to be
created from the SQL Editor, which runs with full privileges.

Edit the three values at the top of `supabase/setup-first-admin.sql` and run it
once. It creates the Supabase Auth account *and* the matching `owner` row
atomically.

> **Note:** `huxaifa0fficial@gmail.com` is the configured owner address held in
> `public.owner_config`. It is not an access credential and no account exists
> until you create it.

### 2.2 Supabase Auth settings

In **Authentication → Providers**, keep *Email* enabled. In **Authentication →
Settings**, disable "Allow new users to sign up" for the public site — only
administrators should ever need to register.

---

## 3. Security model

### Row Level Security

| Surface | `anon` | `authenticated` |
| --- | --- | --- |
| `products`, `categories`, `collections`, `content`, `settings`, `discounts`, `suggestions` | SELECT | SELECT |
| `waitlist`, `events`, `auditLog` | INSERT only | as below |
| `orders`, `customers`, `insights`, `dailyStats`, `auditLog`, `inventoryLog`, targets/coach tables | none | `is_admin()` to read, `can_write()` to write |
| `admins` | none | `is_admin()` to read, **`is_owner()` to write** |

`is_admin()` / `admin_role()` / `can_write()` / `is_owner()` are `SECURITY
DEFINER` functions that read `public.admins` from the caller's JWT — the client
cannot influence their result.

### Table writes that visitors need

Checkout, waitlist signup and community voting all mutate data, but the browser
is never granted direct write access to `products`, `customers` or `suggestions`.
They go through `SECURITY DEFINER` RPCs instead:

- `place_order(jsonb)` — inserts the order, upserts the customer, decrements
  stock and writes the audit row in one transaction
- `submit_suggestion(jsonb)` — forces `status='under_review'`, `votes=1`
- `vote_for_suggestion(text, text)` — increments only if this voter has not
  voted before (the old read-then-write both raced and allowed repeat votes)

### Administrative console

`AdminSecurityGate` calls `supabase.auth.signInWithPassword`. There is no
client-side password, no bypass button, and no passkey stored in
`localStorage`. The role shown in the header is read-only — it comes from
`public.admins` and cannot be escalated from the browser. Real enforcement is
server-side: even a fully forged client session produces an invalid JWT and is
rejected by RLS.

### API (`server.ts`)

All `/api/*` routes except the cron entry point require a live Supabase access
token that resolves to a `public.admins` row. Additional hardening:

- body limit **512 KB** by default, **15 MB** only for `/api/generate-video`
- in-memory per-IP rate limiting (120 req/min general, 10/min video generation)
- `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, no `X-Powered-By`
- set `TRUST_PROXY=1` when behind a reverse proxy so rate limiting sees real IPs
- a JSON error handler returns a stable `{ error }` body and **never** sends a
  stack trace unless `NODE_ENV=development`
- unmatched `/api/*` paths answer `404 {"error":"Not found."}` instead of falling
  through to the SPA catch-all

Measured behaviour of a running server:

| Request | Response |
| --- | --- |
| `GET /api/metrics` (no token) | `401 {"error":"Authentication required."}` |
| `GET /api/metrics` (invalid token) | `401 {"error":"Invalid or expired session."}` |
| `GET /api/*` with no service key configured | `503` (fail closed) |
| Body > 512 KB | `413 {"error":"Request body too large."}` |
| Malformed JSON | `400 {"error":"Malformed JSON body."}` |
| 121+ requests/min from one IP | `429` + `Retry-After` |
| `GET /`, `GET /story` | `200 text/html` (SPA) |

### Control-plane probes

Phase 0 adds real, non-fabricated probes. Missing configuration is reported as
`not_configured`, never as healthy.

| Request | Auth | Purpose |
| --- | --- | --- |
| `GET /health/live` | public | Process liveness, version and request ID |
| `GET /health/ready` | public | Dependency readiness; returns `503` when unconfigured or down |
| `GET /health/deep` | admin | Full control-plane overview |
| `GET /api/control/overview` | admin | Services, checks, incidents, deploys and failing jobs |
| `GET /api/control/services` | admin | Service catalogue with live status |
| `GET /api/control/health` | admin | Live probe results without persistence |
| `POST /api/control/health/run` | admin | Run probes, persist results and reconcile alerts |
| `GET /api/control/history` | admin | Persisted probe history, aggregated hourly |
| `GET /api/control/slo` | admin | Availability SLOs and error budgets |
| `GET /api/control/alerts` | admin | Firing and acknowledged alerts |
| `POST /api/control/alerts/:id/ack` | admin | Acknowledge an alert |
| `GET /api/control/incidents` | admin | Incident register and timeline |
| `POST /api/control/incidents` | admin | Declare an incident |
| `PATCH /api/control/incidents/:id` | admin | Change incident status or ownership |
| `POST /api/control/incidents/:id/events` | admin | Add an incident timeline note |
| `GET /api/control/deployments` | admin | Deployment register |
| `POST /api/control/deployments` | admin | Record a deployment |
| `GET /api/control/data-quality` | admin | Run read-only data-quality checks |
| `POST /api/control/data-quality/run` | admin | Run and persist data-quality results |
| `GET /api/control/jobs` | admin | Durable job definitions and recent runs |
| `GET /api/control/flags` | admin | Feature flags |
| `PATCH /api/control/flags/:key` | admin | Enable or disable a feature flag |
| `GET /api/control/runbooks` | admin | Incident runbooks |
| `GET /api/control/change-requests` | admin | Change-request register |
| `POST /api/control/change-requests` | admin | Request a high-impact change |
| `POST /api/control/change-requests/:id/decide` | owner | Approve or reject a change request |
| `GET /api/control/audit` | admin | Recent hash-chained audit events and chain verification |
| `GET /api/control/costs` | admin | Cost budgets, current-month spend and snapshots |
| `POST /api/control/costs/budgets` | admin | Create or replace a monthly budget |
| `POST /api/control/costs/snapshots` | admin | Record a provider or invoice cost snapshot |
| `GET /api/control/security` | admin | Admin sessions, denied access and privileged mutations |
| `GET /api/control/backups` | admin | Backup and restore drill register |
| `POST /api/control/backups` | admin | Record a backup or restore drill |
| `PATCH /api/control/backups/:id` | admin | Advance a drill to running, passed or failed |
| `GET /api/control/runbook-executions` | admin | Approval-gated runbook execution records |
| `POST /api/control/runbooks/:id/execute` | admin | Start a runbook with an approved `runbook.execute` request |
| `POST /api/control/runbook-executions/:id/step` | admin | Record the next runbook step result |
| `POST /api/control/runbook-executions/:id/abort` | admin | Abandon or fail an in-progress execution |
| `GET /api/cron/health` | `CRON_SECRET` | Scheduled probe, persistence and alert reconciliation |

Every `/api/*` and `/health/*` response carries `X-Request-Id`. Completed requests
are logged as structured JSON (`type`, `requestId`, `method`, `path`, `status`,
`durationMs`, `at`).

To build health history continuously, point Vercel Cron or an external scheduler
at `GET /api/cron/health` with `Authorization: Bearer $CRON_SECRET`. The endpoint
fails closed when `CRON_SECRET` is missing.

---

## 4. Development

```bash
npm install
npm run dev      # NODE_ENV=development — Vite middleware, stack traces in errors
```

### 4.1 Tests and the no-seed guard

```bash
npm run check:no-seed   # greps src/ for SEED_/mock/Math.random/demo/lorem/unsplash/picsum/… and FAILS the build
npm test                # Vitest unit tests (framing, media validation, guard self-test)
npm run test:e2e        # Playwright (builds first: `npm run build`) — mocked Supabase, zero seeded data
npm run verify          # guard + typecheck + production build
```

`npm run build` runs the guard first, so a commit that reintroduces seeded or
fabricated data cannot ship. `.github/workflows/ci.yml` runs the same steps on
every push and pull request.

## 5. Production

```bash
npm run build    # bundles the client into dist/
npm start        # NODE_ENV=production — serves dist/ plus the /api routes
```

`cross-env` and `tsx` are regular **dependencies** (not dev), so a
`npm ci --omit=dev` production install still boots. If `dist/index.html` is
missing the server logs a clear warning and serves `503` rather than failing
obscurely.

---

## 6. Deploying to Vercel

The application is pre-configured for 1-click deployment on **Vercel**:

- **Framework Preset**: `Vite` (automatically detected via `vercel.json`)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Client-Side Routing**: SPA fallback to `/index.html` with immutable asset caching
- **Serverless API**: `/api/index.ts` automatically serves all `/api/*` routes

### Vercel Setup Steps:

1. Import your Git repository into **Vercel** (`New Project`).
2. Set the following **Environment Variables** in the Vercel Project Settings:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase public anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for serverless admin API)
   - `GEMINI_API_KEY`: Google Gemini API key (for Veo video motion generation)
3. Click **Deploy**. Vercel will build the frontend assets, set up the `/api` serverless handler, and deploy globally with edge CDN caching.

---

Verification status:

- `npm run lint` (`tsc --noEmit`) — **0 errors**, including `server.ts`
- `npm run build` — succeeds, 2333 modules
- `npm audit` — **0 vulnerabilities**
- `npm start` smoke-tested: SPA routes, 401/400/413/429 responses all verified
- No Firebase imports, no hardcoded credentials
- Service role key verified absent from the browser bundle (build-time sentinel test)
