// Singleton interaction buffer. Flushes to /api/interactions every 5s and
// on page hide, so we don't hammer the network on every scroll event.

import { Interaction, EventType } from '@/lib/types'
import { authHeaders } from './useUserId'

let buffer: Interaction[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null

async function flush() {
  if (buffer.length === 0) return
  const batch = buffer
  buffer = []
  try {
    await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    })
  } catch (err) {
    console.error('interaction flush failed, putting events back:', err)
    buffer.unshift(...batch)
  }
}

export function logInteraction(
  paperId: string,
  eventType: EventType,
  durationMs?: number,
) {
  buffer.push({
    paper_id: paperId,
    event_type: eventType,
    duration_ms: durationMs,
  })
}

export function startInteractionLogger() {
  if (typeof window === 'undefined') return
  if (flushTimer) return  // already running

  flushTimer = setInterval(flush, 5000)

  // flush on page hide so we don't lose recent events
  const onHide = () => { void flush() }
  window.addEventListener('pagehide', onHide)
  window.addEventListener('beforeunload', onHide)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}

export function flushNow() { return flush() }
