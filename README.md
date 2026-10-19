# Plan

A fast, offline-first, installable calendar PWA. It saves immediately in IndexedDB and can sync through Firebase after sign-in.

## Stack

Vite + TypeScript + Preact, plain CSS, Dexie for local storage, Firebase Authentication and Firestore for sync, `date-fns` for date math, `vite-plugin-pwa` for the service worker/manifest.

## Run it locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` or `.env.local` and enter the Firebase web app config and `GEMINI_API_KEY`. Both files are ignored by Git; if both exist, `.env.local` overrides matching values in `.env`. Vite embeds `VITE_` values in the browser build, so Firebase security comes from Authentication and Firestore rules. The unprefixed `GEMINI_API_KEY` is used only by the local development server; deployed Gemini uses a private Cloudflare Worker secret.

## Enable Firebase sync

1. Firebase Authentication Email/Password and the Firestore rules in [firestore.rules](firestore.rules) are enabled in `bettecalender`. If setting up a different project, create a Cloud Firestore database and run `firebase deploy --only auth,firestore:rules --project YOUR_PROJECT_ID`. The rules restrict each user's records to that signed-in account. A static upload does not deploy Firebase configuration or rules.
2. For a local build, use the Firebase variables in `.env` or `.env.local`. For a Git-connected build, configure them in Cloudflare's build settings.
3. Open **Settings → Cloud sync**, create an account, then sign in with that same account on the iPad. Sign-in alone does not prove the backend is configured; wait for “Synced”

Changes are written to Dexie first. Pending cloud changes survive offline use and reloads. Failed uploads retry automatically; returning online or reopening the app resumes sync. Tasks are uploaded ahead of large whiteboards, and one failed record does not stop the rest of the queue. The first sign-in merges existing on-device records with cloud records; later changes sync by record, including deletions. A local data set is linked to its first signed-in account to prevent mixing two private calendars on one device. Keep JSON exports as an additional backup, especially for extensive handwriting. End-to-end cloud saving still needs an account created in Settings and a signed-in browser.

Open the printed `http://localhost:5173` URL. To test the interface on a phone on the same Wi-Fi, run `npm run dev -- --host 0.0.0.0` and open `http://<your-Mac-LAN-IP>:5173`. iOS requires HTTPS for service workers and Home Screen installation, so use the deployed URL for offline and install tests.

Note: the service worker is disabled in `npm run dev` (that's normal/expected for fast iteration). To test the real offline/install behavior, build + preview instead:

```bash
npm run build
npm run preview
```

This serves the production app (with the service worker) at `http://localhost:4173` on the Mac. Gemini requests require the Cloudflare worker, so use `npm run dev` for local Gemini testing.

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

Type-checks (`tsc -b`) then produces `dist/`: the web app plus `_worker.js`, a Cloudflare Worker that reads the private Gemini runtime secret and verifies Firebase sign-in before calling Gemini. The generated `.assetsignore` prevents Wrangler from publishing `_worker.js` as a static asset.

## Deploy to the existing Cloudflare Worker

The current site, `bettercalender.sujalalmeida13.workers.dev`, is a **Cloudflare Worker**, not a Pages site. Dragging `dist/` into its static-assets uploader updates the interface but does not install the `/api/gemini` code. From this project, with Wrangler signed in and `.env` filled in, run:

```bash
npm run deploy:worker
```

This builds the app and deploys both its assets and server code to the existing `bettercalender` Worker. The `wrangler.jsonc` configuration routes `/api/*` to the Worker, while ordinary assets stay fast. Add or replace the server-side key with `npx wrangler secret put GEMINI_API_KEY --name bettercalender`; Wrangler prompts for its value. Never commit the key or generated `dist/` folder.

Alternatively, a **separate Cloudflare Pages** project can accept a complete `dist/` Direct Upload, including `_worker.js`, as a Pages Function, but its `GEMINI_API_KEY` must be set as a Pages runtime secret. That produces a different Pages URL. Do not upload `dist/` to an ordinary static host, which could serve `_worker.js` as a downloadable file.

## Install on iPhone / iPad

1. Open the deployed URL in **Safari** (must be Safari, not Chrome, for "Add to Home Screen" to produce a full standalone app).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch Plan from the Home Screen icon — it opens full-screen, no browser chrome, and works with no connection.

The app shows this same guidance itself the first time it's opened in mobile Safari (and never again once installed).

## Back up your data

Settings → **Export JSON** downloads everything (typed notes, handwritten pages, tasks, recurrences, categories, templates, settings) as one file. **Import JSON** restores it, with a choice to merge into or replace existing data. Offline data remains in this browser's IndexedDB. After cloud sync is configured and she signs in, Firebase provides a second copy and cross-device access. Older version 1, 2 and 3 backups still import.

## Daily timeline and refreshed design

The Today tab opens a daily timeline with a seven-day date strip, anytime and scheduled tasks, progress, quick task entry, and a direct link to the day's checklist and Apple Pencil whiteboard. Month, Week, Revision, Skills, Milestones, search, settings, backups and sync remain available. The interface uses a monochrome editorial style with no gradients. The timeline reads and writes the same task records as Month and Week. Month cells grow to fit wrapped notes and tasks, with a taller minimum height. On narrow screens the month grid scrolls horizontally rather than squeezing its columns. Week shows typed notes, recognized handwriting and the full task list. Search covers complete notes and handwriting and updates when synced content changes.

## Focus Garden

The **Focus** button opens a separate window with a stopwatch and a green garden. The garden starts empty, then grows lilies, white roses and red roses as focused time passes. Pause and continue the timer, or start a new garden. The current stopwatch is saved in this browser so a refresh keeps its time and flowers. Closing the focus window pauses the timer; focus progress is local to that browser and is not included in Firebase sync or JSON backups.

## Apple Pencil on iPad

Open a day. The Apple Pencil whiteboard is first and fills most of the opened day; typed Notes are below it. On iPad, the day opens as a large animated card over the month or week. The canvas supports pressure-sensitive ink, color and size choices, stroke erasing, undo/redo, multiple pages, and saving the current page as a PNG. Pencil strokes save automatically in IndexedDB and are included in sync and JSON backups. Fingers scroll the page by default; turn on **Draw with finger** to use a finger or a basic stylus as a pen. A mouse also draws for Mac testing.

The ordinary Notes area, task field, and search field remain standard text controls, so iPadOS Scribble can turn Pencil handwriting there into typed text. The freehand page keeps writing as ink. Browser Pointer Events expose Pencil pressure and tilt on supported iPadOS versions; hardware-specific double-tap and squeeze gestures are not part of this web UI.

After closing a day, Plan transcribes changed Pencil pages with Gemini and shows the recognized text in the Month cell. The cell shows a short moving "Reading handwriting" highlight while it works. Reopening the day retains every original stroke. The transcription is saved with the day, synced and backed up; unchanged pages do not make another AI request. If transcription fails, the cell offers a retry when the day is reopened and closed. Transcription needs an internet connection and the Gemini setup below, and the handwritten page images are sent to Google for processing. Avoid patient details and private diary content on the whiteboard.

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

Most local data access goes through `src/db/repository.ts`. `src/lib/syncQueue.ts` records local changes, and `src/lib/cloudSync.ts` reconciles them with Firestore.

## What's implemented vs. deferred

Implemented: daily timeline, month grid + swipe navigation, the expand/collapse interaction (FLIP, large animated day card on phone and tablet, reduced-motion fallback), notes with debounced autosave, checklist (add/complete/reorder/swipe-to-delete-with-undo), per-task time/category/deadline, recurrence (daily/weekdays/weekly/monthly/custom, with "this occurrence" vs "all future" edits), roll-over banner, Due Soon strip + exam countdown, week view, search, `.ics` export with reminders, JSON export/import (including settings), Home Screen app badge, full settings (theme/week-start/categories/template tasks/reminder default), install guide, update-available toast.

**Notifications:** Due Soon, overdue items, and app badge counts update in the app. A task's Calendar export includes an Apple Calendar alert that works after import. Plan does not currently deliver its own device push notifications while closed. iPadOS Home Screen web apps support Web Push, but that requires a push subscription, permission, and a server to schedule/send reminders; Firebase database sync alone does not send them. `src/lib/webPushStub.ts` documents the unimplemented push interface.

The first successful launch creates an installation marker. If browser storage is later wiped, Plan shows a recovery message with a prompt to import a backup. If the browser denies persistent storage, Plan explains why regular exports matter.

## Manual QA checklist (iPhone / iPad)

- [ ] Tap a day → expands smoothly; swipe down / tap backdrop / tap "Done" → collapses back to the same box.
- [ ] On iPad, opening a day shows a large animated card with the whiteboard first and enough room to write.
- [ ] Typing in Notes below the whiteboard never gets hidden behind the keyboard; the keyboard doesn't pop up just from expanding a day.
- [ ] On iPad, use Apple Pencil to write in a day; test pressure changes, eraser, undo/redo, page changes, rotation, reopen, and JSON backup/import.
- [ ] Try Scribble in Notes and Add a task; verify a finger scrolls the handwriting page until Draw with finger is enabled.
- [ ] Turn on Airplane Mode, re-open the installed app — it opens instantly and everything still works.
- [ ] Add to Home Screen from Safari; re-open from the Home Screen icon — no browser chrome, correct status bar style.
- [ ] Toggle the device between light and dark mode (and the in-app Settings override) — contrast stays good everywhere.
- [ ] Rotate an iPad between portrait/landscape mid-use — layout reflows, nothing clips.
- [ ] After a new deployment, reopening the app shows the "Update available — tap to refresh" toast instead of silently reloading.

## Revision, skills and milestones

The top tabs open separate Revision, Skills and Milestones workspaces. Each can be filled in manually. Revision keeps weak topics, confidence, and a next review date; after a review, confidence 1/2/3 schedules another look in 1/3/7 days. Skills stores brief learning or practice notes with a next step and status. Milestones stores exams, applications, electives, references and forms with optional deadlines and checklists. Avoid patient-identifying details in all notes. These records are saved offline first, included in version 4 JSON backups, and synced through Firestore when cloud sync is connected.

### Optional Gemini suggestions

Gemini can create separate review, skill or milestone cards from a full typed or keyboard-dictated request, an image/PDF schedule or syllabus, or an audio recording. Every suggestion appears in an editable review card; save cards individually or all at once. Audio and uploaded files are sent to Gemini on Analyze; they are not stored in the app. Keep patient details and sensitive personal notes out of AI input.

This uses the `GEMINI_API_KEY` from `.env` for local development and a private Cloudflare runtime secret when deployed. No Firebase App Check site key is needed. Gemini requests go through the Cloudflare worker, which verifies the user's Firebase sign-in before calling Google. The same path powers handwriting transcription. Set `VITE_GEMINI_MODEL` to a Gemini model enabled for the key; the default is `gemini-3.8-flash`.

Firestore cloud sync still requires Firebase Authentication Email/Password and the rules above. In Settings → Cloud sync, sign in and wait for “Synced” Gemini also requires this sign-in. Manual entry works offline without Gemini. Avoid patient-identifying or private diary content in AI input.
