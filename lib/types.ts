export type Paper = {
  id: string
  title: string
  authors: string[]
  abstract: string
  categories: string[]
  primary_category: string | null
  pdf_url: string | null
  published_at: string | null
  similarity?: number
}

export type EventType =
  | 'impression'
  | 'dwell'
  | 'tap'
  | 'long_view'
  | 'save'
  | 'pdf_open'

export type Interaction = {
  paper_id: string
  event_type: EventType
  duration_ms?: number
}

export type UserPreferences = {
  id: number
  categories: string[]
  profile_vector: number[] | null
  daily_count: number
  exploration_rate: number
  onboarded: boolean
}

export type CategoryStats = {
  category: string
  alpha: number
  beta: number
}

// Reward weights for converting interaction events into bandit signal.
// Tweak these to taste once you have real swipe data.
export const REWARD_WEIGHTS: Record<EventType, number> = {
  impression: 0,
  dwell: 0.1,
  tap: 0.3,
  long_view: 0.5,
  save: 0.7,
  pdf_open: 1.0,
}

// Learning rate for updating the profile vector after a positive event.
// Higher values = profile shifts more aggressively per interaction.
export const PROFILE_LR: Record<EventType, number> = {
  impression: 0,
  dwell: 0.02,
  tap: 0.04,
  long_view: 0.06,
  save: 0.10,
  pdf_open: 0.12,
}
