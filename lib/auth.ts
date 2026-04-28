// Lightweight "username + key" auth.
// - User picks a handle (3-30 chars: lowercase letters, digits, hyphens)
// - User picks a key (6+ chars, any printable). Stored as sha256(key + ':' + id).
// - Both required on every authenticated request via headers:
//     X-User-Id: <handle>
//     X-User-Key: <plaintext key>
// This is friendly login, not enterprise auth — no email, no recovery.

import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase'

export const HANDLE_RE = /^[a-z][a-z0-9-]{2,29}$/
export const MIN_KEY_LEN = 6
export const MAX_KEY_LEN = 64

export function validateHandle(h: unknown): string | null {
  if (typeof h !== 'string') return 'must be a string'
  const v = h.trim().toLowerCase()
  if (!HANDLE_RE.test(v)) {
    return 'handle must be 3-30 chars, start with a letter, only a-z 0-9 and hyphens'
  }
  return null
}

export function validateKey(k: unknown): string | null {
  if (typeof k !== 'string') return 'must be a string'
  if (k.length < MIN_KEY_LEN) return `key must be at least ${MIN_KEY_LEN} characters`
  if (k.length > MAX_KEY_LEN) return `key must be at most ${MAX_KEY_LEN} characters`
  return null
}

export function hashKey(key: string, handle: string): string {
  // salt with the handle so identical keys across users hash differently
  return createHash('sha256').update(`${key}:${handle}`).digest('hex')
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

// Read X-User-Id and X-User-Key from a request and validate against the users
// table. Returns the userId on success, or a NextResponse to send back on
// failure. Always use this at the top of authenticated API routes:
//
//   const auth = await requireUser(req)
//   if (auth instanceof NextResponse) return auth
//   const userId = auth
export async function requireUser(req: NextRequest): Promise<string | NextResponse> {
  const id = req.headers.get('x-user-id')?.trim().toLowerCase()
  const key = req.headers.get('x-user-key') ?? ''

  if (!id || !key) {
    return NextResponse.json({ error: 'missing auth headers' }, { status: 401 })
  }
  if (validateHandle(id) || validateKey(key)) {
    return NextResponse.json({ error: 'invalid auth headers' }, { status: 401 })
  }

  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .select('id, key_hash')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('requireUser db error:', error)
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'unknown user' }, { status: 401 })
  }
  if (!safeEqualHex(data.key_hash, hashKey(key, id))) {
    return NextResponse.json({ error: 'wrong key' }, { status: 401 })
  }

  // touch last_seen_at, fire-and-forget
  sb.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', id)
    .then(({ error }) => { if (error) console.error('last_seen update failed:', error) })

  return id
}
