// ─────────────────────────────────────────────────────────────
// Tenant-scoped Prisma client — row-level isolation at the data
// access layer. Every read is forced to the caller's tenantId,
// every write is stamped with it, and cross-tenant unique reads /
// updates / deletes fail LOUDLY (TenantIsolationError) instead of
// silently returning another tenant's row.
//
// Rules of the tenant client:
//   * findMany / findFirst / count / aggregate / groupBy → AND { tenantId }
//   * create → data.tenantId forced (nested creates are NOT stamped —
//     call sites must stamp nested rows explicitly)
//   * findUnique / update / delete on a unique id → ownership is
//     pre-verified with a tenant-scoped read; foreign rows throw
//   * upsert is refused — use find + create/update so tenancy is explicit
//
// GLOBAL models (Regulator, LegalInstrument, LegalInstrumentVersion,
// Tenant, User, Account, Session, VerificationToken) stay on the
// plain client — the law and identity are shared, domain data is not.
// ─────────────────────────────────────────────────────────────
import { Prisma, PrismaClient } from '@prisma/client'
import { db } from '@/lib/db'

const SCOPED_MODELS = new Set([
  'CompanyProfile',
  'CompanyFact',
  'ObligationTemplate',
  'Obligation',
  'Document',
  'Activity',
  'ComplianceRun',
  'ComplianceFinding',
  'ReviewDecision',
  'RuleVerification',
  'ChangeRequest',
  'AccessLog',
  'EngineAlert',
])

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TenantIsolationError'
  }
}

const READ_OPS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'])

/**
 * Build a tenant-scoped client. The result is shaped like PrismaClient
 * so route code keeps its existing types; behaviour differs only in the
 * tenancy enforcement described above.
 */
export function tenantDb(tenantId: string): PrismaClient {
  if (!tenantId) throw new TenantIsolationError('tenantDb requires a non-empty tenantId')

  const ext = db.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SCOPED_MODELS.has(model)) return query(args)
          const a = args as Record<string, unknown>

          // Refuse ambiguity: nested creates would bypass the stamp.
          if (operation === 'create' && a.data && typeof a.data === 'object') {
            a.data = { ...(a.data as Record<string, unknown>), tenantId }
            return query(a)
          }
          if (operation === 'createMany') {
            if (Array.isArray(a.data)) {
              a.data = a.data.map((row) => ({ ...(row as Record<string, unknown>), tenantId }))
            } else if (a.data && typeof a.data === 'object') {
              a.data = { ...(a.data as Record<string, unknown>), tenantId }
            }
            return query(a)
          }
          if (operation === 'upsert') {
            throw new TenantIsolationError(
              'tenantDb refuses upsert — use an explicit find + create/update so tenancy is enforced',
            )
          }
          if (READ_OPS.has(operation)) {
            a.where = { AND: [a.where ?? {}, { tenantId }] }
            return query(a)
          }
          // Unique-key operations (findUnique / findUniqueOrThrow / update /
          // delete): verify ownership first with a tenant-scoped read, then
          // either proceed or fail loudly.
          const plainClient = db as unknown as PrismaClient
          const modelName = model
          const modelDelegate = (plainClient as unknown as Record<string, { findFirst: (q: unknown) => Promise<unknown> }>)[modelName]
          const owned = await modelDelegate.findFirst({ where: { ...(a.where as object), tenantId } })
          if (!owned) {
            throw new TenantIsolationError(
              `${modelName}.${operation}: no row with that id belongs to tenant ${tenantId} — cross-tenant access blocked`,
            )
          }
          return query(a)
        },
      },
    },
  })

  return ext as unknown as PrismaClient
}

export type TenantClient = PrismaClient
