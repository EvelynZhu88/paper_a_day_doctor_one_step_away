'use client'

import { useRouter } from 'next/navigation'
import { useUserId } from './useUserId'

// Shared sticky header used on every authenticated page.
// Left side: brand + handle (always pinned to the top-left).
// Right side: nav links + sign out.
//
// Pages render this above their own page-specific title/sub-header.
export default function AppHeader({ active }: { active?: 'feed' | 'library' | 'settings' }) {
  const router = useRouter()
  const { handle, signOut } = useUserId()

  const linkClass = (id: 'feed' | 'library' | 'settings') =>
    `text-sm transition ${
      active === id ? 'text-ink font-medium' : 'text-muted hover:text-ink'
    }`

  return (
    <header className="sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-stone-200">
      <div className="max-w-screen-md mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <a href="/" className="flex flex-col leading-none shrink-0 hover:opacity-80 transition">
          <span className="text-lg font-semibold tracking-tight text-ink">Paper Feed</span>
          {handle && <span className="text-[11px] text-muted mt-0.5">@{handle}</span>}
        </a>
        <div className="flex items-center gap-3 sm:gap-4">
          <a href="/" className={linkClass('feed')}>Feed</a>
          <a href="/library" className={linkClass('library')}>Library</a>
          <a href="/onboarding" className={linkClass('settings')}>Settings</a>
          <button
            onClick={() => { signOut(); router.replace('/login') }}
            className="text-sm text-muted hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
