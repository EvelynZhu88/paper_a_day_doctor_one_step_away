import { NextResponse } from 'next/server'
import { buildFeed } from '@/lib/recommender'

export const dynamic = 'force-dynamic'  // never cache the feed

export async function GET() {
  try {
    const papers = await buildFeed()
    return NextResponse.json({ papers })
  } catch (err: any) {
    console.error('feed build failed:', err)
    return NextResponse.json(
      { error: err?.message ?? 'feed build failed' },
      { status: 500 },
    )
  }
}
