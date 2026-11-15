'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const ASSIGN_OPTIONS = [
  'Tanvir Ahmed — Company Secretary',
  'Nusrat Jahan — Compliance Officer',
  'Rahim Uddin — CFO',
  'Farhana Karim — Head of Internal Audit',
  'Mahmud Hasan — DPO / Legal Counsel',
]

const CADENCE_OPTIONS = [
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'EVENT', label: 'Event-driven' },
  { value: 'ON_CHANGE', label: 'On change' },
]

export default function NewObligationDialog({
  onCreated,
}: {
  onCreated?: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [regulators, setRegulators] = useState<{ code: string; name: string }[]>([])
  const [form, setForm] = useState({
    title: '',
    regulatorCode: '',
    dueDate: '',
    assignee: ASSIGN_OPTIONS[1],
    priority: 'MEDIUM',
    cadence: 'EVENT',
    periodLabel: '',
    notes: '',
  })

  useEffect(() => {
    if (open && regulators.length === 0) {
      fetch('/api/regulators')
        .then((r) => r.json())
        .then((d) => setRegulators(d.regulators?.map((x: { code: string; name: string }) => ({ code: x.code, name: x.name })) ?? []))
        .catch(() => undefined)
    }
  }, [open, regulators.length])

  async function submit() {
    setBusy(true)
    try {
      const res = await fetch('/api/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          regulatorCode: form.regulatorCode,
          dueDate: new Date(form.dueDate + 'T17:00:00').toISOString(),
          assignee: form.assignee,
          priority: form.priority,
          cadence: form.cadence,
          periodLabel: form.periodLabel.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Could not create obligation')
      }
      toast({ title: 'Obligation created', description: 'Added to the register as Draft.' })
      setOpen(false)
      setForm({ ...form, title: '', dueDate: '', periodLabel: '', notes: '' })
      onCreated?.()
    } catch (e) {
      toast({
        title: 'Create failed',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const valid = form.title.trim().length > 2 && form.regulatorCode && form.dueDate

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Plus className="mr-1.5 h-4 w-4" />
          New Obligation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">New obligation</DialogTitle>
          <DialogDescription className="text-xs">
            Adds a custom filing to the register. Statutory templates live in the Regulatory Map.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="ob-title" className="text-xs">Title</Label>
            <Input
              id="ob-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. RPT Disclosure — new subsidiary lease"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Regulator</Label>
              <Select
                value={form.regulatorCode}
                onValueChange={(v) => setForm({ ...form, regulatorCode: v })}
              >
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {regulators.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ob-due" className="text-xs">Due date</Label>
              <Input
                id="ob-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Cadence</Label>
              <Select value={form.cadence} onValueChange={(v) => setForm({ ...form, cadence: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CADENCE_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Assignee</Label>
            <Select value={form.assignee} onValueChange={(v) => setForm({ ...form, assignee: v })}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSIGN_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ob-period" className="text-xs">Period label (optional)</Label>
            <Input
              id="ob-period"
              value={form.periodLabel}
              onChange={(e) => setForm({ ...form, periodLabel: e.target.value })}
              placeholder="e.g. FY2026-27"
              className="text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ob-notes" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="ob-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Context for the compliance record…"
              className="min-h-16 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!valid || busy} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Create obligation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
