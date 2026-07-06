import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Phone, Mail, Building2, User, Send, CheckCircle2, MessageSquare, ChevronDown, ChevronUp, HelpCircle, BookOpen } from 'lucide-react'
import { apiGet, apiPost } from '@/api/client'
import { PageHeader, SectionCard } from '@/components/ui'
import { useToast } from '@/hooks'
import { ToastContainer } from '@/components/forms'

interface SupportHelp {
  faqs: { q: string; a: string }[]
  guides: { title: string; steps: string[] }[]
}

interface SupportContact {
  property: { name: string; phone: string | null; email: string | null; address: string | null; city: string | null } | null
  managers: { id: number; name: string; email: string | null; phone: string | null; role: string }[]
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button type="button" onClick={() => setOpen(!open)} className="w-full text-left">
      <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">{q}</span>
          {open
            ? <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            : <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        </div>
        {open && (
          <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
        )}
      </div>
    </button>
  )
}

const msgSchema = z.object({
  subject: z.string().min(3, 'Subject is required').max(255),
  body: z.string().min(10, 'Message must be at least 10 characters').max(3000),
})
type MsgForm = z.infer<typeof msgSchema>

export default function TenantSupport(): React.ReactElement {
  const [compose, setCompose] = useState(false)
  const [sent, setSent]       = useState(false)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data: contactData, isLoading } = useQuery({
    queryKey: ['tenant', 'support', 'contact'],
    queryFn: () => apiGet<SupportContact>('/tenant/support/contact').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: helpData, isLoading: helpLoading } = useQuery({
    queryKey: ['tenant', 'support', 'help'],
    queryFn: () => apiGet<SupportHelp>('/tenant/support/help').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MsgForm>({
    resolver: zodResolver(msgSchema),
    defaultValues: { subject: '', body: '' },
  })

  const { mutate: sendMsg, isPending: sending } = useMutation({
    mutationFn: (data: MsgForm) => apiPost('/tenant/support/message', data),
    onSuccess: () => {
      success('Message sent! Your manager will respond shortly.')
      reset()
      setSent(true)
      setCompose(false)
    },
    onError: () => toastError('Failed to send message. Please try again.'),
  })

  const property = contactData?.property
  const all      = contactData?.managers ?? []
  const faqs     = helpData?.faqs ?? []
  const guides   = helpData?.guides ?? []

  // Managers shown with full contact; admins only as fallback with email-only (phone is private)
  const managers = all.filter(m => m.role === 'manager')
  const contacts = managers.length > 0
    ? managers
    : all.filter(m => m.role === 'admin').slice(0, 1) // fallback: one admin, email only

  const isAdminFallback = managers.length === 0

  return (
    <>
      <Helmet><title>Help & Support | StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="p-4 sm:p-6">
        <PageHeader
          title="Help & Support"
          emoji="🛟"
          subtitle="Reach your property manager directly."
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {/* ── Property card ──────────────────────────────────────── */}
          {property && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <p className="font-bold text-foreground">{property.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[property.address, property.city].filter(Boolean).join(', ')}
              </p>
              <div className="mt-3 space-y-1.5">
                {property.phone && (
                  <a
                    href={`tel:${property.phone}`}
                    className="flex items-center gap-2 text-xs text-primary hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {property.phone}
                  </a>
                )}
                {property.email && (
                  <a
                    href={`mailto:${property.email}`}
                    className="flex items-center gap-2 text-xs text-primary hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" /> {property.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Manager / contact cards ──────────────────────────── */}
          {isLoading
            ? [1, 2].map(i => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
              ))
            : contacts.map(m => (
                <div key={m.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-bold text-foreground">{m.name}</p>
                  <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                    {isAdminFallback ? 'Property Admin' : m.role}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {/* Phone only for managers — admin phone is private */}
                    {!isAdminFallback && m.phone && (
                      <a
                        href={`tel:${m.phone}`}
                        className="flex items-center gap-2 text-xs text-primary hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" /> {m.phone}
                      </a>
                    )}
                    {m.email && (
                      <a
                        href={`mailto:${m.email}`}
                        className="flex items-center gap-2 text-xs text-primary hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" /> {m.email}
                      </a>
                    )}
                  </div>
                </div>
              ))
          }

          {/* ── Send message card ─────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:col-span-2 lg:col-span-3">
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="font-semibold text-foreground">Message sent!</p>
                <p className="text-sm text-muted-foreground">Your manager will get back to you soon.</p>
                <button
                  type="button"
                  onClick={() => { setSent(false); setCompose(false) }}
                  className="mt-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Send another
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCompose(!compose)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">Send a Message</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${compose ? 'rotate-180' : ''}`}
                  />
                </button>

                {compose && (
                  <form
                    onSubmit={handleSubmit(d => sendMsg(d))}
                    className="mt-4 space-y-3 border-t border-border pt-4"
                  >
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Subject</label>
                      <input
                        {...register('subject')}
                        placeholder="e.g. Water leak in bathroom"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject.message}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Message</label>
                      <textarea
                        {...register('body')}
                        rows={3}
                        placeholder="Describe your issue in detail…"
                        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      {errors.body && <p className="mt-1 text-xs text-red-500">{errors.body.message}</p>}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCompose(false)}
                        className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={sending}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

        </div>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <div className="mt-6">
          <SectionCard title="Frequently Asked Questions" icon={<HelpCircle className="h-4 w-4" />}>
            {helpLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Quick Guides ─────────────────────────────────────────── */}
        {guides.length > 0 && (
          <div className="mt-4">
            <SectionCard title="Quick Guides" icon={<BookOpen className="h-4 w-4" />}>
              <div className="space-y-5">
                {guides.map((g, i) => (
                  <div key={i}>
                    <p className="mb-2 text-sm font-semibold text-foreground">{g.title}</p>
                    <ol className="space-y-1.5">
                      {g.steps.map((step, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {j + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

      </div>
    </>
  )
}
