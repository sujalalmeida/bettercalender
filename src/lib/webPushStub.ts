/**
 * Phase 2 stub — NOT enabled in Phase 1.
 *
 * Plan is local-first with no backend, so deadline reminders in Phase 1 are
 * delivered via in-app alerts (the Due Soon strip, overdue/due-today
 * highlights, the Home Screen app badge) and the user-triggered "Add alert
 * to Calendar" .ics export. iOS PWAs cannot schedule local notifications
 * from within the app itself.
 *
 * When a backend exists (see the `repository` layer in `src/db/repository.ts`,
 * which is already the single seam between the UI and storage — swapping its
 * internals for a synced API is the intended Phase 2 migration path), wire
 * this up by:
 *
 *   1. Calling `subscribeToPush()` once after the user opts in (e.g. a
 *      "Notify me about deadlines" toggle in Settings).
 *   2. Sending the returned `PushSubscription` to your backend and storing
 *      it against the user's account.
 *   3. Running a scheduled server job that reads upcoming deadlines and
 *      sends Web Push messages to stored subscriptions.
 *   4. Adding a `push` event listener in the service worker (via
 *      `vite-plugin-pwa`'s `injectManifest` strategy, or a custom SW) that
 *      calls `self.registration.showNotification(...)`.
 *
 * None of this is wired up yet — calling `subscribeToPush()` today will
 * throw if VAPID_PUBLIC_KEY is not configured, by design.
 */

export interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** Replace with a real VAPID public key when a push backend exists. */
const VAPID_PUBLIC_KEY: string | null = null

export async function isPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function subscribeToPush(): Promise<PushSubscriptionPayload> {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Web Push is a Phase 2 feature: no VAPID key / backend is configured yet.')
  }
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY
  })
  return subscription.toJSON() as PushSubscriptionPayload
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  await subscription?.unsubscribe()
}
