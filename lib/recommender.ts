// Builds the personalized feed for a specific user.
// Strategy:
//   1. Pull this user's prefs + their per-category Thompson Sampling stats.
//   2. Use Thompson Sampling to allocate feed slots across the user's
//      selected categories (handles explore-vs-exploit at the topic level).
//   3. Within each category, fetch top-K papers ranked by cosine similarity
//      to this user's profile vector. Falls back to recency if no profile.
//   4. Mix in a fraction of pure-random papers (exploration_rate) to keep
//      the feed from becoming an echo chamber.
//   5. Deduplicate, interleave, return.

import { supabaseAdmin } from './supabase'
import { allocateSlots } from './bandit'
import { Paper, CategoryStats } from './types'

export async function buildFeed(userId: string): Promise<Paper[]> {
  const sb = supabaseAdmin()

  const { data: prefs, error: pErr } = await sb
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (pErr || !prefs) throw new Error('no user_preferences row — run onboarding first')

  const categories: string[] = prefs.categories ?? []
  if (categories.length === 0) return []

  const dailyCount: number = prefs.daily_count ?? 30
  const explorationRate: number = prefs.exploration_rate ?? 0.15
  const profile = parseVector(prefs.profile_vector)

  const exploreCount = Math.round(dailyCount * explorationRate)
  const personalizedCount = dailyCount - exploreCount

  const { data: stats } = await sb
    .from('category_stats')
    .select('*')
    .eq('user_id', userId)
  const statsList: CategoryStats[] = stats ?? []
  const slots = allocateSlots(categories, statsList, personalizedCount)

  const personalized: Paper[] = []
  for (const category of categories) {
    const k = slots[category] ?? 0
    if (k === 0) continue

    if (profile && profile.length > 0) {
      const { data, error } = await sb.rpc('recommend_by_similarity', {
        p_user_id: userId,
        user_vec: profile,
        user_cats: [category],
        k,
      })
      if (error) {
        console.error(`recommend_by_similarity error for ${category}:`, error)
        continue
      }
      personalized.push(...((data ?? []) as Paper[]))
    } else {
      const seenIds = await getSeenPaperIds(sb, userId)
      let q = sb
        .from('papers')
        .select('*')
        .contains('categories', [category])
        .order('published_at', { ascending: false })
        .limit(k)
      if (seenIds.length > 0) q = q.not('id', 'in', `(${seenIds.map(s => `"${s}"`).join(',')})`)
      const { data, error } = await q
      if (error) {
        console.error(`recency fallback error for ${category}:`, error)
        continue
      }
      personalized.push(...((data ?? []) as Paper[]))
    }
  }

  let explore: Paper[] = []
  if (exploreCount > 0) {
    const { data, error } = await sb.rpc('recommend_random', {
      p_user_id: userId,
      user_cats: categories,
      k: exploreCount,
    })
    if (error) console.error('recommend_random error:', error)
    explore = (data ?? []) as Paper[]
  }

  const seen = new Set<string>()
  const merged: Paper[] = []
  for (const p of interleave(personalized, explore)) {
    if (!seen.has(p.id)) {
      seen.add(p.id)
      merged.push(p)
    }
  }
  return merged.slice(0, dailyCount)
}

async function getSeenPaperIds(sb: ReturnType<typeof supabaseAdmin>, userId: string): Promise<string[]> {
  const { data } = await sb
    .from('interactions')
    .select('paper_id')
    .eq('user_id', userId)
    .in('event_type', ['tap', 'save', 'pdf_open'])
    .limit(2000)
  return Array.from(new Set((data ?? []).map(r => r.paper_id).filter(Boolean) as string[]))
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

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = []
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i])
    if (i < b.length) out.push(b[i])
  }
  return out
}
