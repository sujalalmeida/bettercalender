# Pencil and persistent garden update

## Drawing

- Retain existing vector documents and backups. Optional tool/paper metadata stays compatible with existing pages.
- Separate saved ink, the current stroke, and predicted/selection feedback into canvas layers. No Preact state updates, historical page repaint, or layout reads per sample while writing.
- Smooth pressure-aware strokes, real coalesced samples, temporary predicted points when supported, Pencil tilt shading, pencil/highlighter/pen, two erasers, lasso movement/copy/resize/delete, ruler/shape tools, paper styles, zoom/pan, full-screen workspace, undo/redo and export.
- Commit only real input. Finish active ink before saving/closing/backgrounding; handle capture loss and page changes. Pencil input takes priority over touch; two fingers pan/zoom. Keep manual typed notes and Gemini transcription.
- Web Pointer Events cannot supply every native Apple Notes/PencilKit function. Physical Pencil testing remains a separate acceptance step.

## Garden

- Persist the garden separately from the stopwatch, with a generation ID and session contributions. Restarting a stopwatch never clears growth. Only Restart the Garden starts a new landscape.
- Recover the old timer's recorded credit once. New running timers use wall-clock time across background/reload; saves are idempotent and concurrent browser windows share one timer.
- Continue growth for many study days: plants, larger flower beds, trees, a stream after 45 minutes, bridges, villagers, cottage construction, crops, campfire and window lights. No fishing.
- A large, full-screen landscape with controlled motion, seasonal palettes, gradual day/night, reduced motion, and a bounded number of detailed scene objects. Beyond the detailed-object budget, denser beds/vegetation and successive growth cycles continue changing the garden.
- Save locally first and through existing authenticated Firebase sync. Keep signed-in sessions and the Git-ignored optional personal feature.

## Verification and delivery

Meaningful tests for geometry, stroke editing, legacy backups, prediction exclusion, save boundaries, persistence/migration, timer reset vs garden reset, background elapsed time and cloud sync. Browser-check iPad/phone/desktop layouts, exports, full screen and state recovery. Build/test both personal and public-only checkouts. Inspect staged files for ignored sources or secrets. Push coherent commits with lowercase messages of three to six words, using real timestamps.
