import React from 'react'
import { formatRelative } from '@/utils/format'

interface ThreadParty {
  id: string
  name: string
}

interface ThreadReply {
  id: string
  body: string
  sender: ThreadParty | null
  created_at: string
}

interface Thread {
  id: string
  body: string
  sender: ThreadParty | null
  receiver: ThreadParty | null
  replies: ThreadReply[]
  created_at: string
}

function Bubble({ mine, name, body, time }: { mine: boolean; name: string; body: string; time: string }): React.ReactElement {
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {!mine && <p className="mb-1 px-1 text-[0.68rem] font-medium text-muted-foreground">{name}</p>}
      <div
        className={[
          'max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          mine
            ? 'rounded-tr-sm bg-primary text-white'
            : 'rounded-tl-sm border border-border bg-muted/60 text-foreground',
        ].join(' ')}
      >
        {body}
      </div>
      <span className="mt-1 px-1 text-[0.65rem] text-muted-foreground/70">{formatRelative(time)}</span>
    </div>
  )
}

export function MessageThreadBubbles({ thread, currentUserId }: { thread: Thread; currentUserId?: string }): React.ReactElement {
  const rootMine = thread.sender?.id === currentUserId

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
      <Bubble mine={rootMine} name={thread.sender?.name ?? 'Unknown'} body={thread.body} time={thread.created_at} />
      {thread.replies.map((r) => {
        const mine = r.sender?.id === currentUserId
        return <Bubble key={r.id} mine={mine} name={r.sender?.name ?? 'Unknown'} body={r.body} time={r.created_at} />
      })}
    </div>
  )
}
