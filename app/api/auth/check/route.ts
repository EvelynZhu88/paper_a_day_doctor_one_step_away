// Lightweight "is this session still valid?" endpoint.
// Reads X-User-Id and X-User-Key headers, returns { ok, onboarded }.
// Used by the root page to decide where to send the user.

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const userId = auth

  const sb = supabaseAdmin()
  const { data } = await sb
    .from('user_preferences')
    .select('onboarded')
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({ ok: true, handle: userId, onboarded: !!data?.onboarded })
}
