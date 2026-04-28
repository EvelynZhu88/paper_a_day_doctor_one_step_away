// Daily arXiv ingestion. Triggered by Vercel cron (vercel.json).
// 1. Reads the UNION of all users' followed categories.
// 2. Pulls the latest papers in those categories from arXiv.
// 3. Embeds each abstract via Hugging Face.
// 4. Upserts into Supabase. Papers are global — shared across all users.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchRecentPapers } from '@/lib/arxiv'
import { embedText } from '@/lib/embeddings'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = supabaseAdmin()

  const { data: catRows, error } = await sb.rpc('all_followed_categories')
  if (error) {
    console.error('all_followed_categories failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const categories = Array.from(new Set((catRows ?? []).map((r: any) => r.category).filter(Boolean)))
  if (categories.length === 0) {
    return NextResponse.json({ message: 'no users with categories yet — nothing to fetch' })
  }

  const papers = await fetchRecentPapers(categories, 50)

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
    await new Promise(r => setTimeout(r, 350))
  }

  return NextResponse.json({
    categories: categories.length,
    fetched: papers.length,
    new: fresh.length,
    ingested,
    failed,
  })
}

export async function POST(req: NextRequest) { return GET(req) }
