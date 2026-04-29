'use client'

import { useEffect, useRef } from 'react'
import { Paper } from '@/lib/types'
import { logInteraction } from './interactionLogger'
import { extractVenue } from '@/lib/venue'

export default function DetailModal({
  paper,
  onClose,
}: {
  paper: Paper
  onClose: () => void
}) {
  const openedAt = useRef(Date.now())
  const longViewLogged = useRef(false)

  // Log `tap` on open and `long_view` if user lingers > 10s.
  useEffect(() => {
    logInteraction(paper.id, 'tap')

    const t = setTimeout(() => {
      logInteraction(paper.id, 'long_view', 10_000)
      longViewLogged.current = true
    }, 10_000)

    return () => {
      clearTimeout(t)
      const stayed = Date.now() - openedAt.current
      if (!longViewLogged.current && stayed > 10_000) {
        logInteraction(paper.id, 'long_view', stayed)
      }
    }
  }, [paper.id])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onSave = () => {
    logInteraction(paper.id, 'save')
  }

  const onPdfClick = () => {
    logInteraction(paper.id, 'pdf_open')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center md:justify-center" onClick={onClose}>
      <div
        className="bg-card w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-stone-200 px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-mono text-muted">{paper.id}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-sm"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {paper.categories.slice(0, 5).map(c => (
              <span
                key={c}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700"
              >
                {c}
              </span>
            ))}
          </div>

          <h2 className="text-xl font-semibold leading-snug text-ink">{paper.title}</h2>

          {(() => {
            const venue = extractVenue(paper.journal_ref, paper.comment)
            return venue ? (
              <p className="text-sm text-emerald-700 mt-2 font-medium">
                📍 Published at {venue}
              </p>
            ) : null
          })()}

          <p className="text-sm text-muted mt-2">
            {paper.authors.join(', ')}
          </p>
          {paper.published_at && (
            <p className="text-xs text-muted mt-1">
              {new Date(paper.published_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          )}
          {paper.comment && (
            <p className="text-xs text-muted mt-2 italic">
              {paper.comment}
            </p>
          )}

          <div className="mt-5 prose prose-sm max-w-none">
            <p className="text-[14.5px] leading-relaxed text-stone-800 whitespace-pre-line">
              {paper.abstract}
            </p>
          </div>

          <div className="mt-7 flex gap-3">
            {paper.pdf_url && (
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noreferrer"
                onClick={onPdfClick}
                className="flex-1 bg-ink text-white text-center rounded-lg py-2.5 text-sm font-medium"
              >
                Read PDF
              </a>
            )}
            <button
              type="button"
              onClick={onSave}
              className="flex-1 bg-white border border-stone-300 text-ink rounded-lg py-2.5 text-sm font-medium hover:border-ink"
            >
              Save
            </button>
          </div>

          <p className="text-[10px] text-muted mt-4">
            arxiv.org/abs/{paper.id}
          </p>
        </div>
      </div>
    </div>
  )
}
