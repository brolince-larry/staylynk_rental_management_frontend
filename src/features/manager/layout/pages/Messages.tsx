// src/features/manager/pages/Messages.tsx
import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useManagerMessages, useSendManagerMessage } from '../hooks/index'
import { useToast } from '@/hooks'
import { useAuthStore } from '@/store/auth.store'
import { getEcho } from '@/lib/echo'
import { Modal, Button, FormField, Input, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader } from '@/components/ui'
import { messageSchema, type MessageSchema } from '@/schemas/misc.schema'
import { formatRelative } from '@/utils/format'

type Message = Record<string, unknown>

export default function Messages(): React.ReactElement {
  const [selected, setSelected] = useState<Message | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const qc = useQueryClient()
  const { token, user } = useAuthStore()
  const userId = user?.id

  const { data, isLoading } = useManagerMessages({ per_page: 30 })
  const { mutate: send, isPending: sending } = useSendManagerMessage()

  // Real-time: refresh inbox when a new message arrives on the WebSocket
  useEffect(() => {
    if (!token || !userId) return
    const echo = getEcho(token)
    if (!echo) return
    const channel = echo.private(`users.${userId}`)
    channel.listen('.message.sent', () => {
      void qc.invalidateQueries({ queryKey: ['manager', 'messages'] })
    })
    channel.listen('.message.read', () => {
      void qc.invalidateQueries({ queryKey: ['manager', 'messages'] })
    })
    return () => {
      channel.stopListening('.message.sent')
      channel.stopListening('.message.read')
      echo.leave(`users.${userId}`)
    }
  }, [token, userId, qc])

  const form = useForm<MessageSchema>({ resolver: zodResolver(messageSchema) })

  const result   = data as Record<string, unknown> | undefined
  const messages = (result?.data as Message[] | undefined) ?? ((result as unknown as Message[] | undefined) ?? [])

  const handleSend = (values: MessageSchema) => {
    send(values as Parameters<typeof send>[0], {
      onSuccess: () => { success('Message sent'); setComposeOpen(false); form.reset() },
      onError: (err) => toastError(err, 'Failed to send message'),
    })
  }

  return (
    <>
      <Helmet><title>Messages — Manager</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Messages" subtitle="Communicate with tenants and staff."
          actions={<Button onClick={() => setComposeOpen(true)}><Send className="h-3.5 w-3.5" /> New Message</Button>}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* Message list */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Inbox</p>
            </div>
            <div className="divide-y divide-border overflow-y-auto max-h-[600px]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 space-y-2">
                    <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-muted rounded animate-pulse w-full" />
                  </div>
                ))
              ) : messages.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const sender = msg.sender as Record<string, string> | null
                  const isRead = !!msg.read_at
                  return (
                    <button key={msg.id as number}
                      onClick={() => setSelected(msg)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selected?.id === msg.id ? 'bg-muted/50' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-xs truncate ${isRead ? 'text-foreground' : 'text-foreground font-semibold'}`}>
                          {sender?.name ?? 'Unknown'}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatRelative(msg.created_at as string)}</span>
                      </div>
                      <p className={`text-xs truncate ${isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {msg.subject as string || msg.body as string}
                      </p>
                      {!isRead && <span className="inline-block mt-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Message detail */}
          <div className="rounded-xl border border-border bg-card">
            {selected ? (
              <div className="p-5">
                <div className="border-b border-border pb-4 mb-4">
                  <p className="text-base font-semibold text-foreground">{selected.subject as string || '(No subject)'}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>From: {(selected.sender as Record<string, string> | null)?.name ?? '—'}</span>
                    <span>•</span>
                    <span>{formatRelative(selected.created_at as string)}</span>
                  </div>
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.body as string}</p>
                <div className="mt-4 pt-4 border-t border-border">
                  <Button size="sm" onClick={() => {
                    form.setValue('receiver_id', (selected.sender as Record<string, number> | null)?.id ?? 0)
                    form.setValue('subject', `Re: ${selected.subject as string ?? ''}`)
                    form.setValue('parent_id', selected.id as number)
                    setComposeOpen(true)
                  }}>
                    Reply
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-sm font-medium text-foreground">Select a message</p>
                <p className="text-xs text-muted-foreground mt-1">Choose a conversation from the list</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={composeOpen} onClose={() => { setComposeOpen(false); form.reset() }}
        title="New Message" size="md"
        footer={<><Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button><Button loading={sending} onClick={form.handleSubmit(handleSend)}><Send className="h-3.5 w-3.5" /> Send</Button></>}
      >
        <form onSubmit={form.handleSubmit(handleSend)} className="space-y-4">
          <FormField label="Recipient ID" htmlFor="mrecv" error={form.formState.errors.receiver_id?.message} required>
            <Input id="mrecv" type="number" min={1} error={!!form.formState.errors.receiver_id} {...form.register('receiver_id')} />
          </FormField>
          <FormField label="Subject" htmlFor="msubj">
            <Input id="msubj" placeholder="Optional subject" {...form.register('subject')} />
          </FormField>
          <FormField label="Message" htmlFor="mbody" error={form.formState.errors.body?.message} required>
            <Textarea id="mbody" rows={5} placeholder="Write your message…" error={!!form.formState.errors.body} {...form.register('body')} />
          </FormField>
        </form>
      </Modal>
    </>
  )
}
