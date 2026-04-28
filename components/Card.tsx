'use client'

import { Paper } from '@/lib/types'

const CATEGORY_COLORS: Record<string, string> = {
  'cs.LG': 'bg-rose-100 text-rose-800',
  'cs.CL': 'bg-amber-100 text-amber-800',
  'cs.CV': 'bg-violet-100 text-violet-800',
  'cs.AI': 'bg-sky-100 text-sky-800',
  'cs.RO': 'bg-emerald-100 text-emerald-800',
  'stat.ML': 'bg-fuchsia-100 text-fuchsia-800',
}

function categoryColor(cat: string | null): string {
  if (!cat) return 'bg-stone-100 text-stone-700'
  return CATEGORY_COLORS[cat] ?? 'bg-stone-100 text-stone-700'
}

function relativeDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function Card({
  paper,
  onTap,
}: {
  paper: Paper
  onTap: (paper: Paper) => void
}) {
  const tldr = paper.abstract?.split('. ').slice(0, 2).join('. ') + (paper.abstract ? '.' : '')

  return (
    <div
      data-paper-id={paper.id}
      onClick={() => onTap(paper)}
      className="card bg-card rounded-xl p-3 shadow-sm hover:shadow-md active:scale-[0.99] transition cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${categoryColor(paper.primary_category)}`}>
          {paper.primary_category ?? 'paper'}
        </span>
        <span className="text-[10px] text-muted">{relativeDate(paper.published_at)}</span>
      </div>

      <h3 className="text-[15px] font-semibold leading-snug text-ink line-clamp-3">
        {paper.title}
      </h3>

      {tldr && (
        <p className="text-[12.5px] text-stone-700 mt-2 leading-snug line-clamp-4">
          {tldr}
        </p>
      )}

      {paper.authors.length > 0 && (
        <p className="text-[11px] text-muted mt-2 line-clamp-1">
          {paper.authors.slice(0, 3).join(', ')}
          {paper.authors.length > 3 ? `, +${paper.authors.length - 3}` : ''}
        </p>
      )}
    </div>
  )
}
