'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Scale, Send, Sparkles, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Which filings are due in the next 30 days for Padma Textiles?',
  'What is the statutory deadline for the RJSC annual return?',
  'Summarise PDPA 2026 breach-notification duties for a listed company.',
  'Is SOC 2 a statutory filing in Bangladesh?',
]

function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-xs leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_h1]:text-sm [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-bold [&_li]:ml-3.5 [&_ol]:list-decimal [&_p]:leading-relaxed [&_strong]:font-bold [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:px-1.5 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100 [&_th]:px-1.5 [&_th]:py-1 [&_ul]:list-disc">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

export default function AssistantView() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content:
        'I am your compliance assistant for **Padma Textiles & Apparels Ltd.** — grounded in the source-reviewed Bangladesh Regulatory Map v2 (7 regulators, 29 statutory templates).\n\nAsk me about filing deadlines, legal bases, workflow status or regulator scope. I will always cite the legal instrument and flag anything marked **UNVERIFIED** for primary-source confirmation.',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    setError(null)
    const nextMessages: ChatMsg[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setBusy(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages
            .filter((m) => m.role !== 'assistant' || m.content !== messages[0]?.content)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Assistant unavailable')
      }
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The assistant could not be reached. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col" style={{ minHeight: 'calc(100vh - 13rem)' }}>
      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        style={{ maxHeight: 'calc(100vh - 17rem)', minHeight: '300px' }}
        aria-live="polite"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn('flex items-start gap-2.5', m.role === 'user' && 'flex-row-reverse')}
          >
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                m.role === 'assistant' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600',
              )}
            >
              {m.role === 'assistant' ? <Scale className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </div>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm',
                m.role === 'assistant'
                  ? 'rounded-tl-sm bg-slate-50 text-slate-700 ring-1 ring-slate-200'
                  : 'rounded-tr-sm bg-emerald-600 text-white',
              )}
            >
              {m.role === 'assistant' ? (
                <MarkdownContent text={m.content} />
              ) : (
                <p className="text-xs leading-relaxed">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-3.5 py-2.5 text-xs text-slate-400 ring-1 ring-slate-200">
              Reviewing the regulatory register…
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
            {error}
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3 text-emerald-500" />
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="mt-3 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          placeholder="Ask about deadlines, legal basis, regulator scope…"
          className="min-h-11 flex-1 resize-none text-sm"
          aria-label="Message the compliance assistant"
        />
        <Button
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          className="h-11 shrink-0 bg-emerald-600 px-4 text-white hover:bg-emerald-700"
          aria-label="Send message"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-400">
        Answers cite the source-reviewed register (Regulatory Mapping v2, 15 Nov 2026). Items marked
        UNVERIFIED or deadlines containing “??” require confirmation against primary sources — not
        legal advice.
      </p>
    </div>
  )
}
