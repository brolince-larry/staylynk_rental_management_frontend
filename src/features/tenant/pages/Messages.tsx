// src/features/tenant/pages/Messages.tsx
import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useTenantMessages, useSendMessage, useTenantAnnouncements } from '../hooks/index'
import { useToast } from '@/hooks'
import { useAuthStore } from '@/store/auth.store'
import { getEcho } from '@/lib/echo'
import { Modal, Button, FormField, Input, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, SectionCard } from '@/components/ui'
import { messageSchema, type MessageSchema } from '@/schemas/misc.schema'
import { formatDate, formatRelative } from '@/utils/format'

type Message      = Record<string, unknown>
type Announcement = Record<string, unknown>

export default function TenantMessages(): React.ReactElement {
  const [tab, setTab]            = useState<'messages' | 'announcements'>('messages')
  const [selected, setSelected]  = useState<Message | null>(null)
  const [composeOpen, setCompose] = useState(false)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const qc = useQueryClient()
  const { token, user } = useAuthStore()
  const userId = user?.id

  const { data: msgsData, isLoading: msgsLoading } = useTenantMessages({ per_page: 30 })
  const { data: annData,  isLoading: annLoading }  = useTenantAnnouncements({ per_page: 10 })
  const { mutate: send,   isPending: sending }      = useSendMessage()

  // Real-time: refresh inbox and unread count when a message arrives
  useEffect(() => {
    if (!token || !userId) return
    const echo = getEcho(token)
    if (!echo) return
    const channel = echo.private(`users.${userId}`)
    channel.listen('.message.sent', () => {
      void qc.invalidateQueries({ queryKey: ['tenant', 'messages'] })
    })
    channel.listen('.message.read', () => {
      void qc.invalidateQueries({ queryKey: ['tenant', 'messages'] })
    })
    return () => {
      channel.stopListening('.message.sent')
      channel.stopListening('.message.read')
      echo.leave(`users.${userId}`)
    }
  }, [token, userId, qc])

  const form = useForm<MessageSchema>({ resolver: zodResolver(messageSchema) })

  const messages     = ((msgsData as Record<string, unknown> | undefined)?.data as Message[]) ?? []
  const announcements = ((annData as Record<string, unknown> | undefined)?.data as Announcement[]) ?? []

  const handleSend = (values: MessageSchema) => {
    send(values as Parameters<typeof send>[0], {
      onSuccess: () => { success('Message sent'); setCompose(false); form.reset() },
      onError: (err) => toastError(err, 'Failed to send'),
    })
  }

  return (
    <>
      <Helmet><title>Messages — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Messages"
          subtitle="Messages from your property team and announcements."
          actions={
            <Button onClick={() => setCompose(true)}>
              <Send className="h-3.5 w-3.5" /> New Message
            </Button>
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-4">
          {([['messages', 'Messages'], ['announcements', 'Announcements']] as const).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {l}
              {t === 'messages' && messages.filter(m => !m.read_at).length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-white font-bold">
                  {messages.filter(m => !m.read_at).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Messages tab */}
        {tab === 'messages' && (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
            {/* List */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {msgsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 space-y-1.5">
                      <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                      <div className="h-2.5 bg-muted rounded animate-pulse" />
                    </div>
                  ))
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">No messages yet</p>
                  </div>
                ) : messages.map(msg => {
                  const sender = msg.sender as Record<string, string> | null
                  const isRead = !!msg.read_at
                  return (
                    <button key={msg.id as number} onClick={() => setSelected(msg)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selected?.id === msg.id ? 'bg-muted/50' : ''}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`text-xs truncate ${isRead ? 'text-foreground' : 'font-semibold text-foreground'}`}>
                          {sender?.name ?? 'Management'}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatRelative(msg.created_at as string)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{msg.subject as string || msg.body as string}</p>
                      {!isRead && <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Detail */}
            <div className="rounded-xl border border-border bg-card">
              {selected ? (
                <div className="p-5">
                  <div className="border-b border-border pb-4 mb-4">
                    <p className="text-base font-semibold text-foreground">{selected.subject as string || '(No subject)'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      From {(selected.sender as Record<string, string> | null)?.name ?? 'Management'} · {formatRelative(selected.created_at as string)}
                    </p>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.body as string}</p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <Button size="sm" onClick={() => {
                      form.setValue('subject', `Re: ${selected.subject as string ?? ''}`)
                      form.setValue('parent_id', selected.id as number)
                      setCompose(true)
                    }}>
                      Reply
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <p className="text-4xl mb-2">💬</p>
                  <p className="text-sm text-muted-foreground">Select a message to read</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Announcements tab */}
        {tab === 'announcements' && (
          <div className="space-y-3">
            {annLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                  <div className="h-2.5 bg-muted rounded animate-pulse" />
                  <div className="h-2.5 bg-muted rounded animate-pulse w-3/4" />
                </div>
              ))
            ) : announcements.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <p className="text-3xl mb-2">📢</p>
                <p className="text-sm font-medium text-foreground">No announcements</p>
              </div>
            ) : announcements.map(ann => (
              <div key={ann.id as number} className={`rounded-xl border bg-card p-4 ${Boolean(ann.is_pinned) ? 'border-primary/40' : 'border-border'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {Boolean(ann.is_pinned) && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">📌 Pinned</span>}
                    <p className="text-sm font-semibold text-foreground">{ann.title as string}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">{formatDate(ann.published_at as string)}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{ann.content as string}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose */}
      <Modal open={composeOpen} onClose={() => { setCompose(false); form.reset() }}
        title="Send a Message" size="md"
        footer={<><Button variant="outline" onClick={() => setCompose(false)}>Cancel</Button><Button loading={sending} onClick={form.handleSubmit(handleSend)}><Send className="h-3.5 w-3.5" /> Send</Button></>}
      >
        <p className="mb-4 text-xs text-muted-foreground">Your message will be sent to your property manager or admin.</p>
        <form onSubmit={form.handleSubmit(handleSend)} className="space-y-4">
          <FormField label="Subject" htmlFor="subj">
            <Input id="subj" placeholder="Optional subject" {...form.register('subject')} />
          </FormField>
          <FormField label="Message" htmlFor="body" error={form.formState.errors.body?.message} required>
            <Textarea id="body" rows={5} placeholder="Write your message…" error={!!form.formState.errors.body} {...form.register('body')} />
          </FormField>
        </form>
      </Modal>
    </>
  )
}
