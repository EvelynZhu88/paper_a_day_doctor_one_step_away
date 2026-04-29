// Extract a short, card-friendly venue label from arXiv's journal_ref / comment.
//
// arXiv's journal_ref is the clean source ("NeurIPS 2024", "Phys. Rev. D
// 109, 052003"). When that's absent, the comment field often contains
// venue hints like "to appear at ICML 2025" or "accepted to CVPR 2025".

const COMMENT_VENUE_PATTERNS = [
  // "accepted at/to/by NeurIPS 2024"
  /\b(?:accepted|to appear|published)\s+(?:at|to|by|in)\s+([A-Z][A-Za-z0-9 .&'/-]+?(?:\s+\d{4})?)(?=[.,;)]|$)/i,
  // "X 2024" — bare conf-and-year mention near the start
  /\b((?:NeurIPS|ICML|ICLR|CVPR|ECCV|ICCV|ACL|EMNLP|NAACL|AAAI|IJCAI|KDD|SIGGRAPH|RSS|CoRL|ICRA|IROS|UAI|AISTATS)\s+\d{4})\b/i,
]

export function extractVenue(
  journal_ref?: string | null,
  comment?: string | null,
): string | null {
  if (journal_ref && journal_ref.trim().length > 0) {
    return shorten(journal_ref.trim())
  }
  if (comment && comment.trim().length > 0) {
    for (const re of COMMENT_VENUE_PATTERNS) {
      const m = comment.match(re)
      if (m && m[1]) return shorten(m[1].trim())
    }
  }
  return null
}

function shorten(s: string): string {
  // strip trailing periods and clamp length so it fits on a card
  const clean = s.replace(/\.$/, '').trim()
  return clean.length > 40 ? clean.slice(0, 37) + '…' : clean
}
