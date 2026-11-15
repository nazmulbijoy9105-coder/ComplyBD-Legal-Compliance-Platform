/**
 * Generate the production Postgres schema from the canonical SQLite schema.
 *
 * The canonical source of truth is prisma/schema.prisma. This script swaps
 * ONLY the datasource provider into prisma/schema.postgres.prisma. The model
 * layer is deliberately portable:
 *   - no Prisma `Json` types  (JSON blobs stored as String — portable)
 *   - no Prisma enums         (states stored as String — portable)
 *   - no native @db.* types
 * so a one-line provider swap is the whole migration.
 *
 * Run: bun scripts/generate-pg-schema.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const src = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')

if (!/provider\s*=\s*"sqlite"/.test(src)) {
  console.error('canonical schema is not sqlite — refusing to derive the postgres variant')
  process.exit(1)
}

const header = [
  '// GENERATED FILE — do not edit. Source: prisma/schema.prisma',
  '// Regenerate with: bun scripts/generate-pg-schema.ts',
  '// Only the datasource provider differs (postgresql for production).',
  '',
].join('\n')

const out =
  header +
  src
    .replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"')
    .replace(/url\s*=\s*env\("DATABASE_URL"\)/, 'url      = env("DATABASE_URL") // postgres://… in production')

writeFileSync(join(ROOT, 'prisma/schema.postgres.prisma'), out)
console.log('prisma/schema.postgres.prisma written (postgresql provider, identical models)')
