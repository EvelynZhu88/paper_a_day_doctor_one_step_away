// Builds the daily personalized feed.
// Strategy:
//   1. Pull user prefs + per-category Thompson Sampling stats from Supabase.
//   2. Use Thompson Sampling to allocate feed slots across the user's
//      selected categories (handles explore-vs-exploit at the topic level).
//   3. Within each category, fetch top-K papers ranked by cosine similarity
//      to the user's profile vector. Falls back to recency if no profile yet.
//   4. Mix in a fraction of pure-random papers (exploration_rate) to keep
//      the feed from becoming an echo chamber.
//   5. Deduplicate, shuffle a bit, return.

import { supabaseAdmin } from './supabase'
import { allocateSlots } from './bandit'
import { Paper, CategoryStats } from './types'

export async function buildFeed(): Promise<Paper[]> {
  const sb = supabaseAdmin()

  const { data: prefs, error: pErr } = await sb
    .from('user_preferences')
    .select('*')
    .eq('id', 1)
    .single()
  if (pErr || !prefs) throw new Error('user_preferences row missing — run onboarding first')

  const categories: string[] = prefs.categories ?? []
  if (categories.length === 0) {
    return []  // user hasn't picked any categories yet
  }

  const dailyCount: number = prefs.daily_count ?? 30
  const explorationRate: number = prefs.exploration_rate ?? 0.15
  const profile = parseVector(prefs.profile_vector)

  const exploreCount = Math.round(dailyCount * explorationRate)
  const personalizedCount = dailyCount - exploreCount

  // Thompson Sampling on categories
  const { data: stats } = await sb.from('category_stats').select('*')
  const statsList: CategoryStats[] = stats ?? []
  const slots = allocateSlots(categories, statsList, personalizedCount)

  // Personalized fetch per category
  const personalized: Paper[] = []
  for (const category of categories) {
    const k = slots[category] ?? 0
    if (k === 0) continue

    if (profile && profile.length > 0) {
      // RPC: cosine-similar papers from this single category
      const { data, error } = await sb.rpc('recommend_by_similarity', {
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
      // No profile yet — fall back to recency for this category
      const { data, error } = await sb
        .from('papers')
        .select('*')
        .contains('categories', [category])
        .order('published_at', { ascending: false })
        .limit(k)
      if (error) {
        console.error(`recency fallback error for ${category}:`, error)
        continue
      }
      personalized.push(...((data ?? []) as Paper[]))
    }
  }

  // Exploration: random papers from any of the user's categories
  let explore: Paper[] = []
  if (exploreCount > 0) {
    const { data, error } = await sb.rpc('recommend_random', {
      user_cats: categories,
      k: exploreCount,
    })
    if (error) console.error('recommend_random error:', error)
    explore = (data ?? []) as Paper[]
  }

  // Dedupe by id, then interleave a bit so explore is sprinkled through.
  const seen = new Set<string>()
  const merged: Paper[] = []
  const both = interleave(personalized, explore)
  for (const p of both) {
    if (!seen.has(p.id)) {
      seen.add(p.id)
      merged.push(p)
    }
  }
  return merged.slice(0, dailyCount)
}

// Parse Supabase's pgvector column. It may come back as a JSON array, a
// pgvector string like "[0.1,0.2,...]", or null.
function parseVector(v: unknown): number[] | null {
  if (v == null) return null
  if (Array.isArray(v)) return v as number[]
  if (typeof v === 'string') {
    try {
      const cleaned = v.replace(/^\[/, '[').replace(/\]$/, ']')
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) return parsed as number[]
    } catch {
      return null
    }
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
