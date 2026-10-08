/** Sets the installed app's Home Screen badge to the given count (Badging API; silently no-ops where unsupported, e.g. iOS Safari outside standalone). */
export function setAppBadgeCount(count: number): void {
  if (!('setAppBadge' in navigator)) return
  const nav = navigator as Navigator & { setAppBadge(count?: number): Promise<void>; clearAppBadge(): Promise<void> }
  if (count > 0) {
    nav.setAppBadge(count).catch(() => {})
  } else {
    nav.clearAppBadge().catch(() => {})
  }
}
