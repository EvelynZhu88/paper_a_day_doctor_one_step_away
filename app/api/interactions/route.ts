// Receives a batched list of interactions for ONE user, writes them to
// Supabase, and updates that user's category_stats and profile_vector.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Interaction, REWARD_WEIGHTS, PROFILE_LR } from '@/lib/types'
import { emaUpdate } from '@/lib/embeddings'
import { requireUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const userId = auth

  let body: { events: Interaction[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const events = (body.events ?? []).filter(e =>
    e?.paper_id && e?.event_type && REWARD_WEIGHTS[e.event_type] !== undefined,
  )
  if (events.length === 0) return NextResponse.json({ inserted: 0 })

  const sb = supabaseAdmin()

  const { error: insErr } = await sb.from('interactions').insert(
    events.map(e => ({
      user_id: userId,
      paper_id: e.paper_id,
      event_type: e.event_type,
      duration_ms: e.duration_ms ?? null,
    })),
  )
  if (insErr) {
    console.error('interactions insert failed:', insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  const paperIds = Array.from(new Set(events.map(e => e.paper_id)))
  const { data: papers } = await sb
    .from('papers')
    .select('id, categories, embedding')
    .in('id', paperIds)
  const paperMap = new Map(
    (papers ?? []).map(p => [p.id, { categories: p.categories ?? [], embedding: p.embedding }]),
  )

  // bandit updates per category
  const alphaDelta = new Map<string, number>()
  const betaDelta = new Map<string, number>()
  for (const e of events) {
    const reward = REWARD_WEIGHTS[e.event_type]
    if (reward === 0) continue
    const cats = paperMap.get(e.paper_id)?.categories ?? []
    for (const c of cats) {
      alphaDelta.set(c, (alphaDelta.get(c) ?? 0) + reward)
      betaDelta.set(c, (betaDelta.get(c) ?? 0) + (1 - reward))
    }
  }
  for (const [cat, aDelta] of alphaDelta.entries()) {
    const bDelta = betaDelta.get(cat) ?? 0
    const { error: rpcErr } = await sb.rpc('bump_category_stats', {
      p_user_id: userId,
      cats: [cat],
      alpha_delta: aDelta,
      beta_delta: bDelta,
    })
    if (rpcErr) console.error(`bump_category_stats failed for ${cat}:`, rpcErr)
  }

  // profile-vector EMA update
  const positiveEvents = events.filter(e => PROFILE_LR[e.event_type] > 0)
  if (positiveEvents.length > 0) {
    const { data: prefs } = await sb
      .from('user_preferences')
      .select('profile_vector')
      .eq('user_id', userId)
      .single()

    let profile = parseVector(prefs?.profile_vector)
    for (const e of positiveEvents) {
      const emb = parseVector(paperMap.get(e.paper_id)?.embedding)
      if (!emb) continue
      profile = profile ? emaUpdate(profile, emb, PROFILE_LR[e.event_type]) : emb.slice()
    }
    if (profile) {
      const { error: updErr } = await sb
        .from('user_preferences')
        .update({ profile_vector: profile, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      if (updErr) console.error('profile_vector update failed:', updErr)
    }
  }

  return NextResponse.json({ inserted: events.length })
}

function parseVector(v: unknown): number[] | null {
  if (v == null) return null
  if (Array.isArray(v)) return v as number[]
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      if (Array.isArray(parsed)) return parsed as number[]
    } catch { /* fall through */ }
  }
  return null
}
