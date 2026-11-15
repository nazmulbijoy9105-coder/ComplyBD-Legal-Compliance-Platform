'use client'

import { useCallback, useEffect, useState } from 'react'
import { signIn, signOut } from 'next-auth/react'
import { LogIn, LogOut, ShieldCheck, KeyRound, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROLE_OPTIONS } from './role-options'

// ─────────────────────────────────────────────────────────────
// Real authentication for SaaS mode (NextAuth v4) with a clean
// demo fallback:
//   * signed-in  → the identity chip: name · provisioned role · tenant,
//                  and a Sign out action. The demo role switcher is
//                  hidden — a provisioned role is not a costume.
//   * signed-out → the demo persona switcher + a Sign in dialog with
//                  credentials AND any configured SSO buttons.
// ─────────────────────────────────────────────────────────────

export interface AuthSession {
  authenticated: boolean
  id?: string
  name?: string | null
  email?: string | null
  role?: string
  tenantName?: string | null
}

/** NextAuth session payload shape: { user: { id, name, email, role, tenantName… }, expires }. */
interface NextAuthSessionPayload {
  user?: { id?: string; name?: string | null; email?: string | null; role?: string; tenantName?: string | null }
  expires?: string
}

export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' })
      const data = (await res.json()) as NextAuthSessionPayload
      // NextAuth returns {} when unauthenticated; a signed session carries user.id.
      if (data?.user?.id) {
        setSession({
          authenticated: true,
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          tenantName: data.user.tenantName,
        })
      } else {
        setSession({ authenticated: false })
      }
    } catch {
      setSession({ authenticated: false })
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener('complybd-auth', handler)
    return () => window.removeEventListener('complybd-auth', handler)
  }, [refresh])

  return { session, ready, refresh }
}

function LoginDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sso, setSso] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/auth/providers', { cache: 'no-store' })
        const providers = (await res.json()) as Record<string, { id: string; name: string }>
        if (!cancelled) setSso(Object.values(providers ?? {}).filter((p) => p.id !== 'credentials'))
      } catch {
        if (!cancelled) setSso([])
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open])

  const submit = async () => {
    setBusy(true)
    setError(null)
    const res = await signIn('credentials', { email, password, redirect: false })
    setBusy(false)
    if (res?.error) {
      setError('Sign-in failed — check the email and password, or ask your administrator to provision the account.')
      return
    }
    window.dispatchEvent(new Event('complybd-auth'))
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Sign in to ComplyBD
          </DialogTitle>
          <DialogDescription className="text-xs">
            Provisioned accounts only — there is no self-signup. SSO (Google / Azure AD / Okta) activates when your
            deployment configures it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {sso.length > 0 && (
            <div className="space-y-2">
              {sso.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  className="w-full justify-center text-xs"
                  onClick={() => signIn(p.id)}
                >
                  Continue with {p.name}
                </Button>
              ))}
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200" /> or email &amp; password <span className="h-px flex-1 bg-slate-200" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="auth-email" className="text-xs font-semibold text-slate-600">Work email</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nusrat@padmatex.bd"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password" className="text-xs font-semibold text-slate-600">Password</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && email && password) submit()
              }}
              placeholder="••••••••"
              className="h-9 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">{error}</p>
          )}

          <p className="text-[11px] leading-relaxed text-slate-400">
            Demo accounts (seeded): <span className="font-mono">tanvir@padmatex.bd</span>,{' '}
            <span className="font-mono">nusrat@padmatex.bd</span>, <span className="font-mono">sabbir@auditca.bd</span>,{' '}
            <span className="font-mono">rafiq@padmatex.bd</span> — password{' '}
            <span className="font-mono">ComplyBD#2026</span>. Change these before any real deployment.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={submit} disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AuthBar() {
  const { session, ready } = useAuthSession()
  const [loginOpen, setLoginOpen] = useState(false)

  if (!ready) {
    return <div className="h-8 w-40 animate-pulse rounded-full bg-slate-100" aria-hidden />
  }

  if (session?.authenticated) {
    const roleLabel = ROLE_OPTIONS.find((r) => r.id === session.role)?.label ?? session.role
    const initials = (session.name ?? '?')
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2 py-1 ring-1 ring-emerald-200">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white" aria-hidden>
          {initials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-[11px] font-semibold leading-tight text-slate-800">{session.name}</span>
          <span className="block truncate text-[10px] leading-tight text-slate-500">{roleLabel}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px] text-slate-500 hover:text-slate-800"
          onClick={async () => {
            await signOut({ redirect: false })
            window.dispatchEvent(new Event('complybd-auth'))
            window.location.reload()
          }}
        >
          <LogOut className="h-3 w-3" aria-hidden /> Sign out
        </Button>
      </div>
    )
  }

  // Demo fallback — persona switcher + sign-in affordance.
  return (
    <div className="flex items-center gap-2">
      <DemoRoleSwitcher />
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
        onClick={() => setLoginOpen(true)}
      >
        <LogIn className="h-3.5 w-3.5" aria-hidden /> Sign in
      </Button>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  )
}

// The demo persona switcher (cookie role) — kept for the sandbox preview
// and clearly badged as demo so the audit trail distinguishes the two.
function DemoRoleSwitcher() {
  const [role, setRole] = useState('COMPLIANCE_OFFICER')

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const match = document.cookie.match(/(?:^|;\s*)complybd_role=([^;]+)/)
      if (match) setRole(decodeURIComponent(match[1]))
    })
    return () => window.cancelAnimationFrame(id)
  }, [])

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1 ring-1 ring-slate-200">
      <KeyRound className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      <span className="hidden text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:inline">Demo</span>
      <select
        aria-label="Acting role (need-to-know demo persona)"
        value={role}
        onChange={(e) => {
          const next = e.target.value
          fetch('/api/access-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ROLE_SWITCH', to: next }),
          })
            .catch(() => undefined)
            .finally(() => {
              document.cookie = `complybd_role=${next}; path=/; max-age=${7 * 24 * 3600}; samesite=strict`
              window.location.reload()
            })
        }}
        className="h-7 cursor-pointer rounded border-0 bg-transparent text-[11px] font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500/40"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <Building2 className="hidden h-3 w-3 text-slate-300 sm:inline" aria-hidden />
    </div>
  )
}
