// Root: client-side auth guard.
// - No stored creds → /login
// - Creds present but not onboarded → /onboarding
// - Otherwise → render Feed

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Feed from '@/components/Feed'
import AppHeader from '@/components/AppHeader'
import { authedFetch, getStoredHandle, useUserId } from '@/components/useUserId'

export default function Home() {
  const router = useRouter()
  const { handle, hydrated, signOut } = useUserId()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hydrated) return
    if (!handle) {
      router.replace('/login')
      return
    }
    let cancelled = false
    authedFetch('/api/auth/check')
      .then(async r => {
        const data = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) {
          if (r.status === 401) {
            router.replace('/login')
            return
          }
          setError(data?.error ?? 'auth check failed')
          setStatus('error')
          return
        }
        if (!data.onboarded) {
          router.replace('/onboarding')
          return
        }
        setStatus('ready')
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [hydrated, handle, router])

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Loading…</p>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <p className="text-accent text-sm">{error}</p>
          <button
            onClick={() => { signOut(); router.replace('/login') }}
            className="mt-4 text-sm underline text-muted"
          >
            Sign out and try again
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <AppHeader active="feed" />
      <Feed />
    </main>
  )
}
