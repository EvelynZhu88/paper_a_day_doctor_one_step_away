// Semantic Scholar wrapper. Free tier — no key required for low volume.
// We use the bulk-search endpoint because it supports sort=citationCount:desc.
//
// Docs: https://api.semanticscholar.org/api-docs/

const S2_BULK = 'https://api.semanticscholar.org/graph/v1/paper/search/bulk'
const S2_FIELDS = [
  'paperId',
  'externalIds',
  'title',
  'abstract',
  'authors',
  'year',
  'publicationVenue',
  'publicationDate',
  'openAccessPdf',
  'citationCount',
  'fieldsOfStudy',
].join(',')

export type S2Paper = {
  id: string                   // arXiv id if present, else "s2:<paperId>"
  title: string
  authors: string[]
  abstract: string
  arxiv_id: string | null
  pdf_url: string | null
  published_at: string | null
  venue: string | null
  citation_count: number
}

export async function fetchTopCited(
  query: string,
  fieldOfStudy: string,
  limit: number,
): Promise<S2Paper[]> {
  if (!query || limit <= 0) return []

  const url = new URL(S2_BULK)
  url.searchParams.set('query', query)
  url.searchParams.set('fieldsOfStudy', fieldOfStudy)
  url.searchParams.set('sort', 'citationCount:desc')
  url.searchParams.set('fields', S2_FIELDS)

  const headers: Record<string, string> = {}
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY
  }

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`S2 bulk search failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = await res.json()
  const data: any[] = json?.data ?? []

  // Filter to papers that have an abstract (we need it for embedding)
  const usable = data
    .filter(p => p?.abstract && typeof p.abstract === 'string' && p.abstract.length > 50)
    .slice(0, limit)

  return usable.map(toS2Paper)
}

function toS2Paper(p: any): S2Paper {
  const arxivId: string | null =
    p?.externalIds?.ArXiv ??
    p?.externalIds?.arXiv ??
    null
  const id = arxivId ? String(arxivId).replace(/v\d+$/, '') : `s2:${p.paperId}`

  const authors = Array.isArray(p.authors)
    ? p.authors.map((a: any) => a?.name).filter((n: any) => typeof n === 'string')
    : []

  const venue =
    p?.publicationVenue?.name ??
    null

  // Construct a published_at from publicationDate or year
  let published_at: string | null = null
  if (typeof p.publicationDate === 'string' && p.publicationDate.length > 0) {
    published_at = p.publicationDate
  } else if (typeof p.year === 'number') {
    published_at = `${p.year}-01-01`
  }

  // Prefer arXiv abs URL when we have an arXiv id; else S2's openAccessPdf
  const pdf_url =
    arxivId
      ? `https://arxiv.org/pdf/${arxivId}`
      : (p?.openAccessPdf?.url ?? null)

  return {
    id,
    title: String(p.title ?? '').replace(/\s+/g, ' ').trim(),
    authors,
    abstract: String(p.abstract ?? '').trim(),
    arxiv_id: arxivId,
    pdf_url,
    published_at,
    venue,
    citation_count: typeof p.citationCount === 'number' ? p.citationCount : 0,
  }
}
