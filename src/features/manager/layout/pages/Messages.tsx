// src/features/manager/pages/Messages.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useManagerMessages, useManagerMessageThread, useMessageRecipients, useSendManagerMessage } from '../hooks/index'
import { useToast } from '@/hooks'
import { useAuthStore } from '@/store/auth.store'
import { useRealtime } from '@/providers/realtimeContext'
import { Modal, Button, FormField, Input, Select, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader } from '@/components/ui'
import { staffMessageSchema, type StaffMessageSchema } from '@/schemas/misc.schema'
import { formatRelative } from '@/utils/format'
import { MessageThreadBubbles } from '@/components/messaging/MessageThreadBubbles'

type Message = Record<string, unknown>

export default function Messages(): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const qc = useQueryClient()
  const { token, user } = useAuthStore()
  const userId = user?.id
  const { subscribePrivate } = useRealtime()
  const userChannel = useMemo(() => (
    token && userId ? `users.${String(userId)}` : null
  ), [token, userId])
  const refreshMessages = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['manager', 'messages'] })
  }, [qc])

  const { data, isLoading } = useManagerMessages({ per_page: 30 })
  const { mutate: send, isPending: sending } = useSendManagerMessage()
  const { data: recipients = [], isLoading: recipientsLoading } = useMessageRecipients()
  const { data: thread, isLoading: threadLoading } = useManagerMessageThread(selectedId)

  // Real-time: refresh inbox when a new message arrives on the WebSocket
  useEffect(() => {
    if (!userChannel) return
    const cleanupSent = subscribePrivate(userChannel, '.message.sent', refreshMessages)
    const cleanupRead = subscribePrivate(userChannel, '.message.read', refreshMessages)
    return () => {
      cleanupSent()
      cleanupRead()
    }
  }, [userChannel, subscribePrivate, refreshMessages])

  const form = useForm<StaffMessageSchema>({ resolver: zodResolver(staffMessageSchema) })

  const result   = data as Record<string, unknown> | undefined
  const messages = (result?.data as Message[] | undefined) ?? ((result as unknown as Message[] | undefined) ?? [])

  const handleSend = (values: StaffMessageSchema) => {
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
                  const isRead = !!msg.is_read
                  const id = msg.id as string
                  return (
                    <button key={id}
                      onClick={() => setSelectedId(id)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedId === id ? 'bg-muted/50' : ''}`}
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
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-sm font-medium text-foreground">Select a message</p>
                <p className="text-xs text-muted-foreground mt-1">Choose a conversation from the list</p>
              </div>
            ) : threadLoading || !thread ? (
              <div className="p-5 space-y-3">
                <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                <div className="h-3 bg-muted rounded animate-pulse w-full" />
                <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
              </div>
            ) : (
              <div className="p-5">
                <div className="border-b border-border pb-4 mb-4">
                  <p className="text-base font-semibold text-foreground">{thread.subject || '(No subject)'}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>With: {thread.sender?.id === user?.id ? thread.receiver?.name : thread.sender?.name}</span>
                    <span>•</span>
                    <span>{formatRelative(thread.created_at)}</span>
                  </div>
                </div>

                <div className="max-h-[420px]">
                  <MessageThreadBubbles thread={thread} currentUserId={user?.id} />
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <Button size="sm" onClick={() => {
                    const other = thread.sender?.id === user?.id ? thread.receiver : thread.sender
                    form.setValue('receiver_id', other?.id ?? '')
                    form.setValue('subject', thread.subject ? `Re: ${thread.subject}` : '')
                    form.setValue('parent_id', thread.id)
                    setComposeOpen(true)
                  }}>
                    Reply
                  </Button>
                </div>
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
          <FormField label="Recipient" htmlFor="mrecv" error={form.formState.errors.receiver_id?.message} required>
            <Select
              id="mrecv"
              error={!!form.formState.errors.receiver_id}
              disabled={recipientsLoading}
              placeholder={recipientsLoading ? 'Loading recipients…' : 'Select a recipient…'}
              options={recipients.map((r) => ({ value: r.id, label: `${r.name} (${r.role})` }))}
              {...form.register('receiver_id')}
            />
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
