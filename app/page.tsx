// Root route: checks whether the user has finished onboarding.
// If yes → render the feed. If no → redirect to /onboarding.

import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import Feed from '@/components/Feed'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let onboarded = false
  try {
    const sb = supabaseAdmin()
    const { data } = await sb
      .from('user_preferences')
      .select('onboarded')
      .eq('id', 1)
      .single()
    onboarded = !!data?.onboarded
  } catch (err) {
    console.error('failed to check onboarding state:', err)
  }

  if (!onboarded) redirect('/onboarding')

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-stone-200">
        <div className="max-w-screen-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Paper Feed</h1>
          <a href="/onboarding" className="text-sm text-muted hover:text-ink">Settings</a>
        </div>
      </header>
      <Feed />
    </main>
  )
}
