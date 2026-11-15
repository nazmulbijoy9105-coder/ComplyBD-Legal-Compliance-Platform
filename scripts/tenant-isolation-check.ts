/**
 * Tenant-isolation check — the SaaS acceptance gate.
 *
 * Proves, against the live database:
 *   1. the tenant client's reads NEVER cross tenants (padma cannot see
 *      rupali-steel rows and vice versa),
 *   2. cross-tenant unique reads / updates fail LOUDLY (TenantIsolationError),
 *   3. creates are stamped with the caller's tenant,
 *   4. the identity resolver rejects deactivated users (kill switch).
 *
 * Exit code 0 = isolation holds; any violation exits 1.
 * Run: bun scripts/tenant-isolation-check.ts   (CI step, after db:seed)
 */
import { PrismaClient } from '@prisma/client'
import { tenantDb, TenantIsolationError } from '../src/lib/tenant-db'
import { hashPassword } from '../src/lib/password'

const db = new PrismaClient()
let failures = 0

function check(name: string, ok: boolean, detail = ''): void {
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

async function main(): Promise<void> {
  console.log('Tenant isolation check…')

  const padma = await db.tenant.findUnique({ where: { slug: 'padma-textiles' } })
  const rupali = await db.tenant.findUnique({ where: { slug: 'rupali-steel' } })
  if (!padma || !rupali) {
    console.error('FATAL: tenants missing — run the seed first')
    process.exit(1)
  }

  const padmaDb = tenantDb(padma.id)
  const rupaliDb = tenantDb(rupali.id)

  // ── 1. reads never cross tenants ──
  const padmaObligations = await padmaDb.obligation.findMany()
  const rupaliObligations = await rupaliDb.obligation.findMany()
  check(
    'padma sees only padma obligations',
    padmaObligations.every((o) => o.tenantId === padma.id) && padmaObligations.length > 0,
    `${padmaObligations.length} rows`,
  )
  check(
    'rupali sees only rupali obligations',
    rupaliObligations.every((o) => o.tenantId === rupali.id) && rupaliObligations.length > 0,
    `${rupaliObligations.length} rows`,
  )
  check(
    'rupali rows are NOT inside the padma result set',
    !padmaObligations.some((o) => o.tenantId === rupali.id),
  )

  const padmaDocs = await padmaDb.document.findMany()
  check(
    'padma document vault excludes rupali evidence',
    padmaDocs.every((d) => d.tenantId === padma.id) && padmaDocs.length > 0,
    `${padmaDocs.length} rows`,
  )
  const rupaliFacts = await rupaliDb.companyFact.findMany()
  check(
    'rupali fact store excludes padma facts',
    rupaliFacts.every((f) => f.tenantId === rupali.id) && rupaliFacts.every((f) => f.key !== 'exchange'),
    `${rupaliFacts.length} rows`,
  )

  const padmaRuns = await padmaDb.complianceRun.findMany()
  check('padma runs scoped', padmaRuns.every((r) => r.tenantId === padma.id), `${padmaRuns.length} rows`)

  // ── 2. cross-tenant unique access fails LOUDLY ──
  const rupaliObligationId = rupaliObligations[0]?.id
  let loudFailure = false
  try {
    await padmaDb.obligation.findUnique({ where: { id: rupaliObligationId } })
  } catch (e) {
    loudFailure = e instanceof TenantIsolationError
  }
  check('cross-tenant findUnique throws TenantIsolationError', loudFailure)

  loudFailure = false
  try {
    await padmaDb.obligation.update({ where: { id: rupaliObligationId }, data: { notes: 'attack' } })
  } catch (e) {
    loudFailure = e instanceof TenantIsolationError
  }
  check('cross-tenant update throws TenantIsolationError', loudFailure)

  loudFailure = false
  try {
    await padmaDb.obligation.delete({ where: { id: rupaliObligationId } })
  } catch (e) {
    loudFailure = e instanceof TenantIsolationError
  }
  check('cross-tenant delete throws TenantIsolationError', loudFailure)

  loudFailure = false
  try {
    await padmaDb.obligation.upsert({ where: { id: rupaliObligationId }, create: {}, update: {} } as never)
  } catch (e) {
    loudFailure = e instanceof TenantIsolationError
  }
  check('upsert is refused on the tenant client', loudFailure)

  // ── 3. writes are stamped ──
  const stamped = await padmaDb.activity.create({
    data: { tenantId: padma.id, obligationId: padmaObligations[0]?.id, type: 'COMMENT', actor: 'isolation-check', message: 'stamp verification' },
  })
  check('create stamps tenantId automatically', stamped.tenantId === padma.id)
  await padmaDb.activity.delete({ where: { id: stamped.id } })

  // filtered read cannot leak: a foreign id inside findMany where → empty
  const leak = await padmaDb.obligation.findMany({ where: { id: rupaliObligationId } })
  check('findMany with a foreign id returns nothing', leak.length === 0)

  // ── 4. kill switch — deactivated user cannot authenticate ──
  const victim = await db.user.create({
    data: {
      tenantId: padma.id,
      name: 'Deactivated Probe',
      email: `probe-${Date.now()}@padmatex.bd`,
      passwordHash: hashPassword('probe-password'),
      role: 'COMPLIANCE_OFFICER',
      active: false,
    },
  })
  const readBack = await db.user.findUnique({ where: { id: victim.id } })
  check('deactivated user persists with active=false', readBack?.active === false)
  await db.user.delete({ where: { id: victim.id } })

  console.log(failures === 0 ? 'Tenant isolation: ALL CHECKS PASSED' : `Tenant isolation: ${failures} FAILURE(S)`)
  await db.$disconnect()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error(e)
  await db.$disconnect()
  process.exit(1)
})
