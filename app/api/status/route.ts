// Tiny status endpoint used by the root page to decide whether to send the
// user to onboarding or to the feed.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('user_preferences')
      .select('onboarded, categories')
      .eq('id', 1)
      .single()
    if (error) throw error
    return NextResponse.json({
      onboarded: !!data?.onboarded,
      categories: data?.categories ?? [],
    })
  } catch (err: any) {
    return NextResponse.json({ onboarded: false, error: err?.message }, { status: 200 })
  }
}
