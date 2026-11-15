'use client'

import { useCallback, useEffect, useState } from 'react'
import { EyeOff, FileArchive, FileSpreadsheet, FileText, Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { DocumentItem, ObligationItem } from '@/lib/types'
import { CLASSIFICATION_THEMES } from '@/lib/regulator-theme'
import AccessLogCard from './access-log-card'

function fileIcon(fileType: string) {
  const t = fileType.toUpperCase()
  if (t.includes('XLS') || t.includes('CSV')) return FileSpreadsheet
  if (t.includes('ZIP') || t.includes('ARCH')) return FileArchive
  return FileText
}

export default function DocumentsView() {
  const { toast } = useToast()
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [obligations, setObligations] = useState<ObligationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [classification, setClassification] = useState('ALL')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', classification: 'INTERNAL', obligationId: 'NONE' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, oRes] = await Promise.all([fetch('/api/documents'), fetch('/api/obligations')])
      const d = await dRes.json()
      const o = await oRes.json()
      setDocs(d.documents ?? [])
      setObligations(o.obligations ?? [])
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = docs.filter((d) => {
    const name = d.name ?? '[masked — need-to-know]'
    const matchQ = !q.trim() || name.toLowerCase().includes(q.trim().toLowerCase())
    const matchC = classification === 'ALL' || d.classification === classification
    return matchQ && matchC
  })

  async function upload() {
    setBusy(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          classification: form.classification,
          obligationId: form.obligationId === 'NONE' ? undefined : form.obligationId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Upload failed')
      }
      toast({ title: 'Document registered in vault' })
      setUploadOpen(false)
      setForm({ name: '', classification: 'INTERNAL', obligationId: 'NONE' })
      load()
    } catch (e) {
      toast({
        title: 'Upload failed',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Document removed from vault' })
      setDeleteId(null)
      load()
    } catch {
      toast({ title: 'Could not remove document', variant: 'destructive' })
    }
  }

  const restrictedCount = docs.filter((d) => d.classification === 'RESTRICTED' || d.classification === 'CONFIDENTIAL').length

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
            <Lock className="h-3 w-3" />
            {docs.length} documents
          </span>
          <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-600 ring-1 ring-rose-200">
            {restrictedCount} confidential / restricted
          </span>
        </div>
        <div className="ms-auto flex flex-1 flex-wrap items-center justify-end gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vault…"
            className="h-9 w-44 text-xs"
            aria-label="Search documents"
          />
          <Select value={classification} onValueChange={setClassification}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All classifications</SelectItem>
              <SelectItem value="PUBLIC">Public</SelectItem>
              <SelectItem value="INTERNAL">Internal</SelectItem>
              <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
              <SelectItem value="RESTRICTED">Restricted</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Register document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base">Register a document</DialogTitle>
                <DialogDescription className="text-xs">
                  Vault metadata entry — files are versioned, classified and linked to obligations.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3.5 py-1">
                <div className="grid gap-1.5">
                  <Label htmlFor="doc-name" className="text-xs">Document name</Label>
                  <Input
                    id="doc-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Board Resolution — 02 Dec 2026.pdf"
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Classification</Label>
                    <Select value={form.classification} onValueChange={(v) => setForm({ ...form, classification: v })}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLIC">Public</SelectItem>
                        <SelectItem value="INTERNAL">Internal</SelectItem>
                        <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
                        <SelectItem value="RESTRICTED">Restricted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Link to obligation</Label>
                    <Select value={form.obligationId} onValueChange={(v) => setForm({ ...form, obligationId: v })}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="NONE">None</SelectItem>
                        {obligations.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            <span className="block max-w-64 truncate">{o.title}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={upload}
                  disabled={busy || form.name.trim().length < 3}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Add to vault
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">Vault is empty for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Document</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Classification</TableHead>
                    <TableHead className="hidden text-[11px] font-bold uppercase tracking-wider text-slate-400 md:table-cell">Linked obligation</TableHead>
                    <TableHead className="hidden text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:table-cell">Uploaded</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => {
                    return (
                      <TableRow key={d.id} className={cn('hover:bg-slate-50/60', d.masked && 'bg-amber-50/40')}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {d.masked ? <EyeOff className="h-4 w-4 shrink-0 text-amber-600" /> : (() => { const Icon = fileIcon(d.fileType); return <Icon className="h-4 w-4 shrink-0 text-slate-400" /> })()}
                            <div className="min-w-0">
                              <div className={cn('max-w-72 truncate text-xs font-semibold', d.masked ? 'text-amber-800' : 'text-slate-800')}>
                                {d.name ?? '[masked — above your need-to-know clearance]'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                v{d.version} · {d.fileType}
                                {!d.masked && ` · ${d.sizeKb > 1024 ? `${(d.sizeKb / 1024).toFixed(1)} MB` : `${d.sizeKb} KB`}`}
                                {d.masked && ' · contents withheld — metadata visible only'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-bold',
                              CLASSIFICATION_THEMES[d.classification],
                            )}
                          >
                            {d.classification}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden max-w-56 truncate text-xs text-slate-500 md:table-cell">
                          {d.obligationTitle ?? <span className="text-slate-300">—</span>}
                        </TableCell>
                        <TableCell className="hidden text-xs text-slate-500 lg:table-cell">
                          {new Date(d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          <div className="text-[10px] text-slate-400">{d.uploadedBy ? d.uploadedBy.split('—')[0].trim() : '[need-to-know]'}</div>
                        </TableCell>
                        <TableCell>
                          {!d.masked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-rose-600"
                              aria-label={`Delete ${d.name ?? 'document'}`}
                              onClick={() => setDeleteId(d.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Document Vault service — versioned uploads, classification, retention watermarking.
        Need-to-know is enforced server-side: rows above the acting role's clearance are masked
        to metadata only. Evidence packs are assembled here for regulator submission
        and external auditor sign-off.
      </p>

      <AccessLogCard />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Remove from vault?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This deletes the vault record. Tamper-evident audit trail entries remain for the
              compliance record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => deleteId && remove(deleteId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
