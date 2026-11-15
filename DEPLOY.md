# Deploying ComplyBD

This repository is the full ComplyBD platform — a Next.js 16 (App Router, TypeScript) app
with API routes, Prisma + SQLite by default, Tailwind 4 and shadcn/ui. It ships as a
pushable ZIP (download it from the running app) and deploys either as **one Render Web
Service** (recommended — keeps SQLite on a persistent disk) or on **Vercel** with
Postgres. Everything below is honest about what exists — no managed auth, no external
cron, no background workers are included.

---

## What you get

- **Versioned rule engine** — rules live in the database (never in code), each with an
  effective window and approval provenance; verdicts are replayable by as-of date and
  every evaluation traces its applicability gate + deadline formula.
- **Verification / review / change queues** — rule verification workflow, human review
  decisions, and a change pipeline that appends new rule versions instead of editing them.
- **Need-to-know access log** — four roles with classification clearances
  (PUBLIC → RESTRICTED); sensitive reads are masked or denied and every attempt is
  written to the AccessLog.
- **Multi-tenant SaaS isolation** — every domain row carries a tenantId; a
  tenant-scoped Prisma client enforces row-level isolation (reads forced, writes
  stamped, cross-tenant access throws), verified by `bun run verify:isolation` in CI.
- **Real authentication** — NextAuth v4: provisioned credentials users plus
  opt-in SSO (Google / Azure AD / Okta OIDC activate when their env vars exist).
  No JIT signup; deactivated users and suspended tenants are cut off per request.
- **Engine-health alerting** — every compliance run raises OPEN alerts for engine
  gaps, rules left unverified too long and circulars pending too long; optional
  webhook dispatch (`ALERT_WEBHOOK_URL`), audited acknowledgement in the UI.
- **Bangladesh regulatory map** — 7 regulators (RJSC, BSEC, DSE/CSE, NBR, DOL, BB, NDGA)
  with legal instruments, citations and VERIFIED / PARTIAL / UNVERIFIED source-review
  status on every statutory row.
- **ZIP export** — `GET /api/export` streams the whole source tree (minus
  `node_modules`, `.next`, logs and the runtime database) as `complybd-platform-YYYYMMDD.zip`.

The demo tenant is "Padma Textiles & Apparels Ltd. (DSE: PADMATEX)" and the seed
(`prisma/seed.ts`) loads the source-reviewed Regulatory Mapping v2 dataset.

## 1. Download the ZIP

Two ways, same archive:

- **From the UI** — Dashboard → *Export & Deploy* card → **Download project ZIP**.
- **Direct** — `curl -o complybd-platform.zip http://localhost:3000/api/export`

The archive contains all source files (including `render.yaml`, `vercel.json`,
`DEPLOY.md`, `.env.example`) and excludes `node_modules`, `.next`, `.git`, `*.log`,
`db/custom.db`, `tool-results/`, `download/`, `agent-ctx/` and local `.env*` secret files.

## 2. Push to GitHub

```bash
unzip complybd-platform.zip -d complybd
cd complybd
git init
git add .
git commit -m "ComplyBD platform — initial import"
git branch -M main
git remote add origin https://github.com/<you>/complybd.git
git push -u origin main
```

## 3. Option A — Render (recommended for the full app incl. SQLite)

Render runs the entire app (frontend + API routes) as one Node Web Service, and a
**persistent disk** keeps SQLite alive across redeploys.

1. Render Dashboard → **New → Blueprint** → pick the repo; Render reads `render.yaml`
   (service `complybd-platform`, plan `starter`, health check `/api/dashboard`,
   disk `complybd-data` mounted at `/opt/complybd-data`).
2. When prompted for the `DATABASE_URL` env var, set it to a file **on the disk**:
   `file:/opt/complybd-data/prod.db`.
   This matters: Render's ephemeral filesystem is wiped on every redeploy, so SQLite
   anywhere else loses all data. The disk survives redeploys (it is only detached if
   you delete the service or resize/remove the disk).
3. Deploy. The build command runs `bun install && bunx prisma generate && bunx prisma
   db push && npm run build`, then starts the app.
   - **Client generation is fail-safe.** The package now generates the Prisma
     client in a `postinstall` hook *and* at the start of `npm run build`
     (`scripts/prisma-generate-for-env.ts` reads `DATABASE_URL` and generates the
     matching client — SQLite for this topology, Postgres for Options B/C). Even
     a Render service configured with a bare `npm run build` builds correctly.
   - **`prisma db push` still belongs in the Render build command** — it applies
     the schema to the SQLite file on the persistent disk (a fresh disk starts
     empty; a redeploy with schema changes migrates in place). Set the Render
     **Build Command** to the full sequence above if the service was created
     manually instead of from the Blueprint.
   - The start script runs `node .next/standalone/server.js` — plain Node, no
     bun required at runtime (bun is only the build-time installer/runner).
4. **First-boot seeding** — the database starts empty. Seed it once, either:
   - from the Render **Shell** tab (SSH into the starter instance):
     `bun prisma/seed.ts` (or `npx tsx prisma/seed.ts` without bun), or
   - as a one-off Render **Job** running the same command.
   The seed wipes and reloads the Regulatory Mapping v2 dataset (regulators,
   instruments, rule versions, obligations, documents, access-log demo rows) — it is
   destructive by design; run it only on a fresh database.
5. Log in to the dashboard URL; `/api/dashboard` is the Render health check.

## 4. Option B — Vercel (frontend + API routes, serverless)

The Next.js app — **including every API route** (`/api/dashboard`, `/api/export`,
`/api/compliance-engine`, …) — deploys to Vercel out of the box:

1. Push to GitHub (step 2), then Vercel → **Add New → Project** → import the repo.
   No build settings needed; `vercel.json` pins `framework: "nextjs"`.
2. Set the `DATABASE_URL` environment variable in Project → Settings → Environment
   Variables before the first deploy.
3. **Honest caveat:** on Vercel the filesystem is ephemeral — a SQLite file written at
   runtime vanishes between invocations/redeploys. The app will *run* with SQLite
   (`DATABASE_URL="file:./db/custom.db"`), but production data requires switching
   Prisma to Postgres:
   - run `bun run db:generate:pg` — derives `prisma/schema.postgres.prisma`
     from the canonical schema (provider swap only; the model layer is portable)
     and generates the Postgres client;
   - point `DATABASE_URL` at Neon / Supabase / Render Postgres
     (`postgresql://user:password@host:5432/complybd?sslmode=require`);
   - run `bunx prisma db push --schema prisma/schema.postgres.prisma` once and
     `bun prisma/seed.ts` once to load the dataset;
   - set the Vercel **Build Command** to `bun run build` — the build script
     detects the `postgres://` URL and generates the **Postgres** client
     automatically (a SQLite-flavoured client pointed at Postgres fails at
     runtime, which is the classic deploy-late failure this prevents).

## 5. Option C — Split topology (Vercel app + Render Postgres)

Keep the web app on Vercel and host the *state* on Render:

- Render: create a **Render Postgres** instance (Dashboard → New → Postgres) and copy
  its *Internal* / *External* connection string.
- Vercel: set the app's `DATABASE_URL` to that connection string (use the External
  URL from Vercel; the Internal URL only resolves inside Render's network).
- Run `bun run db:generate:pg`, then `bunx prisma db push --schema
  prisma/schema.postgres.prisma` + `bun prisma/seed.ts` once against it (as in Option B).
- Connection story: the app's API routes are Next.js server functions that call Prisma
  server-side, so there is no browser → database traffic and no CORS to configure; the
  only cross-service dependency is the shared `DATABASE_URL`. The same split works for
  any future long-running service (e.g. a worker) — it would connect to the same
  Postgres, while Vercel serves the HTTP surface.

## 6. Environment variables

| Variable | Required | Example (dev / local) | Example (production) | Notes |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | yes | `file:./db/custom.db` | `file:/opt/complybd-data/prod.db` (Render) or `postgresql://user:password@host:5432/complybd?sslmode=require` | Relative `file:` paths resolve against `prisma/schema.prisma`; for Postgres use the generated postgres schema. |
| `NODE_ENV` | auto | `development` | `production` | Render sets it via the Blueprint; Vercel sets it automatically. |
| `NEXTAUTH_URL` | yes | `http://localhost:3000` | `https://your-domain` | NextAuth base URL. |
| `NEXTAUTH_SECRET` | yes | `openssl rand -hex 32` | same | Session-token signing secret — generate a unique value per environment. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | — | — | Enables Google SSO in the sign-in dialog when set. |
| `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` | no | — | — | Enables Azure AD (Entra ID) SSO when set. |
| `OKTA_CLIENT_ID` / `OKTA_CLIENT_SECRET` / `OKTA_ISSUER` | no | — | — | Enables Okta OIDC SSO when set. |
| `ALERT_WEBHOOK_URL` | no | — | `https://hooks.slack.com/...` | Posts every raised engine-health alert (Slack/Discord/generic JSON). |
| `ALERT_STALE_RULE_DAYS` | no | `30` | `30` | Days before an unverified in-force rule raises an alert. |
| `ALERT_PENDING_CHANGE_DAYS` | no | `7` | `7` | Days before a pending circular raises an alert. |

**Sign-in model:** accounts are PROVISIONED by an administrator (seeded demo users:
`tanvir@padmatex.bd`, `nusrat@padmatex.bd`, `sabbir@auditca.bd`, `rafiq@padmatex.bd`
for tenant *padma-textiles*, plus `ruhul@rupalisteel.bd` for the isolation-proof
tenant *rupali-steel* — password `ComplyBD#2026`; **change or remove these before
any real deployment**). SSO emails must match a provisioned user — nothing is
auto-created. Without a session the sandbox still offers the clearly-badged DEMO
persona switcher (cookie role) inside the demo tenant.

## 7. Troubleshooting deploys

- **Build fails with `Cannot find module '.prisma/client/default'`** (Render log:
  `Failed to load external module @prisma/client-…`, then
  `Failed to collect page data for /api/reconciliation`) — the Prisma client was
  never generated on the build machine. The repository now fixes this at two
  layers: a `postinstall` hook runs `prisma generate` after every install, and
  `npm run build` regenerates the correct client first. Make sure the deployed
  commit includes that fix; if a manually-created Render service still fails,
  set its Build Command to
  `bun install && bunx prisma generate && bunx prisma db push && npm run build`.
- **`Failed to collect page data`** for an API route — almost always the Prisma
  client missing/mismatched at build time (see above), not a bug in that route.
- **Runtime 500s on a fresh Render disk** — the database was never seeded. Run
  the seed once via the Render Shell or a one-off Job (Option A step 4).
- **Build fails on a Postgres deployment with SQLite/Postgres engine mismatch**
  — the build must run `bun run build` (which detects the `postgres://` URL and
  generates the Postgres client), not a bare `next build` that reuses a stale
  SQLite-flavoured client.

## 8. Post-deploy checklist

Hit these endpoints (they should all return **200**) and open the dashboard:

- [ ] `GET /api/dashboard` — portfolio stats JSON (also the Render health check)
- [ ] `GET /api/compliance-engine` — rule-engine verdicts (`?asOf=YYYY-MM-DD` optional)
- [ ] `GET /api/reconciliation` — register vs. engine cross-check
- [ ] Dashboard UI renders with KPI cards, regulator breakdown and the *Export & Deploy* card
- [ ] (Render + SQLite only) seed once via Shell/Job, then re-check `/api/dashboard` shows data
- [ ] `GET /api/export` downloads `complybd-platform-<date>.zip`
- [ ] **Sign-in works** — *Sign in* → `nusrat@padmatex.bd` / `ComplyBD#2026`; the header shows the
      identity chip and the demo persona switcher disappears (a provisioned role is not a costume)
- [ ] **Isolation** — sign in as `ruhul@rupalisteel.bd` and verify a different obligation register
      (or run `bun run verify:isolation` locally against the same database)
- [ ] **Alerts** — Compliance Engine → *Engine-health alerts* shows OPEN items for unverified
      rules / gaps; acknowledging one records an auditable note
- [ ] CI green on GitHub — lint, typecheck, seed reconciliation, tenant-isolation checks and the
      Postgres 16 push + seed job all pass

## Reference

- Local dev: `bun install` → `bun run db:push` → `bun run db:seed` → `bun run dev`
- Checks: `bun run lint` · `bun run typecheck` · `bun run verify:isolation` · `bun run db:generate:pg`
- Prisma schema: `prisma/schema.prisma` · Seed: `prisma/seed.ts`
- Not legal advice — every regulatory row in the platform carries its source-review
  status; confirm deadlines and citations against the primary sources
  (bdlaws.minlaw.gov.bd, rjsc.gov.bd, bsec.gov.bd, nbr.gov.bd, bb.org.bd) before reliance.
