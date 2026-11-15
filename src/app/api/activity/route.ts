import { NextResponse, type NextRequest } from 'next/server'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { tenantDb } from '@/lib/tenant-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ActivityItem {
  id: string
  type: string
  actor: string
  message: string
  createdAt: string
  obligationId: string | null
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

// ── GET /api/activity?limit=20 ───────────────────────────────
// Tenant-scoped audit trail.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const user = tenantDb(identity.tenantId)

  const { searchParams } = new URL(request.url)

  let limit = DEFAULT_LIMIT
  const rawLimit = searchParams.get('limit')
  if (rawLimit !== null) {
    const parsed = Number.parseInt(rawLimit, 10)
    if (Number.isInteger(parsed)) {
      limit = Math.min(Math.max(parsed, 1), MAX_LIMIT)
    }
  }

  const rows = await user.activity.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      actor: true,
      message: true,
      createdAt: true,
      obligationId: true,
    },
  })

  const activity: ActivityItem[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    actor: row.actor,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    obligationId: row.obligationId,
  }))

  return NextResponse.json({ activity })
}
