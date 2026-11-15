'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellRing, CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

// ─────────────────────────────────────────────────────────────
// Engine-health alerts — the anti-stale-GREEN surface. OPEN alerts
// come from the sweep on every compliance run: ENGINE_GAP (a rule the
// engine cannot evaluate), RULE_UNVERIFIED_STALE (in force unverified
// too long) and CHANGE_PENDING (circular awaiting decision too long).
// Webhook notification happens server-side; acknowledgement here is
// audited via the access log.
// ─────────────────────────────────────────────────────────────

interface AlertItem {
  id: string
  type: string
  refCode: string | null
  severity: string
  message: string
  status: string
  createdAt: string
  lastSeenAt?: string
  resolvedAt: string | null
}

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-50 text-red-800 ring-red-200',
  WARN: 'bg-amber-50 text-amber-900 ring-amber-200',
  INFO: 'bg-slate-50 text-slate-700 ring-slate-200',
}

const TYPE_LABEL: Record<string, string> = {
  ENGINE_GAP: 'Engine gap',
  RULE_UNVERIFIED_STALE: 'Rule unverified too long',
  CHANGE_PENDING: 'Circular pending decision',
}

export default function EngineAlertsCard({ refreshKey }: { refreshKey: string | null }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<AlertItem | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts', { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as { alerts: AlertItem[] }
        setAlerts(data.alerts ?? [])
      }
    } catch {
      // best-effort — the engine verdict card carries the authoritative state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const open = alerts.filter((a) => a.status === 'OPEN')
  const resolved = alerts.filter((a) => a.status === 'RESOLVED')

  const acknowledge = async () => {
    if (!resolving) return
    setBusy(true)
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resolving.id, note }),
      })
      setResolving(null)
      setNote('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-800">
          <span className="flex items-center gap-2">
            {open.length > 0 ? (
              <BellRing className="h-4 w-4 text-red-500" />
            ) : (
              <Bell className="h-4 w-4 text-emerald-600" />
            )}
            Engine-health alerts
            {open.length > 0 ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200">
                {open.length} open
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                clear
              </span>
            )}
          </span>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => load()}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs leading-relaxed text-slate-500">
          Raised on every compliance run — engine gaps, rules in force unverified for over 30 days, and circulars
          pending a decision for over 7 days. A stale <span className="font-semibold">GREEN</span> is the worst failure
          mode: alerts leave the server log and surface here (plus any configured{' '}
          <span className="font-mono text-[11px]">ALERT_WEBHOOK_URL</span>).
        </p>

        {open.map((a) => (
          <div key={a.id} className={`flex flex-wrap items-start gap-2 rounded-lg p-3 ring-1 ${SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.INFO}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="uppercase tracking-wide">{TYPE_LABEL[a.type] ?? a.type}</span>
                {a.refCode && <span className="font-mono text-[11px]">{a.refCode.slice(0, 14)}</span>}
                <span className="rounded px-1.5 py-0.5 text-[10px] ring-1 ring-current/20">{a.severity}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed opacity-90">{a.message}</p>
              <p className="mt-1 text-[10px] opacity-60">
                raised {new Date(a.createdAt).toLocaleString()} · last seen {a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString() : 'this run'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-0 bg-white/70 text-xs"
              onClick={() => {
                setResolving(a)
                setNote('')
              }}
            >
              <CheckCheck className="h-3 w-3" /> Acknowledge
            </Button>
          </div>
        ))}

        {open.length === 0 && !loading && (
          <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-emerald-200">
            No open alerts — the engine register is healthy at this as-of date. Resolved alerts: {resolved.length}.
          </p>
        )}

        {resolved.length > 0 && (
          <details className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">
              Resolved ({resolved.length}) — with resolution timestamps
            </summary>
            <div className="mt-2 space-y-1.5">
              {resolved.map((a) => (
                <div key={a.id} className="text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">{TYPE_LABEL[a.type] ?? a.type}</span>
                  {a.refCode ? <span className="font-mono"> · {a.refCode.slice(0, 14)}</span> : null} · resolved{' '}
                  {a.resolvedAt ? new Date(a.resolvedAt).toLocaleString() : '—'}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>

      <Dialog open={resolving !== null} onOpenChange={(v) => !v && setResolving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Acknowledge alert</DialogTitle>
            <DialogDescription className="text-xs">
              {resolving ? `${TYPE_LABEL[resolving.type] ?? resolving.type}${resolving.refCode ? ` — ${resolving.refCode.slice(0, 14)}` : ''}` : ''}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was done about it (recorded in the audit trail)…"
            className="min-h-[80px] text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={acknowledge}
              disabled={busy || note.trim().length < 3}
            >
              {busy ? 'Recording…' : 'Record acknowledgement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
