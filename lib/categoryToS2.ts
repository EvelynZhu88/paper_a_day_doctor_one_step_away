// Map arXiv categories → Semantic Scholar's "fields of study" + a search query.
//
// S2's fields are coarser than arXiv's (Computer Science, Mathematics,
// Physics, etc.), so we narrow within each field via the search query —
// e.g. "robotics" within Computer Science, "optimization control" within
// Mathematics.

export type S2Mapping = {
  field: string  // S2 fieldOfStudy filter
  query: string  // S2 search query
}

// Tuned-by-hand queries for the most common categories. Anything not listed
// falls back to a default mapping based on the prefix.
const SPECIFIC: Record<string, S2Mapping> = {
  'cs.LG': { field: 'Computer Science', query: 'machine learning' },
  'cs.CL': { field: 'Computer Science', query: 'natural language processing' },
  'cs.CV': { field: 'Computer Science', query: 'computer vision' },
  'cs.AI': { field: 'Computer Science', query: 'artificial intelligence' },
  'cs.RO': { field: 'Computer Science', query: 'robotics' },
  'cs.NE': { field: 'Computer Science', query: 'neural networks evolutionary' },
  'cs.CR': { field: 'Computer Science', query: 'cryptography security' },
  'cs.IR': { field: 'Computer Science', query: 'information retrieval' },
  'cs.HC': { field: 'Computer Science', query: 'human computer interaction' },
  'cs.DC': { field: 'Computer Science', query: 'distributed computing' },
  'cs.DB': { field: 'Computer Science', query: 'databases' },
  'cs.DS': { field: 'Computer Science', query: 'algorithms data structures' },
  'cs.PL': { field: 'Computer Science', query: 'programming languages' },
  'cs.SE': { field: 'Computer Science', query: 'software engineering' },
  'cs.GT': { field: 'Computer Science', query: 'algorithmic game theory' },
  'cs.SI': { field: 'Computer Science', query: 'social networks' },
  'cs.IT': { field: 'Computer Science', query: 'information theory' },
  'cs.MA': { field: 'Computer Science', query: 'multi-agent systems' },
  'cs.GR': { field: 'Computer Science', query: 'computer graphics' },
  'cs.SD': { field: 'Computer Science', query: 'audio sound processing' },

  'stat.ML': { field: 'Mathematics', query: 'statistical machine learning' },
  'stat.ME': { field: 'Mathematics', query: 'statistical methodology' },
  'stat.AP': { field: 'Mathematics', query: 'applied statistics' },
  'stat.TH': { field: 'Mathematics', query: 'statistical theory' },
  'stat.CO': { field: 'Mathematics', query: 'computational statistics' },

  'eess.AS': { field: 'Engineering', query: 'audio speech processing' },
  'eess.IV': { field: 'Engineering', query: 'image video processing' },
  'eess.SP': { field: 'Engineering', query: 'signal processing' },
  'eess.SY': { field: 'Engineering', query: 'control systems' },

  'math.OC': { field: 'Mathematics', query: 'optimization control' },
  'math.PR': { field: 'Mathematics', query: 'probability theory' },
  'math.ST': { field: 'Mathematics', query: 'statistics theory' },
  'math.NA': { field: 'Mathematics', query: 'numerical analysis' },
  'math.AG': { field: 'Mathematics', query: 'algebraic geometry' },
  'math.AT': { field: 'Mathematics', query: 'algebraic topology' },
  'math.CO': { field: 'Mathematics', query: 'combinatorics' },
  'math.NT': { field: 'Mathematics', query: 'number theory' },
  'math.DG': { field: 'Mathematics', query: 'differential geometry' },
  'math.AP': { field: 'Mathematics', query: 'partial differential equations' },

  'q-bio.NC': { field: 'Biology', query: 'computational neuroscience' },
  'q-bio.GN': { field: 'Biology', query: 'genomics' },
  'q-bio.MN': { field: 'Biology', query: 'molecular networks' },
  'q-bio.BM': { field: 'Biology', query: 'biomolecules' },
  'q-bio.QM': { field: 'Biology', query: 'quantitative biology methods' },
  'q-bio.PE': { field: 'Biology', query: 'population evolution' },

  'q-fin.PM': { field: 'Economics', query: 'portfolio management' },
  'q-fin.MF': { field: 'Economics', query: 'mathematical finance' },
  'q-fin.RM': { field: 'Economics', query: 'risk management' },
  'q-fin.CP': { field: 'Economics', query: 'computational finance' },

  'econ.EM': { field: 'Economics', query: 'econometrics' },
  'econ.TH': { field: 'Economics', query: 'theoretical economics' },

  'astro-ph.CO': { field: 'Physics', query: 'cosmology' },
  'astro-ph.GA': { field: 'Physics', query: 'galaxies astrophysics' },
  'astro-ph.HE': { field: 'Physics', query: 'high energy astrophysics' },
  'cond-mat.mes-hall': { field: 'Physics', query: 'mesoscale nanoscale physics' },
  'cond-mat.mtrl-sci': { field: 'Materials Science', query: 'materials science' },
  'cond-mat.stat-mech': { field: 'Physics', query: 'statistical mechanics' },
  'cond-mat.str-el': { field: 'Physics', query: 'strongly correlated electrons' },
  'cond-mat.supr-con': { field: 'Physics', query: 'superconductivity' },
  'quant-ph': { field: 'Physics', query: 'quantum computing information' },
  'gr-qc': { field: 'Physics', query: 'general relativity quantum cosmology' },
  'hep-th': { field: 'Physics', query: 'high energy theory' },
  'hep-ph': { field: 'Physics', query: 'particle physics phenomenology' },

  'physics.optics': { field: 'Physics', query: 'optics photonics' },
  'physics.flu-dyn': { field: 'Physics', query: 'fluid dynamics' },
  'physics.bio-ph': { field: 'Physics', query: 'biological physics' },
  'physics.med-ph': { field: 'Medicine', query: 'medical physics' },
}

// Default fallback by category prefix
const PREFIX_DEFAULTS: { prefix: string; mapping: S2Mapping }[] = [
  { prefix: 'cs.', mapping: { field: 'Computer Science', query: 'computer science' } },
  { prefix: 'stat.', mapping: { field: 'Mathematics', query: 'statistics' } },
  { prefix: 'math.', mapping: { field: 'Mathematics', query: 'mathematics' } },
  { prefix: 'eess.', mapping: { field: 'Engineering', query: 'engineering' } },
  { prefix: 'astro-ph.', mapping: { field: 'Physics', query: 'astrophysics' } },
  { prefix: 'cond-mat.', mapping: { field: 'Physics', query: 'condensed matter' } },
  { prefix: 'physics.', mapping: { field: 'Physics', query: 'physics' } },
  { prefix: 'hep-', mapping: { field: 'Physics', query: 'high energy physics' } },
  { prefix: 'nucl-', mapping: { field: 'Physics', query: 'nuclear physics' } },
  { prefix: 'nlin.', mapping: { field: 'Mathematics', query: 'nonlinear dynamics' } },
  { prefix: 'q-bio.', mapping: { field: 'Biology', query: 'quantitative biology' } },
  { prefix: 'q-fin.', mapping: { field: 'Economics', query: 'quantitative finance' } },
  { prefix: 'econ.', mapping: { field: 'Economics', query: 'economics' } },
]

const SINGLE_DEFAULTS: Record<string, S2Mapping> = {
  'gr-qc': { field: 'Physics', query: 'gravity quantum cosmology' },
  'math-ph': { field: 'Physics', query: 'mathematical physics' },
  'quant-ph': { field: 'Physics', query: 'quantum physics' },
}

export function categoryToS2(catId: string): S2Mapping {
  if (SPECIFIC[catId]) return SPECIFIC[catId]
  if (SINGLE_DEFAULTS[catId]) return SINGLE_DEFAULTS[catId]
  for (const { prefix, mapping } of PREFIX_DEFAULTS) {
    if (catId.startsWith(prefix)) return mapping
  }
  return { field: 'Computer Science', query: catId }
}
