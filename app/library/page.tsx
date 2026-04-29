'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authedFetch, getStoredHandle } from '@/components/useUserId'
import AppHeader from '@/components/AppHeader'
import Card from '@/components/Card'
import DetailModal from '@/components/DetailModal'
import { Paper } from '@/lib/types'

type Tab = 'saved' | 'history' | 'pdf'

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: 'saved', label: 'Saved', empty: 'No saved papers yet. Tap a card and hit Save to bookmark it here.' },
  { id: 'history', label: 'History', empty: 'No papers viewed yet. Anything you tap on will show up here.' },
  { id: 'pdf', label: 'Read', empty: 'No PDFs opened yet. When you click "Read PDF" on a paper, it lands here.' },
]

export default function LibraryPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('saved')
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Paper | null>(null)

  useEffect(() => {
    if (!getStoredHandle()) router.replace('/login')
  }, [router])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    authedFetch(`/api/library?tab=${tab}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.error) setError(data.error)
        else setPapers(data.papers ?? [])
      })
      .catch(e => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [tab])

  const empty = TABS.find(t => t.id === tab)?.empty ?? ''

  return (
    <main className="min-h-screen">
      <AppHeader active="library" />

      <div className="max-w-screen-md mx-auto px-4 pt-4 pb-2">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-semibold tracking-tight">Library</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded-full text-sm transition shrink-0 ${
                tab === t.id
                  ? 'bg-ink text-white'
                  : 'bg-white border border-stone-300 text-ink hover:border-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="max-w-screen-md mx-auto px-4 py-12 text-center text-muted text-sm">
          Loading…
        </div>
      )}

      {!loading && error && (
        <div className="max-w-screen-md mx-auto px-4 py-12 text-center text-accent text-sm">
          {error}
        </div>
      )}

      {!loading && !error && papers.length === 0 && (
        <div className="max-w-screen-md mx-auto px-5 py-12 text-center text-muted text-sm">
          {empty}
        </div>
      )}

      {!loading && !error && papers.length > 0 && (
        <div className="feed">
          {papers.map(p => (
            <Card key={p.id} paper={p} onTap={setSelected} />
          ))}
        </div>
      )}

      {selected && (
        <DetailModal paper={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  )
}
