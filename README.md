# Plan

A fast, offline-first, installable calendar PWA built around one idea: tap a day, plan your day. Everything lives on-device (IndexedDB via Dexie) — no account, no backend, no cost to run.

## Stack

Vite + TypeScript + Preact, plain CSS (no framework), Dexie for storage, `date-fns` for date math, `vite-plugin-pwa` for the service worker/manifest.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL. To test the interface on a phone on the same Wi-Fi, run `npm run dev -- --host 0.0.0.0` and open `http://<your-Mac-LAN-IP>:5173`. iOS requires HTTPS for service workers and Home Screen installation, so use the deployed URL for offline and install tests.

Note: the service worker is disabled in `npm run dev` (that's normal/expected for fast iteration). To test the real offline/install behavior, build + preview instead:

```bash
npm run build
npm run preview
```

This serves the production build (with the service worker) at `http://localhost:4173` on the Mac. Localhost is a secure context; a plain HTTP LAN URL is not.

## Test

```bash
npm run test        # one-off run
npm run test:watch  # watch mode
```

Covers recurrence expansion, `.ics` generation, date-range queries (including the virtual/materialized recurrence merge), and backup-import validation.

## Build

```bash
npm run build
```

Type-checks (`tsc -b`) then produces a static `dist/` folder — plain HTML/CSS/JS, deployable anywhere that serves static files.

## Deploy to Cloudflare Pages (free)

1. Push this repo to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick the repo.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy. Cloudflare gives you a `https://<project>.pages.dev` URL — that's the link to open on the iPhone.

Netlify also publishes `dist` with the same build command. For a GitHub Pages project URL under `/<repository>/`, set Vite's `base` and the manifest `start_url`/`scope` to that prefix before building; the default configuration targets a site served at `/`.

## Install on iPhone / iPad

1. Open the deployed URL in **Safari** (must be Safari, not Chrome, for "Add to Home Screen" to produce a full standalone app).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch Plan from the Home Screen icon — it opens full-screen, no browser chrome, and works with no connection.

The app shows this same guidance itself the first time it's opened in mobile Safari (and never again once installed).

## Back up your data

Settings → **Export JSON** downloads everything (typed notes, handwritten pages, tasks, recurrences, categories, templates, settings) as one file. **Import JSON** restores it, with a choice to merge into or replace existing data. Everything lives in this browser's IndexedDB only — exporting is the only way to move data to a new device or recover from clearing site data. Older version 1 and 2 backups still import.

## Apple Pencil on iPad

Open a day and tap **Handwrite with Apple Pencil**. The full-screen page supports pressure-sensitive ink, color and size choices, stroke erasing, undo/redo, multiple pages, and saving the current page as a PNG. Pencil strokes save automatically in IndexedDB and are included in JSON backups. Fingers scroll the page by default; turn on **Draw with finger** to use a finger or a basic stylus as a pen. A mouse also draws for Mac testing.

The ordinary Notes area, task field, and search field remain standard text controls, so iPadOS Scribble can turn Pencil handwriting there into typed text. The freehand page keeps writing as ink. Browser Pointer Events expose Pencil pressure and tilt on supported iPadOS versions; hardware-specific double-tap and squeeze gestures are not part of this web UI.

## Project layout

```
src/
  components/   UI components (MonthGrid, DayCell, DayPanelContent, Checklist, …)
  db/           Dexie schema (db.ts), the repository layer (repository.ts) — the
                only place that talks to IndexedDB — and shared types
  lib/          Date helpers, recurrence expansion, .ics generation, FLIP
                animation helpers, settings store, small hooks
  styles/       Plain CSS (theme.css = tokens/dark mode, app.css = components)
```

All data access goes through `src/db/repository.ts`. That's intentional: a future sync backend (Phase 2) is a matter of changing what's behind those functions, not rewriting the UI.

## What's implemented vs. deferred

Implemented: month grid + swipe navigation, the expand/collapse interaction (FLIP, phone overlay vs. tablet in-grid expand, reduced-motion fallback), notes with debounced autosave, checklist (add/complete/reorder/swipe-to-delete-with-undo), per-task time/category/deadline, recurrence (daily/weekdays/weekly/monthly/custom, with "this occurrence" vs "all future" edits), roll-over banner, Due Soon strip + exam countdown, week view, search, `.ics` export with reminders, JSON export/import (including settings), Home Screen app badge, full settings (theme/week-start/categories/template tasks/reminder default), install guide, update-available toast.

Deferred by design: Web Push notifications (`src/lib/webPushStub.ts` documents the interface and migration steps; it requires a backend).

The first successful launch creates an installation marker. If browser storage is later wiped, Plan shows a recovery message with a prompt to import a backup. If the browser denies persistent storage, Plan explains why regular exports matter.

## Manual QA checklist (iPhone / iPad)

- [ ] Tap a day → expands smoothly; tap again / swipe down / tap backdrop / tap "Done" → collapses back to the same box.
- [ ] On iPad, expanding a day grows it in place in the grid (not a full-screen sheet) and neighboring days reflow.
- [ ] Typing in Notes never gets hidden behind the keyboard; the keyboard doesn't pop up just from expanding a day.
- [ ] On iPad, use Apple Pencil to write in a day; test pressure changes, eraser, undo/redo, page changes, rotation, reopen, and JSON backup/import.
- [ ] Try Scribble in Notes and Add a task; verify a finger scrolls the handwriting page until Draw with finger is enabled.
- [ ] Turn on Airplane Mode, re-open the installed app — it opens instantly and everything still works.
- [ ] Add to Home Screen from Safari; re-open from the Home Screen icon — no browser chrome, correct status bar style.
- [ ] Toggle the device between light and dark mode (and the in-app Settings override) — contrast stays good everywhere.
- [ ] Rotate an iPad between portrait/landscape mid-use — layout reflows, nothing clips.
- [ ] After a new deployment, reopening the app shows the "Update available — tap to refresh" toast instead of silently reloading.
