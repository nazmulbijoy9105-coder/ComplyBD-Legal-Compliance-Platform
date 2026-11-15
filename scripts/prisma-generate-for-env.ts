/**
 * Generate the correct Prisma client for the target database.
 *
 * The canonical schema is prisma/schema.prisma (SQLite — local dev, Render
 * + persistent disk). Production Postgres deployments (Render Postgres,
 * Neon, Supabase) need the derived prisma/schema.postgres.prisma client —
 * a SQLite-flavoured client pointed at a Postgres URL fails at runtime
 * with an engine mismatch, which is exactly the class of failure that
 * breaks builds deploys late and silently.
 *
 * This script reads DATABASE_URL and picks the schema:
 *   postgres://… or postgresql://…  → derive + generate the Postgres client
 *   anything else (incl. unset)     → generate the canonical SQLite client
 *
 * Run from package.json "build" (and safe to run anywhere bun exists):
 *   bun scripts/prisma-generate-for-env.ts
 */
import { execSync } from 'node:child_process'

function run(cmd: string): void {
  console.log(`[prisma-generate-for-env] ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

const url = process.env.DATABASE_URL ?? ''
const isPostgres = /^postgres(ql)?:\/\//i.test(url)

if (isPostgres) {
  console.log('[prisma-generate-for-env] DATABASE_URL is Postgres — generating the postgres client')
  run('bun scripts/generate-pg-schema.ts')
  run('bunx prisma generate --schema prisma/schema.postgres.prisma')
} else {
  console.log('[prisma-generate-for-env] DATABASE_URL is SQLite (or unset) — generating the canonical client')
  run('bunx prisma generate')
}
