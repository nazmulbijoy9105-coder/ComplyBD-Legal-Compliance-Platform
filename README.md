# ComplyBD — Legal Compliance Platform (Bangladesh)

A legal compliance platform for **Bangladesh public limited listed companies**.
It turns the country's statutory filing landscape into a working register: every
obligation carries a legal basis, a source-review status and a deadline that the
versioned rule engine computes and replays by as-of date.

## What's inside

- **Obligations register + compliance calendar** — workflow (Draft → In Progress →
  In Review → Approved → Filed), overdue alerts, regulator-wise status
- **Versioned rule engine** — rules stored in the DB with effective windows and
  approval provenance; applicability gates, deadline formulas, as-of replay
- **Verification / review / change queues** — rule verification, review decisions,
  change pipeline (amendments append new versions, never edits)
- **Need-to-know access log** — 4 acting roles with classification clearances;
  sensitive reads are masked/denied and every attempt is audited
- **Regulatory map** — 7 regulators (RJSC, BSEC, DSE/CSE, NBR, DOL, BB, NDGA),
  legal instruments, VERIFIED / PARTIAL / UNVERIFIED source-review status
- **ZIP export** — `GET /api/export` streams the whole source for GitHub/deployment
  (see `DEPLOY.md` for Render + Vercel guides)

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui · Prisma (SQLite at
`db/custom.db`) · managed with bun

## Run it

```bash
bun install
bun run db:push        # create/sync the SQLite database
bun prisma/seed.ts     # load Regulatory Mapping v2 dataset (wipes existing data)
bun run dev            # http://localhost:3000
```

Environment: copy `.env.example` to `.env` and adjust `DATABASE_URL`.

## Deploy

See **[DEPLOY.md](./DEPLOY.md)** — Render Blueprint (SQLite on a persistent disk),
Vercel (switch to Postgres), or a split topology. The *Export & Deploy* card on the
dashboard downloads the full source ZIP ready to push to GitHub.

> Reference data only, not legal advice — confirm every deadline and citation against
> the primary sources (bdlaws.minlaw.gov.bd, rjsc.gov.bd, bsec.gov.bd, nbr.gov.bd,
> bb.org.bd) before reliance.
# ComplyBD-Legal-Compliance-Platform
