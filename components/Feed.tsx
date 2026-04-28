'use client'

import { useEffect, useRef, useState } from 'react'
import Card from './Card'
import DetailModal from './DetailModal'
import { Paper } from '@/lib/types'
import { logInteraction, startInteractionLogger } from './interactionLogger'

export default function Feed() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Paper | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const dwellTrackRef = useRef<Map<string, number>>(new Map())  // paper_id → enteredAt
  const impressionLogged = useRef<Set<string>>(new Set())

  // Boot the batched logger once
  useEffect(() => { startInteractionLogger() }, [])

  // Fetch the feed on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/feed')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.error) setError(data.error)
        else setPapers(data.papers ?? [])
      })
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  // Set up the IntersectionObserver each time the paper list changes.
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    if (papers.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.paperId
          if (!id) continue

          if (entry.isIntersecting) {
            // log impression once per paper
            if (!impressionLogged.current.has(id)) {
              impressionLogged.current.add(id)
              logInteraction(id, 'impression')
            }
            dwellTrackRef.current.set(id, Date.now())
          } else {
            const enteredAt = dwellTrackRef.current.get(id)
            if (enteredAt) {
              const dwell = Date.now() - enteredAt
              dwellTrackRef.current.delete(id)
              if (dwell > 2000) logInteraction(id, 'dwell', dwell)
            }
          }
        }
      },
      { threshold: 0.5 },
    )
    observerRef.current = observer

    // observe each card after layout
    const els = document.querySelectorAll<HTMLElement>('[data-paper-id]')
    els.forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [papers])

  if (loading) {
    return (
      <div className="max-w-screen-md mx-auto px-4 py-10 text-center text-muted text-sm">
        Loading feed…
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-screen-md mx-auto px-4 py-10 text-center text-accent text-sm">
        {error}
      </div>
    )
  }

  if (papers.length === 0) {
    return (
      <div className="max-w-screen-md mx-auto px-4 py-12 text-center">
        <p className="text-muted text-sm">No papers yet.</p>
        <p className="text-muted text-xs mt-2">
          Trigger <span className="font-mono">/api/cron/ingest</span> to fetch
          today's papers, or wait for the daily cron.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="feed">
        {papers.map(p => (
          <Card key={p.id} paper={p} onTap={setSelected} />
        ))}
      </div>

      {selected && (
        <DetailModal paper={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
