# Plan

A fast, offline-first, installable calendar PWA. It saves immediately in IndexedDB and can sync through Firebase after sign-in.

## Stack

Vite + TypeScript + Preact, plain CSS, Dexie for local storage, Firebase Authentication and Firestore for sync, `date-fns` for date math, `vite-plugin-pwa` for the service worker/manifest.

## Run it locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and enter your Firebase web app config. The local `.env.local` is ignored by Git. Vite embeds `VITE_` values in the browser build, so Firebase security must come from Authentication and Firestore rules, not secrecy of the web API key.

## Enable Firebase sync

1. In the Firebase console for the project, enable **Authentication → Sign-in method → Email/Password**.
2. Create a **Cloud Firestore** database and deploy [firestore.rules](firestore.rules). With the Firebase CLI authenticated, run `firebase deploy --only firestore:rules --project bettecalender`. The rules restrict each user's records to that signed-in account.
3. Configure the same `VITE_FIREBASE_*` environment values on your hosting provider, then rebuild and deploy. A `.env.local` on the Mac does not configure a remote deployment.
4. Open **Settings → Cloud sync**, create an account, then sign in with that same account on the iPad. Sign-in alone does not prove the backend is configured; wait for “Saved on this device and synced to Firebase.”

Changes are written to Dexie first. Pending cloud changes survive offline use and reloads. The first sign-in merges existing on-device records with cloud records; later changes sync by record, including deletions. A local data set is linked to its first signed-in account to prevent mixing two private calendars on one device. Keep JSON exports as an additional backup, especially for extensive handwriting. Firebase cannot be tested end to end without enabling Authentication, Firestore, and the rules in the Firebase project.

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

Settings → **Export JSON** downloads everything (typed notes, handwritten pages, tasks, recurrences, categories, templates, settings) as one file. **Import JSON** restores it, with a choice to merge into or replace existing data. Offline data remains in this browser's IndexedDB. After cloud sync is configured and she signs in, Firebase provides a second copy and cross-device access. Older version 1, 2 and 3 backups still import.

## Apple Pencil on iPad

Open a day. The Apple Pencil whiteboard is first and fills most of the opened day; typed Notes are below it. On iPad, the day opens as a large animated card over the month or week. The canvas supports pressure-sensitive ink, color and size choices, stroke erasing, undo/redo, multiple pages, and saving the current page as a PNG. Pencil strokes save automatically in IndexedDB and are included in sync and JSON backups. Fingers scroll the page by default; turn on **Draw with finger** to use a finger or a basic stylus as a pen. A mouse also draws for Mac testing.

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

Most local data access goes through `src/db/repository.ts`. `src/lib/syncQueue.ts` records local changes, and `src/lib/cloudSync.ts` reconciles them with Firestore.

## What's implemented vs. deferred

Implemented: month grid + swipe navigation, the expand/collapse interaction (FLIP, large animated day card on phone and tablet, reduced-motion fallback), notes with debounced autosave, checklist (add/complete/reorder/swipe-to-delete-with-undo), per-task time/category/deadline, recurrence (daily/weekdays/weekly/monthly/custom, with "this occurrence" vs "all future" edits), roll-over banner, Due Soon strip + exam countdown, week view, search, `.ics` export with reminders, JSON export/import (including settings), Home Screen app badge, full settings (theme/week-start/categories/template tasks/reminder default), install guide, update-available toast.

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

Gemini can extract suggested fields from a typed or dictated note, an image/PDF schedule or syllabus, or an audio recording. Every suggestion appears in an editable review card and saves only when tapped. Audio and uploaded files are sent to Gemini on Analyze; they are not stored in the app. Keep patient details and sensitive personal notes out of AI input.

This uses **Firebase AI Logic**, so the separate Gemini API key is not placed in the client app or needed for this integration. To activate it:

1. In the Firebase console, set up Firebase AI Logic with the Gemini Developer API for this project.
2. Register the web app with App Check using reCAPTCHA Enterprise and add its site key to `.env.local` as `VITE_FIREBASE_APPCHECK_SITE_KEY`. Enable enforcement for Firebase AI Logic in the console after verifying requests. Keep the site key restricted to your deployed domain; add a development domain or debug token for local testing.
3. Restart the Vite server or redeploy after changing `.env.local`. Optionally set `VITE_GEMINI_MODEL` to a model enabled for your project. The default is `gemini-2.5-flash`.

Manual entry works without Gemini. Firestore cloud sync requires Firebase Authentication Email/Password to be enabled separately; the Firebase web config in `.env.local` alone does not activate sign-in or sync. In Settings → Cloud sync, a successful account sign-in and “Saved on this device and synced to Firebase” confirms cloud sync. Gemini suggestions do not require a signed-in account, but App Check must be configured. Avoid the Gemini Developer API free tier for sensitive content because its data-use terms differ from paid usage.
