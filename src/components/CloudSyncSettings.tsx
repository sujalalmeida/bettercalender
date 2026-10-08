import { useEffect, useState } from 'preact/hooks'
import { createAccount, getCloudState, logIn, logOut, resetPassword, startCloudSync, subscribeCloudState, syncNow } from '../lib/cloudSync'

export default function CloudSyncSettings() {
  const [cloud, setCloud] = useState(getCloudState())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { startCloudSync(); return subscribeCloudState(setCloud) }, [])

  async function perform(action: () => Promise<void>) {
    setBusy(true)
    setMessage('')
    try { await action() } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
      setMessage(code === 'auth/invalid-credential' ? 'Email or password is incorrect.' : code === 'auth/email-already-in-use' ? 'This email already has an account. Sign in instead.' : code === 'auth/weak-password' ? 'Use a longer password.' : error instanceof Error ? error.message : 'Something went wrong.')
    } finally { setBusy(false) }
  }

  return <section class="settings-section cloud-sync-section">
    <h3>Cloud sync</h3>
    <p class="settings-hint">Changes save instantly on this device. Sign in with the same account on her iPad to sync notes, handwriting, tasks, categories, and templates through Firebase.</p>
    <p class="settings-hint" role="status">{cloud.status}</p>
    {!cloud.configured ? <p class="settings-hint">Add Firebase web config to .env.local before running the app.</p> : cloud.email ? <div class="settings-row-buttons">
      <span class="cloud-email">{cloud.email}</span>
      <button class="chip-btn" disabled={busy || cloud.syncing} onClick={() => perform(syncNow)}>Sync now</button>
      <button class="chip-btn chip-btn-muted" disabled={busy} onClick={() => perform(logOut)}>Sign out</button>
    </div> : <div class="cloud-auth-form">
      <label>Email <input type="email" value={email} autocomplete="email" onInput={e => setEmail((e.target as HTMLInputElement).value)} /></label>
      <label>Password <input type="password" value={password} autocomplete="current-password" onInput={e => setPassword((e.target as HTMLInputElement).value)} /></label>
      <div class="settings-row-buttons">
        <button class="chip-btn chip-btn-primary" disabled={busy || !email || !password} onClick={() => perform(() => logIn(email.trim(), password))}>Sign in</button>
        <button class="chip-btn" disabled={busy || !email || !password} onClick={() => perform(() => createAccount(email.trim(), password))}>Create account</button>
        <button class="chip-btn chip-btn-muted" disabled={busy || !email} onClick={() => perform(async () => { await resetPassword(email.trim()); setMessage('Password reset email sent.') })}>Reset password</button>
      </div>
    </div>}
    {message && <p class="settings-hint" role="alert">{message}</p>}
  </section>
}
