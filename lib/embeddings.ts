// Embeddings via Hugging Face Inference API (free tier).
// Model: sentence-transformers/all-MiniLM-L6-v2 → 384-dim vectors.
// Free tier limit is generous; ingesting ~50 abstracts/day is well within it.

const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
const HF_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`

export async function embedText(text: string): Promise<number[]> {
  const key = process.env.HUGGINGFACE_API_KEY
  if (!key) throw new Error('HUGGINGFACE_API_KEY is not set')

  const res = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: text.slice(0, 2000),  // truncate long abstracts to avoid 413s
      options: { wait_for_model: true },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HF embed failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  // The pipeline endpoint returns a single vector for feature-extraction.
  // Sometimes it's nested as [[...]], sometimes flat [...]. Normalize.
  if (Array.isArray(data) && Array.isArray(data[0])) return data[0] as number[]
  return data as number[]
}

// Embed many texts sequentially with a small delay so we don't trip the
// HF free-tier rate limit. Batch endpoints exist but are flakier on free tier.
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const out: number[][] = []
  for (const t of texts) {
    try {
      out.push(await embedText(t))
    } catch (err) {
      console.error('embed failed for one text — skipping:', err)
      out.push([])
    }
    await new Promise(r => setTimeout(r, 350))
  }
  return out
}

// Average a list of vectors (used to build the profile vector from seed papers).
export function averageVectors(vectors: number[][]): number[] | null {
  const valid = vectors.filter(v => v.length > 0)
  if (valid.length === 0) return null
  const dim = valid[0].length
  const sum = new Array(dim).fill(0)
  for (const v of valid) {
    for (let i = 0; i < dim; i++) sum[i] += v[i]
  }
  return sum.map(x => x / valid.length)
}

// Exponential moving average update: profile drifts toward `paper` by `lr`.
export function emaUpdate(profile: number[], paper: number[], lr: number): number[] {
  if (profile.length !== paper.length) return profile
  return profile.map((p, i) => (1 - lr) * p + lr * paper[i])
}
