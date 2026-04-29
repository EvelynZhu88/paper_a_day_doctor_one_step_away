import { XMLParser } from 'fast-xml-parser'

export type ArxivPaper = {
  id: string
  title: string
  authors: string[]
  abstract: string
  categories: string[]
  primary_category: string | null
  pdf_url: string | null
  published_at: string | null
  journal_ref: string | null
  comment: string | null
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
})

const ARXIV_ENDPOINT = 'http://export.arxiv.org/api/query'

export async function fetchRecentPapers(
  categories: string[],
  maxResults = 50,
): Promise<ArxivPaper[]> {
  if (categories.length === 0) return []

  const query = categories.map(c => `cat:${c}`).join('+OR+')
  const url =
    `${ARXIV_ENDPOINT}?search_query=${query}` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'paper-feed (personal use)' },
  })
  if (!res.ok) throw new Error(`arxiv fetch failed: ${res.status}`)
  const xml = await res.text()
  const parsed = parser.parse(xml)

  const entries = toArray(parsed?.feed?.entry)
  return entries.map(parseEntry).filter(p => p !== null) as ArxivPaper[]
}

// Fetch specific arxiv IDs (used during onboarding to seed the profile vector).
export async function fetchById(ids: string[]): Promise<ArxivPaper[]> {
  if (ids.length === 0) return []
  const idList = ids.map(s => normalizeId(s)).join(',')
  const url = `${ARXIV_ENDPOINT}?id_list=${idList}&max_results=${ids.length}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'paper-feed (personal use)' },
  })
  if (!res.ok) throw new Error(`arxiv fetch failed: ${res.status}`)
  const xml = await res.text()
  const parsed = parser.parse(xml)
  const entries = toArray(parsed?.feed?.entry)
  return entries.map(parseEntry).filter(p => p !== null) as ArxivPaper[]
}

function parseEntry(e: any): ArxivPaper | null {
  if (!e) return null
  try {
    const fullId: string = e.id || ''
    const id = fullId.split('/abs/')[1]?.split('v')[0]  // strip version suffix
    if (!id) return null

    const authors = toArray(e.author).map((a: any) => a?.name).filter(Boolean)
    const categories = toArray(e.category).map((c: any) => c?.['@_term']).filter(Boolean)
    const links = toArray(e.link)
    const pdfLink = links.find((l: any) => l?.['@_type'] === 'application/pdf')

    const primary =
      e['arxiv:primary_category']?.['@_term'] ||
      categories[0] ||
      null

    // arxiv:journal_ref + arxiv:comment are the venue/conference hints.
    const journal_ref = stringOrNull(e['arxiv:journal_ref'])
    const comment = stringOrNull(e['arxiv:comment'])

    return {
      id,
      title: String(e.title || '').replace(/\s+/g, ' ').trim(),
      authors,
      abstract: String(e.summary || '').trim(),
      categories,
      primary_category: primary,
      pdf_url: pdfLink?.['@_href'] || null,
      published_at: e.published || null,
      journal_ref,
      comment,
    }
  } catch (err) {
    console.error('failed to parse arxiv entry:', err)
    return null
  }
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function stringOrNull(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') {
    const trimmed = v.replace(/\s+/g, ' ').trim()
    return trimmed.length > 0 ? trimmed : null
  }
  // fast-xml-parser sometimes wraps text nodes in objects with #text key
  if (typeof v === 'object' && v !== null && '#text' in v) {
    return stringOrNull((v as Record<string, unknown>)['#text'])
  }
  return null
}

function normalizeId(raw: string): string {
  // accept full URLs, "arxiv:" prefixes, or bare ids
  return raw
    .replace(/^https?:\/\/arxiv\.org\/abs\//, '')
    .replace(/^arxiv:/i, '')
    .replace(/v\d+$/, '')
    .trim()
}
