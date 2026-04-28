'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Curated set of arXiv categories. Add/remove freely — these are just the
// most common ones. Full taxonomy at arxiv.org/category_taxonomy.
const CATEGORY_GROUPS: { label: string; cats: { id: string; name: string }[] }[] = [
  {
    label: 'Computer Science',
    cats: [
      { id: 'cs.LG', name: 'Machine Learning' },
      { id: 'cs.CL', name: 'Computation and Language (NLP)' },
      { id: 'cs.CV', name: 'Computer Vision' },
      { id: 'cs.AI', name: 'Artificial Intelligence' },
      { id: 'cs.RO', name: 'Robotics' },
      { id: 'cs.NE', name: 'Neural and Evolutionary Computing' },
      { id: 'cs.IR', name: 'Information Retrieval' },
      { id: 'cs.HC', name: 'Human-Computer Interaction' },
      { id: 'cs.CR', name: 'Cryptography & Security' },
      { id: 'cs.DC', name: 'Distributed Computing' },
      { id: 'cs.DS', name: 'Data Structures & Algorithms' },
    ],
  },
  {
    label: 'Statistics',
    cats: [
      { id: 'stat.ML', name: 'Machine Learning (Stats)' },
      { id: 'stat.ME', name: 'Methodology' },
      { id: 'stat.AP', name: 'Applications' },
    ],
  },
  {
    label: 'Math',
    cats: [
      { id: 'math.OC', name: 'Optimization & Control' },
      { id: 'math.PR', name: 'Probability' },
      { id: 'math.ST', name: 'Statistics Theory' },
    ],
  },
  {
    label: 'Quantitative Biology',
    cats: [
      { id: 'q-bio.NC', name: 'Neurons & Cognition' },
      { id: 'q-bio.QM', name: 'Quantitative Methods' },
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [seedIds, setSeedIds] = useState('')
  const [dailyCount, setDailyCount] = useState(30)
  const [explorationRate, setExplorationRate] = useState(0.15)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
      const res = await fetch('/api/onboarding', {
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
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted mb-3">
          Categories
        </h2>
        {CATEGORY_GROUPS.map(group => (
          <div key={group.label} className="mb-5">
            <div className="text-xs text-muted mb-2">{group.label}</div>
            <div className="flex flex-wrap gap-2">
              {group.cats.map(c => {
                const active = selected.has(c.id)
                return (
                  <button
                    key={c.id}
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
          </div>
        ))}
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
        After saving, hit <span className="font-mono">/api/cron/ingest</span> once
        (with your CRON_SECRET) to populate today's papers, or wait for the daily
        cron to fire.
      </p>
    </main>
  )
}
