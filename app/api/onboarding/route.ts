// Saves initial user preferences:
//   - selected arXiv categories
//   - daily feed size
//   - exploration rate
//   - (optional) seed profile vector from arxiv IDs

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchById } from '@/lib/arxiv'
import { embedBatch, averageVectors } from '@/lib/embeddings'

type Body = {
  categories: string[]
  daily_count?: number
  exploration_rate?: number
  seed_arxiv_ids?: string[]   // optional: papers to seed profile vector
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!Array.isArray(body.categories) || body.categories.length === 0) {
    return NextResponse.json({ error: 'pick at least one category' }, { status: 400 })
  }

  const sb = supabaseAdmin()

  let profileVector: number[] | null = null
  if (body.seed_arxiv_ids && body.seed_arxiv_ids.length > 0) {
    try {
      const seeds = await fetchById(body.seed_arxiv_ids)
      if (seeds.length > 0) {
        const texts = seeds.map(p => `${p.title}\n\n${p.abstract}`)
        const vectors = await embedBatch(texts)
        profileVector = averageVectors(vectors)

        // Also stash these seed papers so they show up in the library / dedupe.
        await sb.from('papers').upsert(
          seeds.map((p, i) => ({
            id: p.id,
            title: p.title,
            authors: p.authors,
            abstract: p.abstract,
            categories: p.categories,
            primary_category: p.primary_category,
            pdf_url: p.pdf_url,
            published_at: p.published_at,
            embedding: vectors[i]?.length ? vectors[i] : null,
          })),
          { onConflict: 'id' },
        )
      }
    } catch (err) {
      console.error('seeding profile vector failed (non-fatal):', err)
    }
  }

  const update: any = {
    categories: body.categories,
    daily_count: body.daily_count ?? 30,
    exploration_rate: body.exploration_rate ?? 0.15,
    onboarded: true,
    updated_at: new Date().toISOString(),
  }
  if (profileVector) update.profile_vector = profileVector

  const { error } = await sb.from('user_preferences').update(update).eq('id', 1)
  if (error) {
    console.error('onboarding update failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Seed category_stats rows for the chosen categories so the bandit has
  // something to draw from on day one.
  await sb.from('category_stats').upsert(
    body.categories.map(c => ({ category: c, alpha: 1.0, beta: 1.0 })),
    { onConflict: 'category', ignoreDuplicates: true },
  )

  return NextResponse.json({ ok: true, seeded: profileVector !== null })
}
