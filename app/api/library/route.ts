// Returns the user's library: saved papers and recently-viewed papers.
// Query params:
//   tab=saved   → papers with a 'save' interaction, newest save first
//   tab=history → papers with a 'tap' interaction, newest tap first
//   tab=pdf     → papers where the user opened the PDF

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/auth'
import { Paper } from '@/lib/types'

export const dynamic = 'force-dynamic'

const TAB_TO_EVENT: Record<string, string> = {
  saved: 'save',
  history: 'tap',
  pdf: 'pdf_open',
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const userId = auth

  const url = new URL(req.url)
  const tab = url.searchParams.get('tab') ?? 'saved'
  const event = TAB_TO_EVENT[tab]
  if (!event) return NextResponse.json({ error: 'invalid tab' }, { status: 400 })

  const sb = supabaseAdmin()

  // Get most-recent interaction time per paper for this user + event type.
  const { data: events, error: evErr } = await sb
    .from('interactions')
    .select('paper_id, occurred_at')
    .eq('user_id', userId)
    .eq('event_type', event)
    .order('occurred_at', { ascending: false })
    .limit(500)
  if (evErr) {
    console.error('library events fetch failed:', evErr)
    return NextResponse.json({ error: evErr.message }, { status: 500 })
  }
  const list = events ?? []
  if (list.length === 0) return NextResponse.json({ papers: [] })

  // Dedupe by paper_id, keeping the first (= most recent) occurrence.
  const seen = new Set<string>()
  const ordered: { paper_id: string; occurred_at: string }[] = []
  for (const r of list) {
    if (!r.paper_id || seen.has(r.paper_id)) continue
    seen.add(r.paper_id)
    ordered.push({ paper_id: r.paper_id, occurred_at: r.occurred_at })
  }

  const ids = ordered.map(r => r.paper_id)
  const { data: papers, error: pErr } = await sb
    .from('papers')
    .select('id, title, authors, abstract, categories, primary_category, pdf_url, published_at, journal_ref, comment')
    .in('id', ids)
  if (pErr) {
    console.error('library papers fetch failed:', pErr)
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  // Restore ordering by interaction recency (Supabase doesn't preserve `in()` order)
  const paperById = new Map((papers ?? []).map(p => [p.id, p as Paper]))
  const sorted = ordered
    .map(o => paperById.get(o.paper_id))
    .filter((p): p is Paper => !!p)

  return NextResponse.json({ papers: sorted })
}
