// Seeds the global papers table with foundational (highly-cited) papers in
// the user's selected categories, fetched from Semantic Scholar.
//
// Behaviour:
//   - Distributes a budget of papers (default 80) evenly across categories.
//   - Calls S2 bulk-search per category, sorted by citation count descending.
//   - Skips papers we already have.
//   - Embeds abstracts via Hugging Face.
//   - Upserts into `papers` so they show up in the personalized feed naturally.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/auth'
import { fetchTopCited, S2Paper } from '@/lib/semanticScholar'
import { categoryToS2 } from '@/lib/categoryToS2'
import { embedText } from '@/lib/embeddings'

export const maxDuration = 300  // give it the full Vercel Hobby budget

const DEFAULT_BUDGET = 80
const MAX_BUDGET = 200

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const userId = auth

  let body: { categories?: string[]; budget?: number } = {}
  try { body = await req.json() } catch { /* allow empty body */ }

  const sb = supabaseAdmin()

  // resolve which categories to seed: explicit > user's prefs
  let categories: string[] = body.categories ?? []
  if (categories.length === 0) {
    const { data: prefs } = await sb
      .from('user_preferences')
      .select('categories')
      .eq('user_id', userId)
      .maybeSingle()
    categories = prefs?.categories ?? []
  }
  if (categories.length === 0) {
    return NextResponse.json({ error: 'no categories — pick some first' }, { status: 400 })
  }

  const budget = Math.min(Math.max(body.budget ?? DEFAULT_BUDGET, 10), MAX_BUDGET)
  const perCategory = Math.max(Math.ceil(budget / categories.length), 3)

  // 1. Fetch S2 candidates per category
  const candidatesByCat = await fetchAllCategories(categories, perCategory)

  // 2. Flatten + dedupe (same paper can appear in multiple cats)
  const merged = new Map<string, S2Paper & { categories: string[] }>()
  for (const [cat, papers] of candidatesByCat.entries()) {
    for (const p of papers) {
      const existing = merged.get(p.id)
      if (existing) {
        if (!existing.categories.includes(cat)) existing.categories.push(cat)
      } else {
        merged.set(p.id, { ...p, categories: [cat] })
      }
    }
  }

  // 3. Skip papers already in DB. We still want their categories merged though,
  //    because the user might have added a new cat to a paper we already have.
  const allIds = Array.from(merged.keys())
  if (allIds.length === 0) {
    return NextResponse.json({ ok: true, fetched: 0, ingested: 0, failed: 0 })
  }
  const { data: existing } = await sb.from('papers').select('id').in('id', allIds)
  const have = new Set((existing ?? []).map(r => r.id))
  const fresh = Array.from(merged.values()).filter(p => !have.has(p.id))

  // 4. Embed + upsert. Run with a small concurrency to keep total time reasonable.
  let ingested = 0
  let failed = 0
  for (const p of fresh) {
    try {
      const embedding = await embedText(`${p.title}\n\n${p.abstract}`)
      const { error: upErr } = await sb.from('papers').upsert(
        {
          id: p.id,
          title: p.title,
          authors: p.authors,
          abstract: p.abstract,
          categories: p.categories,
          primary_category: p.categories[0] ?? null,
          pdf_url: p.pdf_url,
          published_at: p.published_at,
          journal_ref: p.venue,
          comment: null,
          citation_count: p.citation_count,
          embedding,
        },
        { onConflict: 'id' },
      )
      if (upErr) { console.error('seed upsert failed:', upErr); failed++ }
      else ingested++
    } catch (err) {
      console.error('seed embed failed:', err)
      failed++
    }
    await new Promise(r => setTimeout(r, 350))  // HF rate-limit breather
  }

  return NextResponse.json({
    ok: true,
    categories: categories.length,
    fetched: merged.size,
    already_had: have.size,
    ingested,
    failed,
  })
}

async function fetchAllCategories(
  categories: string[],
  perCategory: number,
): Promise<Map<string, S2Paper[]>> {
  const out = new Map<string, S2Paper[]>()
  for (const cat of categories) {
    const { field, query } = categoryToS2(cat)
    try {
      const papers = await fetchTopCited(query, field, perCategory)
      out.set(cat, papers)
    } catch (err) {
      console.error(`S2 fetch failed for ${cat}:`, err)
      out.set(cat, [])
    }
    // gentle pacing — S2 free tier is generous but be polite
    await new Promise(r => setTimeout(r, 200))
  }
  return out
}
