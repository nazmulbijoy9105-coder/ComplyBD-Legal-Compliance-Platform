'use client'

// ─────────────────────────────────────────────────────────────
// Export & Deploy — one-click ZIP of the whole platform source.
// The card fetches /api/export (relative path only), turns the
// response into a blob and triggers a browser download; the ZIP
// is ready to push to GitHub and ships with the deployment kit
// documented in DEPLOY.md (Render backend + Vercel frontend).
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Download, Loader2, PackageOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const KIT_FILES = ['render.yaml', 'vercel.json', 'DEPLOY.md', '.env.example', 'prisma/seed.ts']

export default function ExportCard() {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function downloadZip() {
    setDownloading(true)
    setError(null)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) throw new Error(`Export request failed (HTTP ${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `complybd-platform-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed — check the server trail.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
          <PackageOpen className="h-4 w-4 text-slate-400" />
          Export &amp; Deploy
        </CardTitle>
        <p className="text-[11px] leading-relaxed text-slate-500">
          One-click ZIP of the entire platform source — versioned rules, engine, seed and the deployment kit — ready to
          push to GitHub. Deploy the full app (SQLite on a persistent disk) with Render, or the frontend + API routes on
          Vercel with Postgres — the step-by-step guide lives in <span className="font-mono">DEPLOY.md</span>.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {KIT_FILES.map((f) => (
            <span
              key={f}
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500"
            >
              {f}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={downloadZip}
            disabled={downloading}
            className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
          >
            {downloading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            {downloading ? 'Packaging project…' : 'Download project ZIP'}
          </Button>
          <span className="text-[10px] text-slate-400">
            Excludes node_modules, .next, dev logs and the runtime database.
          </span>
        </div>
        {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
      </CardContent>
    </Card>
  )
}
