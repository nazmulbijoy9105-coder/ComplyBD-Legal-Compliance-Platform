// ─────────────────────────────────────────────────────────────
// GET /api/export — one-click ZIP of the whole platform source.
//
// This archive is what the operator pushes to GitHub: the versioned rule
// engine, seed data, UI, configs and the deployment kit (render.yaml,
// vercel.json, DEPLOY.md, .env.example). Runtime state is deliberately NOT
// shipped — the SQLite database, dev/server logs and local secret files are
// excluded, and heavy or generated trees (node_modules, .next, .git, agent
// scratch space) are pruned from the walk.
//
// The archive is built into a temp file (os tmpdir), then read back and
// returned as an attachment. The distribution event is written to the
// AccessLog, allowed or denied — same audit trail as every other route.
// ─────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from 'next/server'
import { ZipArchive } from 'archiver'
import { createWriteStream } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { resolveIdentity, deniedResponse } from '@/lib/identity'
import { logAccess } from '@/lib/access-control'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PROJECT_ROOT = process.cwd()

// Heavy or generated trees pruned from the walk entirely (readdir-glob
// `skip`: the directory itself is neither traversed nor emitted).
const SKIP_DIRS = ['node_modules', '.next', '.git', 'tool-results', 'download', 'agent-ctx']

// Files that must never ship: runtime logs, the SQLite database and local
// secret files. The redundant dir patterns are a safety net alongside SKIP_DIRS.
const IGNORE_PATTERNS = [
  '**/*.log',
  'db/custom.db',
  'db/custom.db-shm',
  'db/custom.db-wal',
  '.env',
  '.env.local',
  '.env.*.local',
  'node_modules/**',
  '.next/**',
  '.git/**',
  'tool-results/**',
  'download/**',
  'agent-ctx/**',
]

/** Build the source ZIP into tmpPath; resolves with the number of entries written. */
function zipProjectTo(tmpPath: string): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(tmpPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })
    let settled = false
    let entriesTotal = 0

    const fail = (err: unknown) => {
      if (settled) return
      settled = true
      reject(err instanceof Error ? err : new Error(String(err)))
    }

    output.on('error', fail)
    archive.on('error', fail)
    archive.on('progress', (progress) => {
      entriesTotal = progress.entries.total
    })
    archive.on('warning', (err) => {
      // ENOENT means a file vanished mid-walk (dev.log churns during dev) —
      // non-fatal. Any other warning is a real packaging problem.
      if (err.code !== 'ENOENT') fail(err)
    })
    output.on('close', () => {
      if (!settled) {
        settled = true
        resolvePromise(entriesTotal)
      }
    })

    archive.pipe(output)
    archive.glob('**/*', {
      cwd: PROJECT_ROOT,
      dot: true,
      skip: SKIP_DIRS,
      ignore: IGNORE_PATTERNS,
    })
    archive.finalize().then(
      () => undefined, // completion is signaled by the output stream closing
      fail,
    )
  })
}

// ── GET /api/export ──────────────────────────────────────────
export async function GET(request: NextRequest): Promise<NextResponse> {
  const identity = await resolveIdentity(request)
  const denied = deniedResponse(identity)
  if (denied) return NextResponse.json(denied, { status: 403 })
  const role = identity.roleDef
  const tmpPath = resolve(tmpdir(), `complybd-export-${process.pid}-${Date.now()}.zip`)

  try {
    const entries = await zipProjectTo(tmpPath)
    const zipBuffer = await readFile(tmpPath)
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

    await logAccess({
      tenantId: identity.tenantId,
      actor: identity.actor,
      role: role.id,
      action: 'EXPORT_PROJECT_ZIP',
      resource: '/api/export',
      detail: `${entries} entries · ${(zipBuffer.byteLength / (1024 * 1024)).toFixed(1)} MB source snapshot — runtime DB excluded`,
      classification: 'INTERNAL',
      outcome: 'ALLOWED',
      reason: 'Source distribution: the whole platform (versioned rule engine, seed data, UI, deployment kit) as a pushable ZIP — no runtime database, logs or secrets inside.',
    })

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="complybd-platform-${stamp}.zip"`,
        'Content-Length': String(zipBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[export] failed to build project ZIP archive', error)
    await logAccess({
      tenantId: identity.tenantId,
      actor: identity.actor,
      role: role.id,
      action: 'EXPORT_PROJECT_ZIP',
      resource: '/api/export',
      detail: 'archive build failed',
      classification: 'INTERNAL',
      outcome: 'DENIED',
      reason: 'ZIP archive could not be built — failure logged to the server trail.',
    })
    return NextResponse.json({ error: 'Failed to build the project ZIP archive' }, { status: 500 })
  } finally {
    await rm(tmpPath, { force: true })
  }
}
