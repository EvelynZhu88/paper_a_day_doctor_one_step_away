// Verify an existing handle + key. Returns { onboarded } so the client knows
// whether to send the user to /onboarding or straight to the feed.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateHandle, validateKey, hashKey, safeEqualHex } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: { handle?: string; key?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const handle = (body.handle ?? '').trim().toLowerCase()
  const key = body.key ?? ''

  if (validateHandle(handle) || validateKey(key)) {
    return NextResponse.json({ error: 'invalid handle or key' }, { status: 400 })
  }

  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .select('id, key_hash')
    .eq('id', handle)
    .maybeSingle()
  if (error) {
    console.error('login lookup failed:', error)
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 })
  }
  if (!data) {
    // generic message — don't reveal whether the handle exists
    return NextResponse.json({ error: 'wrong handle or key' }, { status: 401 })
  }
  if (!safeEqualHex(data.key_hash, hashKey(key, handle))) {
    return NextResponse.json({ error: 'wrong handle or key' }, { status: 401 })
  }

  const { data: prefs } = await sb
    .from('user_preferences')
    .select('onboarded')
    .eq('user_id', handle)
    .maybeSingle()

  return NextResponse.json({ ok: true, handle, onboarded: !!prefs?.onboarded })
}
