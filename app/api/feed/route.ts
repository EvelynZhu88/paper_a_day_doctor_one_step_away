import { NextRequest, NextResponse } from 'next/server'
import { buildFeed } from '@/lib/recommender'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const userId = auth

  try {
    const papers = await buildFeed(userId)
    return NextResponse.json({ papers })
  } catch (err: any) {
    console.error('feed build failed:', err)
    return NextResponse.json(
      { error: err?.message ?? 'feed build failed' },
      { status: 500 },
    )
  }
}
