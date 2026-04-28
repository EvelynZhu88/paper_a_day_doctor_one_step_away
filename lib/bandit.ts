// Simple multi-armed bandit using Thompson Sampling on Beta distributions.
// One "arm" per arXiv category. alpha = positive evidence, beta = negative.
// Uncertainty (wide Beta) → high exploration; sharp Beta → exploitation.

import { CategoryStats } from './types'

// Box-Muller standard normal sample.
function sampleNormal(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Marsaglia-Tsang gamma sampler — handles non-integer shape.
function sampleGamma(shape: number): number {
  if (shape < 1) {
    return sampleGamma(1 + shape) * Math.pow(Math.random(), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  while (true) {
    let x: number, v: number
    do {
      x = sampleNormal()
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * Math.pow(x, 4)) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

export function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(Math.max(alpha, 0.01))
  const y = sampleGamma(Math.max(beta, 0.01))
  return x / (x + y)
}

// Allocate `totalSlots` across the user's categories, weighted by Thompson
// samples. Categories with no recorded stats default to Beta(1,1), so they
// get a fair shot during cold start.
export function allocateSlots(
  categories: string[],
  stats: CategoryStats[],
  totalSlots: number,
): Record<string, number> {
  const statsMap = new Map(stats.map(s => [s.category, s]))
  const samples = categories.map(c => {
    const s = statsMap.get(c) ?? { category: c, alpha: 1, beta: 1 }
    return { category: c, score: sampleBeta(s.alpha, s.beta) }
  })

  const total = samples.reduce((sum, s) => sum + s.score, 0) || 1

  // Float allocation, then largest-remainder rounding so the total matches.
  const raw = samples.map(s => ({
    category: s.category,
    raw: (s.score / total) * totalSlots,
  }))
  const floor = raw.map(r => ({ category: r.category, slots: Math.floor(r.raw), frac: r.raw - Math.floor(r.raw) }))
  let assigned = floor.reduce((sum, f) => sum + f.slots, 0)
  const remainder = totalSlots - assigned
  floor.sort((a, b) => b.frac - a.frac)
  for (let i = 0; i < remainder && i < floor.length; i++) floor[i].slots += 1

  const out: Record<string, number> = {}
  for (const f of floor) out[f.category] = f.slots
  return out
}
