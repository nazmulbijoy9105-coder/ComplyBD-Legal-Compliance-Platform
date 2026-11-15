'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { CalendarData } from '@/lib/types'
import { regulatorTheme } from '@/lib/regulator-theme'
import { RegulatorChip, StatusBadge, VerificationBadge } from './badges'
import ObligationDetailSheet from './obligation-detail-sheet'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export default function CalendarView() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-12
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [regulator, setRegulator] = useState('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?year=${year}&month=${month}`)
      if (!res.ok) throw new Error('failed')
      setData(await res.json())
    } catch {
      setData({ events: [], monthSummary: { total: 0, overdue: 0, filed: 0, open: 0 } })
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    load()
  }, [load])

  const events = useMemo(
    () => (data?.events ?? []).filter((e) => regulator === 'ALL' || e.regulatorCode === regulator),
    [data, regulator],
  )

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1))
    const startOffset = (first.getUTCDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const list: (number | null)[] = []
    for (let i = 0; i < startOffset; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) list.push(d)
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [year, month])

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarData['events']>()
    for (const e of events) {
      const d = new Date(e.dueDate)
      const day = d.getDate()
      const arr = map.get(day) ?? []
      arr.push(e)
      map.set(day, arr)
    }
    return map
  }, [events])

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, month - 1, 1))
    d.setUTCMonth(d.getUTCMonth() + delta)
    setYear(d.getUTCFullYear())
    setMonth(d.getUTCMonth() + 1)
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setYear(today.getFullYear())
              setMonth(today.getMonth() + 1)
            }}
            className="text-xs"
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">{monthLabel}</h2>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Select value={regulator} onValueChange={setRegulator}>
            <SelectTrigger className="h-9 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All regulators</SelectItem>
              <SelectItem value="RJSC">RJSC</SelectItem>
              <SelectItem value="BSEC">BSEC</SelectItem>
              <SelectItem value="DSECSE">DSE &amp; CSE</SelectItem>
              <SelectItem value="NBR">NBR</SelectItem>
              <SelectItem value="DOL">Dept. of Labour</SelectItem>
              <SelectItem value="BB">Bangladesh Bank</SelectItem>
              <SelectItem value="NDGA">NDGA</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Month summary */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
          {data?.monthSummary.total ?? 0} filings
        </span>
        <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-600 ring-1 ring-rose-200">
          {data?.monthSummary.overdue ?? 0} overdue
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">
          {data?.monthSummary.filed ?? 0} filed
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">
          {data?.monthSummary.open ?? 0} open
        </span>
      </div>

      {loading && !data ? (
        <Skeleton className="h-[420px] rounded-xl" />
      ) : (
        <>
          {/* Month grid */}
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardContent className="p-2 sm:p-3">
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200 text-[10px]">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="bg-slate-50 py-1.5 text-center font-bold uppercase tracking-wider text-slate-400">
                    <span className="hidden sm:inline">{d}</span>
                    <span className="sm:hidden">{d[0]}</span>
                  </div>
                ))}
                {cells.map((day, i) => {
                  const dayEvents = day ? eventsByDay.get(day) ?? [] : []
                  const isToday = isCurrentMonth && day === today.getDate()
                  return (
                    <div
                      key={i}
                      className={cn(
                        'min-h-16 bg-white p-1.5 sm:min-h-24 sm:p-2',
                        !day && 'bg-slate-50/60',
                      )}
                    >
                      {day && (
                        <>
                          <div className="mb-1 flex items-center justify-between">
                            <span
                              className={cn(
                                'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                                isToday ? 'bg-emerald-600 text-white' : 'text-slate-500',
                              )}
                            >
                              {day}
                            </span>
                            {dayEvents.length > 0 && (
                              <span className="text-[9px] font-bold text-slate-300 sm:text-[10px]">
                                {dayEvents.length}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {dayEvents.slice(0, 2).map((e) => {
                              const theme = regulatorTheme(e.regulatorCode)
                              const overdue = e.effectiveStatus === 'OVERDUE'
                              const filed = e.status === 'FILED'
                              return (
                                <button
                                  key={e.id}
                                  onClick={() => {
                                    setSelectedId(e.id)
                                    setSheetOpen(true)
                                  }}
                                  title={e.title}
                                  className={cn(
                                    'block w-full truncate rounded px-1.5 py-1 text-left text-[10px] font-medium leading-tight transition-opacity hover:opacity-80',
                                    theme.soft,
                                    overdue ? 'text-rose-700 ring-1 ring-rose-300' : 'text-slate-700',
                                    filed && 'opacity-55 line-through',
                                  )}
                                >
                                  <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle', overdue ? 'bg-rose-500' : theme.dot)} />
                                  {e.title}
                                </button>
                              )
                            })}
                            {dayEvents.length > 2 && (
                              <div className="px-1.5 text-[9px] font-semibold text-slate-400">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Agenda list */}
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-800">
                Agenda — {monthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && (
                <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
              )}
              {!loading && events.length === 0 && (
                <p className="text-xs text-slate-400">No statutory deadlines this month.</p>
              )}
              {!loading &&
                events.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setSelectedId(e.id)
                      setSheetOpen(true)
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', regulatorTheme(e.regulatorCode).dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-800">{e.title}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(e.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {e.periodLabel ? ` · ${e.periodLabel}` : ''}
                      </div>
                    </div>
                    <RegulatorChip code={e.regulatorCode} className="hidden sm:inline-flex" />
                    <StatusBadge status={e.effectiveStatus} />
                    {e.template ? (
                      <VerificationBadge value={e.template.verification} />
                    ) : (
                      <span className="text-[10px] text-slate-400">custom</span>
                    )}
                  </button>
                ))}
            </CardContent>
          </Card>

          <p className="text-[11px] text-slate-400">
            Source-review caveats mirror the Regulatory Map — VERIFIED / PARTIAL / UNVERIFIED on
            every event. Confirm deadlines against primary sources before reliance.
          </p>
        </>
      )}

      <ObligationDetailSheet
        obligationId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={load}
      />
    </div>
  )
}
