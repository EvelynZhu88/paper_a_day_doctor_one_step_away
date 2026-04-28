// Daily arXiv ingestion. Triggered by Vercel cron (vercel.json).
// 1. Reads which categories the user follows.
// 2. Pulls the latest papers in those categories from arXiv.
// 3. Embeds each abstract via Hugging Face.
// 4. Upserts into Supabase.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchRecentPapers } from '@/lib/arxiv'
import { embedText } from '@/lib/embeddings'

export const maxDuration = 300  // give it up to 5 min on Vercel Hobby

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = supabaseAdmin()

  const { data: prefs, error } = await sb
    .from('user_preferences')
    .select('categories')
    .eq('id', 1)
    .single()
  if (error || !prefs?.categories?.length) {
    return NextResponse.json(
      { error: 'no categories configured — run onboarding first' },
      { status: 400 },
    )
  }

  const papers = await fetchRecentPapers(prefs.categories, 50)

  // Skip papers we already have
  const ids = papers.map(p => p.id)
  const { data: existing } = await sb.from('papers').select('id').in('id', ids)
  const have = new Set((existing ?? []).map(r => r.id))
  const fresh = papers.filter(p => !have.has(p.id))

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
          primary_category: p.primary_category,
          pdf_url: p.pdf_url,
          published_at: p.published_at,
          embedding,
        },
        { onConflict: 'id' },
      )
      if (upErr) {
        console.error('upsert failed for', p.id, upErr)
        failed++
      } else {
        ingested++
      }
    } catch (err) {
      console.error('embed failed for', p.id, err)
      failed++
    }
    // small breather for HF rate limit
    await new Promise(r => setTimeout(r, 350))
  }

  return NextResponse.json({
    fetched: papers.length,
    new: fresh.length,
    ingested,
    failed,
  })
}

// Allow manual trigger from a browser during dev: POST /api/cron/ingest
// with a matching CRON_SECRET. Cleaner than relying only on the cron.
export async function POST(req: NextRequest) {
  return GET(req)
}
