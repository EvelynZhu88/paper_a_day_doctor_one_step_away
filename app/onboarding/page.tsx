'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authedFetch, getStoredHandle } from '@/components/useUserId'
import { CATEGORY_GROUPS, ArxivCat } from '@/lib/arxivCategories'

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [seedIds, setSeedIds] = useState('')
  const [dailyCount, setDailyCount] = useState(30)
  const [explorationRate, setExplorationRate] = useState(0.15)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(CATEGORY_GROUPS.filter(g => g.defaultOpen).map(g => g.label)),
  )

  // Bounce to /login if there's no stored handle.
  useEffect(() => {
    if (!getStoredHandle()) router.replace('/login')
  }, [router])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  // Filter cats by query (matches id or name, case-insensitive).
  const matchesFilter = (cat: ArxivCat, q: string) => {
    if (!q) return true
    const ql = q.toLowerCase()
    return cat.id.toLowerCase().includes(ql) || cat.name.toLowerCase().includes(ql)
  }

  const filteredGroups = useMemo(() => {
    return CATEGORY_GROUPS.map(g => ({
      ...g,
      cats: g.cats.filter(c => matchesFilter(c, filter)),
    })).filter(g => g.cats.length > 0)
  }, [filter])

  const isFiltering = filter.trim().length > 0
  const totalSelected = selected.size

  const submit = async () => {
    setError(null)
    if (selected.size === 0) {
      setError('Pick at least one category.')
      return
    }
    setSubmitting(true)

    const seed_arxiv_ids = seedIds
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean)

    try {
      const res = await authedFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: Array.from(selected),
          daily_count: dailyCount,
          exploration_rate: explorationRate,
          seed_arxiv_ids,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'failed')
      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="max-w-screen-sm mx-auto px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Set up your feed</h1>
      <p className="text-muted mt-2 text-sm">
        Pick the arXiv categories you want to follow. The feed personalizes itself
        as you tap, save, and read papers.
      </p>

      <section className="mt-7">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Categories
          </h2>
          <span className="text-xs text-muted">
            {totalSelected} selected
          </span>
        </div>

        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search categories (e.g. robotics, cs.LG, optimization)…"
          className="w-full border border-stone-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-ink mb-3"
        />

        {filteredGroups.length === 0 && (
          <p className="text-sm text-muted py-4">No categories match.</p>
        )}

        {filteredGroups.map(group => {
          const isOpen = isFiltering || openGroups.has(group.label)
          const groupSelectedCount = group.cats.filter(c => selected.has(c.id)).length
          return (
            <div key={group.label} className="mb-2 border border-stone-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => !isFiltering && toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-stone-50 hover:bg-stone-100 transition"
                disabled={isFiltering}
              >
                <span className="text-sm font-medium text-ink">
                  {group.label}
                  <span className="text-xs text-muted ml-2">
                    ({group.cats.length})
                  </span>
                </span>
                <span className="text-xs text-muted">
                  {groupSelectedCount > 0 && `${groupSelectedCount} selected · `}
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>

              {isOpen && (
                <div className="flex flex-wrap gap-2 p-3 bg-white">
                  {group.cats.map(c => {
                    const active = selected.has(c.id)
                    return (
                      <button
                        key={`${group.label}-${c.id}`}
                        type="button"
                        onClick={() => toggle(c.id)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition ${
                          active
                            ? 'bg-ink text-white border-ink'
                            : 'bg-white text-ink border-stone-300 hover:border-stone-500'
                        }`}
                      >
                        <span className="font-mono text-xs opacity-70 mr-1.5">{c.id}</span>
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted mb-2">
          Seed papers <span className="text-muted normal-case">(optional)</span>
        </h2>
        <p className="text-xs text-muted mb-2">
          Paste 3–5 arXiv IDs of papers you've found valuable. The system embeds
          them and uses the average as your starting taste vector.
        </p>
        <textarea
          value={seedIds}
          onChange={e => setSeedIds(e.target.value)}
          placeholder="e.g.&#10;2401.12345&#10;2305.20050&#10;https://arxiv.org/abs/2310.06825"
          className="w-full border border-stone-300 rounded-lg p-3 text-sm font-mono focus:outline-none focus:border-ink"
          rows={4}
        />
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted">Daily feed size</label>
          <input
            type="number"
            min={5}
            max={100}
            value={dailyCount}
            onChange={e => setDailyCount(parseInt(e.target.value) || 30)}
            className="w-full mt-1 border border-stone-300 rounded-lg p-2 text-sm focus:outline-none focus:border-ink"
          />
        </div>
        <div>
          <label className="text-xs text-muted">Exploration % (0–1)</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={explorationRate}
            onChange={e => setExplorationRate(parseFloat(e.target.value) || 0)}
            className="w-full mt-1 border border-stone-300 rounded-lg p-2 text-sm focus:outline-none focus:border-ink"
          />
        </div>
      </section>

      {error && (
        <p className="text-accent text-sm mt-5">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-7 w-full bg-ink text-white rounded-lg py-3 text-sm font-medium disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Save and view feed'}
      </button>

      <p className="text-xs text-muted mt-4">
        After saving, the daily cron pulls fresh papers in your categories every
        morning. New users will need a manual ingest trigger or just wait for tomorrow.
      </p>
    </main>
  )
}
