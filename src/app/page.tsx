'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays,
  ClipboardList,
  Cog,
  LayoutDashboard,
  Map as MapIcon,
  MessagesSquare,
  Scale,
  FolderLock,
  Bell,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewId } from '@/lib/types'
import { ROLE_OPTIONS } from '@/components/platform/role-options'
import DashboardView from '@/components/platform/dashboard-view'
import CalendarView from '@/components/platform/calendar-view'
import ObligationsView from '@/components/platform/obligations-view'
import RegulatoryMapView from '@/components/platform/regulatory-map-view'
import ComplianceEngineView from '@/components/platform/compliance-engine-view'
import DocumentsView from '@/components/platform/documents-view'
import AssistantView from '@/components/platform/assistant-view'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { AuthBar, useAuthSession } from '@/components/platform/auth-menu'

const NAV_ITEMS: {
  id: ViewId
  label: string
  icon: React.ComponentType<{ className?: string }>
  hint: string
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Portfolio overview' },
  { id: 'calendar', label: 'Compliance Calendar', icon: CalendarDays, hint: 'Statutory due dates' },
  { id: 'obligations', label: 'Obligations Register', icon: ClipboardList, hint: 'Filings & workflow' },
  { id: 'regulatory-map', label: 'Regulatory Map', icon: MapIcon, hint: 'Legal basis reference' },
  { id: 'compliance-engine', label: 'Compliance Engine', icon: Cog, hint: 'Rules × facts × as-of · queues' },
  { id: 'documents', label: 'Document Vault', icon: FolderLock, hint: 'Classified evidence' },
  { id: 'assistant', label: 'AI Compliance Assistant', icon: MessagesSquare, hint: 'Ask the register' },
]

const VIEW_TITLES: Record<ViewId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Compliance Dashboard', subtitle: 'Padma Textiles & Apparels Ltd. — DSE: PADMATEX' },
  calendar: { title: 'Compliance Calendar', subtitle: 'Statutory due dates & scheduled filings' },
  obligations: { title: 'Obligations Register', subtitle: 'Workflow: Draft → In Progress → In Review → Approved → Filed' },
  'regulatory-map': { title: 'Bangladesh Regulatory Map', subtitle: 'v2 · source-reviewed · every row carries legal basis + verification' },
  'compliance-engine': { title: 'Compliance Engine', subtitle: 'Versioned rules · worst-severity rating · verification, review & change pipelines · replayable by as-of date' },
  documents: { title: 'Document Vault', subtitle: 'Versioned, classified evidence store' },
  assistant: { title: 'AI Compliance Assistant', subtitle: 'Grounded in the source-reviewed regulatory register' },
}

function SidebarNav({
  active,
  onSelect,
  overdue,
  onDone,
  identity,
}: {
  active: ViewId
  onSelect: (v: ViewId) => void
  overdue: number
  onDone?: () => void
  identity?: { name: string; roleLabel: string; tenantName?: string }
}) {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-300">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Scale className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-white">ComplyBD</div>
          <div className="text-[11px] text-slate-400">Legal Compliance Platform</div>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3" aria-label="Platform navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item.id)
                onDone?.()
              }}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                isActive
                  ? 'bg-slate-800 text-white ring-1 ring-slate-700'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300',
                )}
              />
              <span className="flex-1">
                <span className="block font-medium leading-tight">{item.label}</span>
                <span className="block text-[11px] leading-tight text-slate-500">{item.hint}</span>
              </span>
              {item.id === 'obligations' && overdue > 0 && (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-400 ring-1 ring-rose-500/30">
                  {overdue}
                </span>
              )}
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 shrink-0 transition-opacity',
                  isActive ? 'opacity-60' : 'opacity-0 group-hover:opacity-40',
                )}
              />
            </button>
          )
        })}
      </nav>

      <div className="border-t border-slate-800/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-emerald-300">
            {(identity?.name ?? 'Nusrat Jahan')
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-200">{identity?.name ?? 'Nusrat Jahan'}</div>
            <div className="truncate text-[11px] text-slate-500">
              {identity ? `${identity.roleLabel}${identity.tenantName ? ` · ${identity.tenantName}` : ''}` : 'Compliance Officer'}
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
          Regulatory Mapping v2 · 7 regulators · every statutory row carries a source-review status
          (VERIFIED / PARTIAL / UNVERIFIED). Need-to-know is enforced with access logging — switch
          your acting role from the header; sensitive reads are logged, allowed or denied.
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [view, setView] = useState<ViewId>('dashboard')
  const [overdue, setOverdue] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { session } = useAuthSession()
  const identity = session?.authenticated
    ? {
        name: session.name ?? 'Signed in',
        roleLabel: ROLE_OPTIONS.find((r) => r.id === session.role)?.label ?? (session.role ?? ''),
      }
    : undefined

  const refreshBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) return
      const data = await res.json()
      setOverdue(data.stats?.overdue ?? 0)
    } catch {
      // badge refresh is best-effort
    }
  }, [])

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setOverdue(data.stats?.overdue ?? 0)
      })
      .catch(() => undefined)
  }, [])

  const meta = VIEW_TITLES[view]

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 lg:block" aria-label="Sidebar">
        <SidebarNav active={view} onSelect={setView} overdue={overdue} identity={identity} />
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col lg:min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 lg:py-4">
            {/* mobile nav trigger */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open navigation" className="shrink-0 lg:hidden">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <line x1="4" x2="20" y1="6" y2="6" />
                    <line x1="4" x2="20" y1="12" y2="12" />
                    <line x1="4" x2="20" y1="18" y2="18" />
                  </svg>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-0 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>ComplyBD platform navigation</SheetDescription>
                </SheetHeader>
                <SidebarNav
                  active={view}
                  onSelect={setView}
                  overdue={overdue}
                  onDone={() => setMobileNavOpen(false)}
                  identity={identity}
                />
              </SheetContent>
            </Sheet>
            {/* mobile logo */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <Scale className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-sm font-bold text-slate-900">ComplyBD</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {meta.title}
              </h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{meta.subtitle}</p>
            </div>
            <div className="ms-auto flex items-center gap-2">
              {overdue > 0 && (
                <span className="hidden items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 sm:inline-flex">
                  <Bell className="h-3.5 w-3.5" />
                  {overdue} overdue filing{overdue === 1 ? '' : 's'}
                </span>
              )}
              <AuthBar />
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                15 Nov 2026
              </span>
            </div>
          </div>
        </header>

        {/* View container */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {view === 'dashboard' && <DashboardView onDataChange={refreshBadges} />}
          {view === 'calendar' && <CalendarView />}
          {view === 'obligations' && <ObligationsView onDataChange={refreshBadges} />}
          {view === 'regulatory-map' && <RegulatoryMapView />}
          {view === 'compliance-engine' && <ComplianceEngineView />}
          {view === 'documents' && <DocumentsView />}
          {view === 'assistant' && <AssistantView />}
        </main>

        {/* Sticky footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white">
          <div className="flex flex-col gap-2 px-4 py-4 text-[11px] leading-relaxed text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <p>
              <span className="font-semibold text-slate-700">ComplyBD</span> — Legal Compliance
              Platform · Bangladesh jurisdiction · Public Ltd Listed Companies
            </p>
            <p className="max-w-3xl lg:text-right">
              Every statutory row carries the same source-review caveats as the Regulatory Map
              (Regulatory Mapping v2, source-reviewed 15 Nov 2026) —{' '}
              <span className="font-semibold text-emerald-700">VERIFIED</span>,{' '}
              <span className="font-semibold text-orange-700">PARTIAL</span> or{' '}
              <span className="font-semibold text-amber-700">UNVERIFIED</span>. All of it is
              reference data only: confirm deadlines and citations against the primary sources
              (bdlaws.minlaw.gov.bd, rjsc.gov.bd, bsec.gov.bd, nbr.gov.bd, bb.org.bd) before
              reliance. Not legal advice.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
