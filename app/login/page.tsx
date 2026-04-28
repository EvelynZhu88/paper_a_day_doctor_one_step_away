'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setStoredCreds } from '@/components/useUserId'

type Mode = 'welcome' | 'claim' | 'signin'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('welcome')

  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-center">Paper Feed</h1>
        <p className="text-muted text-sm mt-2 text-center">
          A personalized arXiv feed.
        </p>

        {mode === 'welcome' && <Welcome onClaim={() => setMode('claim')} onSignIn={() => setMode('signin')} />}
        {mode === 'claim' && <ClaimForm onBack={() => setMode('welcome')} onDone={() => router.push('/onboarding')} />}
        {mode === 'signin' && <SignInForm onBack={() => setMode('welcome')} onDone={(onboarded) => router.push(onboarded ? '/' : '/onboarding')} />}
      </div>
    </main>
  )
}

function Welcome({ onClaim, onSignIn }: { onClaim: () => void; onSignIn: () => void }) {
  return (
    <div className="mt-10 space-y-3">
      <button
        onClick={onClaim}
        className="w-full bg-ink text-white rounded-lg py-3 text-sm font-medium"
      >
        Start fresh — pick a handle
      </button>
      <button
        onClick={onSignIn}
        className="w-full bg-white border border-stone-300 text-ink rounded-lg py-3 text-sm font-medium hover:border-ink"
      >
        I already have a handle
      </button>
      <p className="text-xs text-muted text-center pt-3 leading-relaxed">
        No email, no signup. Pick a handle + a 6+ character key —
        that's your only login. Save them somewhere safe.
      </p>
    </div>
  )
}

function ClaimForm({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [handle, setHandle] = useState('')
  const [key, setKey] = useState('')
  const [confirmKey, setConfirmKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    if (key !== confirmKey) {
      setErr('keys do not match')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim().toLowerCase(), key }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'failed')
      setStoredCreds(handle.trim().toLowerCase(), key)
      onDone()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 space-y-3">
      <button onClick={onBack} className="text-xs text-muted">← Back</button>

      <div>
        <label className="text-xs text-muted">Pick a handle</label>
        <input
          value={handle}
          onChange={e => setHandle(e.target.value)}
          placeholder="e.g. evelyn-papers"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full mt-1 border border-stone-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-ink"
        />
        <p className="text-[11px] text-muted mt-1">
          3-30 chars, lowercase letters + digits + hyphens, must start with a letter.
        </p>
      </div>

      <div>
        <label className="text-xs text-muted">Set a key (6+ characters)</label>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          className="w-full mt-1 border border-stone-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="text-xs text-muted">Confirm key</label>
        <input
          type="password"
          value={confirmKey}
          onChange={e => setConfirmKey(e.target.value)}
          className="w-full mt-1 border border-stone-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-ink"
        />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[12px] text-amber-900 leading-relaxed">
        <strong>Save your handle and key somewhere safe.</strong> There is no
        email recovery — if you forget them, your reading history is gone.
      </div>

      {err && <p className="text-accent text-sm">{err}</p>}

      <button
        onClick={submit}
        disabled={busy || !handle || !key || !confirmKey}
        className="w-full bg-ink text-white rounded-lg py-3 text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create handle and continue'}
      </button>
    </div>
  )
}

function SignInForm({ onBack, onDone }: { onBack: () => void; onDone: (onboarded: boolean) => void }) {
  const [handle, setHandle] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    setBusy(true)
    try {
      const h = handle.trim().toLowerCase()
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: h, key }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'failed')
      setStoredCreds(h, key)
      onDone(!!data.onboarded)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 space-y-3">
      <button onClick={onBack} className="text-xs text-muted">← Back</button>

      <div>
        <label className="text-xs text-muted">Handle</label>
        <input
          value={handle}
          onChange={e => setHandle(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full mt-1 border border-stone-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-ink"
        />
      </div>

      <div>
        <label className="text-xs text-muted">Key</label>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          className="w-full mt-1 border border-stone-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-ink"
        />
      </div>

      {err && <p className="text-accent text-sm">{err}</p>}

      <button
        onClick={submit}
        disabled={busy || !handle || !key}
        className="w-full bg-ink text-white rounded-lg py-3 text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </div>
  )
}
