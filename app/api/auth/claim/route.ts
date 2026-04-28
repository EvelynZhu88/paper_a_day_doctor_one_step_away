// Claim a new handle + key. Fails if the handle is taken.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateHandle, validateKey, hashKey } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: { handle?: string; key?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const handle = (body.handle ?? '').trim().toLowerCase()
  const key = body.key ?? ''

  const handleErr = validateHandle(handle)
  if (handleErr) return NextResponse.json({ error: `handle: ${handleErr}` }, { status: 400 })
  const keyErr = validateKey(key)
  if (keyErr) return NextResponse.json({ error: `key: ${keyErr}` }, { status: 400 })

  const sb = supabaseAdmin()

  // check uniqueness
  const { data: existing } = await sb.from('users').select('id').eq('id', handle).maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: 'that handle is already taken — pick another' },
      { status: 409 },
    )
  }

  const key_hash = hashKey(key, handle)
  const { error: insErr } = await sb.from('users').insert({ id: handle, key_hash })
  if (insErr) {
    console.error('user insert failed:', insErr)
    return NextResponse.json({ error: 'could not create account' }, { status: 500 })
  }

  // seed an empty user_preferences row so onboarding can update it
  const { error: prefErr } = await sb.from('user_preferences').insert({ user_id: handle })
  if (prefErr) console.error('user_preferences seed failed:', prefErr)

  return NextResponse.json({ ok: true, handle })
}
