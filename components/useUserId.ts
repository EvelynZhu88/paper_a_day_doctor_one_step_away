// Tiny client-side hook for the user's handle + key, stored in localStorage.
// Also exposes `authedFetch` which adds the X-User-Id / X-User-Key headers
// to any fetch call automatically.

'use client'

import { useEffect, useState } from 'react'

const HANDLE_KEY = 'paper-feed-handle'
const KEY_KEY = 'paper-feed-key'

export function getStoredHandle(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(HANDLE_KEY)
}

export function getStoredKey(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEY_KEY)
}

export function setStoredCreds(handle: string, key: string) {
  localStorage.setItem(HANDLE_KEY, handle)
  localStorage.setItem(KEY_KEY, key)
}

export function clearStoredCreds() {
  localStorage.removeItem(HANDLE_KEY)
  localStorage.removeItem(KEY_KEY)
}

export function authHeaders(): Record<string, string> {
  const handle = getStoredHandle()
  const key = getStoredKey()
  const h: Record<string, string> = {}
  if (handle) h['X-User-Id'] = handle
  if (key) h['X-User-Key'] = key
  return h
}

export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {})
  for (const [k, v] of Object.entries(authHeaders())) headers.set(k, v)
  return fetch(url, { ...init, headers })
}

// React hook variant. Returns the current handle (null if not signed in)
// and a hydrated flag so SSR-rendered pages don't flicker.
export function useUserId(): { handle: string | null; hydrated: boolean; signOut: () => void } {
  const [handle, setHandle] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHandle(getStoredHandle())
    setHydrated(true)
  }, [])

  return {
    handle,
    hydrated,
    signOut: () => {
      clearStoredCreds()
      setHandle(null)
    },
  }
}
