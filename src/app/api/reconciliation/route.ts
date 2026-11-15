import { NextResponse, type NextRequest } from 'next/server'
import { reconcileCatalogue } from '@/lib/reconciliation'
import { resolveIdentity, deniedResponse } from '@/lib/identity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── GET /api/reconciliation ─────────────────────────────────
// Proves seed = engine = database: every statutory rule ID exists
// on all three layers with an identical definition, and every
// engine join (obligation → rule → regulator) resolves.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const report = await reconcileCatalogue(identity.tenantId)
  return NextResponse.json(report)
}
