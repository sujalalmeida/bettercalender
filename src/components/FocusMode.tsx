import { liveQuery } from "dexie";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { db } from "../db/db";
import {
  ensureFocusGarden,
  restartFocusGarden,
  saveFocusSession,
} from "../db/focusRepository";
import {
  focusElapsed,
  formatFocusTime,
  pauseFocus,
  startFocus,
} from "../lib/focusTimer";
import {
  GARDEN_CLOCK_KEY,
  GARDEN_MILESTONES,
  gardenElapsed,
  gardenStage,
  legacyGardenCredit,
  newClock,
  parseGardenClock,
  type GardenClock,
} from "../lib/gardenState";
import { useObservable } from "../lib/useObservable";
import { gardenViewBox } from "../lib/gardenCamera";
import { GardenLandscape } from "./GardenLandscape";
import { UpdateToast } from "./UpdateToast";
import "../styles/focus.css";

function readClock(): GardenClock | null {
  try {
    return parseGardenClock(localStorage.getItem(GARDEN_CLOCK_KEY));
  } catch {
    return null;
  }
}
async function waitForCloudGarden(): Promise<void> {
  const cloud = await import("../lib/cloudSync");
  cloud.startCloudSync();
  if (!cloud.getCloudState().configured) return;
  if (!navigator.onLine)
    throw new Error("Connect once to load your saved garden on this device.");
  await new Promise<void>((resolve, reject) => {
    let unsubscribe = () => {},
      settled = false;
    const timer = setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          "Your garden is taking longer to sync. Try again in a moment.",
        ),
      );
    }, 22000);
    const done = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      if (error) reject(error);
      else resolve();
    };
    unsubscribe = cloud.subscribeCloudState((state) => {
      if (
        state.status === "Synced" ||
        (!state.email && state.status.startsWith("Saved on this device"))
      )
        done();
      else if (
        state.status.includes("denied") ||
        state.status.includes("Could not connect") ||
        state.status.includes("Retrying")
      )
        done(
          new Error(
            "Could not load the cloud garden. Check sync in the planner, then try again.",
          ),
        );
    });
    if (settled) unsubscribe();
  });
}
export function FocusMode() {
  const garden = useObservable(
    () => liveQuery(() => db.focusGardens.get("main")),
    [],
    undefined,
  );
  const sessions = useObservable(
    () => liveQuery(() => db.focusSessions.toArray()),
    [],
    [],
  );
  const [clock, setClock] = useState<GardenClock | null>(readClock),
    clockRef = useRef(clock);
  clockRef.current = clock;
  const [now, setNow] = useState(Date.now()),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [actionBusy, setActionBusy] = useState(false),
    [restartConfirm, setRestartConfirm] = useState(false);
  const [immersive, setImmersive] = useState(false),
    [hiddenControls, setHiddenControls] = useState(false);
  const nativeFullscreen = useRef(false);
  const [motion, setMotion] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [preview, setPreview] = useState<number | null>(null);
  const [fitGarden, setFitGarden] = useState(false),
    fitRef = useRef(false);
  fitRef.current = fitGarden;
  const root = useRef<HTMLDivElement>(null),
    scene = useRef<HTMLDivElement>(null),
    camera = useRef(0.5),
    cameraSize = useRef({ width: 1600, height: 1000 }),
    cameraDrag = useRef<{ id: number; x: number; position: number } | null>(
      null,
    );
  function moveCamera(position: number) {
    camera.current = Math.max(0, Math.min(1, position));
    const { width, height } = cameraSize.current;
    const svg = scene.current?.querySelector("svg");
    svg?.setAttribute(
      "viewBox",
      (fitRef.current
        ? [0, 0, 1600, 1000]
        : gardenViewBox(width, height, camera.current)
      ).join(" "),
    );
    svg?.setAttribute(
      "preserveAspectRatio",
      fitRef.current ? "xMidYMid meet" : "xMidYMid slice",
    );
  }
  useEffect(() => {
    if (!scene.current) return;
    const observer = new ResizeObserver(() => {
      cameraSize.current = {
        width: scene.current!.clientWidth,
        height: scene.current!.clientHeight,
      };
      moveCamera(camera.current);
    });
    observer.observe(scene.current);
    return () => observer.disconnect();
  }, []);
  function cameraDown(event: PointerEvent) {
    if (fitRef.current) return;
    if (
      (event.target as Element).closest("button") ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    cameraDrag.current = {
      id: event.pointerId,
      x: event.clientX,
      position: camera.current,
    };
    scene.current?.setPointerCapture(event.pointerId);
  }
  function cameraMove(event: PointerEvent) {
    if (fitRef.current) return;
    const drag = cameraDrag.current;
    if (!drag || drag.id !== event.pointerId) return;
    const { width, height } = cameraSize.current,
      view = gardenViewBox(width, height, camera.current);
    if (view[2] >= 1600) return;
    const delta = event.clientX - drag.x;
    if (Math.abs(delta) > 5) {
      event.preventDefault();
      moveCamera(
        drag.position - ((delta / width) * view[2]) / (1600 - view[2]),
      );
    }
  }
  function cameraUp(event: PointerEvent) {
    cameraDrag.current = null;
    if (scene.current?.hasPointerCapture(event.pointerId))
      scene.current.releasePointerCapture(event.pointerId);
  }
  const total = garden ? gardenElapsed(garden, sessions, clock, now) : 0;
  const displayed = clock
    ? clock.displayOffsetMs + focusElapsed(clock.timer, now)
    : 0;
  const running = clock?.timer.startedAt !== null && clock !== null;
  const stage = gardenStage(total),
    viewMs = preview ?? total,
    viewStage = gardenStage(viewMs);
  const valid = ready && !!garden && clock?.gardenId === garden.generation;
  const plannerUrl = new URL(window.location.href);
  plannerUrl.searchParams.delete("focus");
  function commit(next: GardenClock) {
    clockRef.current = next;
    setClock(next);
    setNow(Date.now());
    try {
      localStorage.setItem(GARDEN_CLOCK_KEY, JSON.stringify(next));
    } catch {
      setNotice(
        "The timer could not be remembered by this browser. Keep this window open.",
      );
    }
  }
  async function boot() {
    setError("");
    try {
      if (!(await db.focusGardens.get("main"))) await waitForCloudGarden();
      const credit = (() => {
        try {
          return legacyGardenCredit(localStorage);
        } catch {
          return 0;
        }
      })();
      await ensureFocusGarden(credit);
      setReady(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load the garden.",
      );
    }
  }
  useEffect(() => {
    void boot();
    const title = document.title;
    document.title = "Focus Garden · Plan";
    return () => {
      document.title = title;
    };
  }, []);
  useEffect(() => {
    if (!ready || !garden || clockRef.current?.gardenId === garden.generation)
      return;
    let cancelled = false;
    const previous = clockRef.current;
    void (async () => {
      if (previous) await saveFocusSession(previous);
      if (cancelled) return;
      const next = newClock(garden.generation);
      if (previous) {
        next.displayOffsetMs =
          previous.displayOffsetMs + focusElapsed(previous.timer);
        if (previous.timer.startedAt !== null)
          next.timer = startFocus(next.timer);
      }
      commit(next);
    })().catch(() =>
      setError(
        "Could not restore the stopwatch. Your saved garden is still here.",
      ),
    );
    return () => {
      cancelled = true;
    };
  }, [ready, garden?.generation]);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const persist = () => {
      const current = clockRef.current;
      if (current)
        void saveFocusSession(current).catch(() =>
          setNotice(
            "Garden progress is waiting to save. Keep this window open and try again.",
          ),
        );
    };
    const heartbeat = window.setInterval(persist, 10000);
    const resume = () => {
      setNow(Date.now());
      persist();
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== GARDEN_CLOCK_KEY) return;
      const next = parseGardenClock(event.newValue);
      if (next) {
        clockRef.current = next;
        setClock(next);
        setNow(Date.now());
      }
    };
    window.addEventListener("storage", storage);
    window.addEventListener("pagehide", persist);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(tick);
      clearInterval(heartbeat);
      persist();
      window.removeEventListener("storage", storage);
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  useEffect(() => {
    const full = () => {
      if (document.fullscreenElement === root.current)
        nativeFullscreen.current = true;
      else if (nativeFullscreen.current) {
        nativeFullscreen.current = false;
        setImmersive(false);
        setHiddenControls(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImmersive(false);
        setHiddenControls(false);
        setPreview(null);
        setRestartConfirm(false);
      }
    };
    document.addEventListener("fullscreenchange", full);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", full);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  async function toggleFocus() {
    if (!clockRef.current || !valid) return;
    const current = clockRef.current;
    const next = {
      ...current,
      timer:
        current.timer.startedAt !== null
          ? pauseFocus(current.timer)
          : startFocus(current.timer),
    };
    commit(next);
    try {
      await saveFocusSession(next);
      setNotice("");
    } catch {
      setNotice(
        "Session time is kept in this browser. Garden save will retry.",
      );
    }
  }
  async function resetStopwatch() {
    if (!clockRef.current || !garden) return;
    setActionBusy(true);
    try {
      await saveFocusSession(clockRef.current);
      commit(newClock(garden.generation));
      setNotice("Stopwatch reset.");
    } catch {
      setError(
        "Could not save this session. Try again before resetting the stopwatch.",
      );
    } finally {
      setActionBusy(false);
    }
  }
  async function restartGarden() {
    if (!clockRef.current || !garden) return;
    setActionBusy(true);
    try {
      const old = clockRef.current;
      await saveFocusSession(old);
      const nextGarden = await restartFocusGarden(garden);
      const next = newClock(nextGarden.generation);
      next.displayOffsetMs = old.displayOffsetMs + focusElapsed(old.timer);
      if (old.timer.startedAt !== null) next.timer = startFocus(next.timer);
      commit(next);
      setRestartConfirm(false);
      setPreview(null);
      setNotice("Garden restarted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not restart the garden.",
      );
    } finally {
      setActionBusy(false);
    }
  }
  function toggleFitGarden() {
    fitRef.current = !fitRef.current;
    setFitGarden(fitRef.current);
    moveCamera(camera.current);
  }
  async function toggleFullscreen() {
    if (immersive) {
      setImmersive(false);
      setHiddenControls(false);
      if (document.fullscreenElement)
        await document.exitFullscreen().catch(() => undefined);
    } else {
      setImmersive(true);
      try {
        await root.current?.requestFullscreen?.();
      } catch {
        /* The expanded page also works in iPad browsers without Fullscreen API support. */
      }
    }
  }
  const landscape = useMemo(
    () => (
      <GardenLandscape
        elapsedMs={Math.floor(viewMs / 5000) * 5000}
        seed={garden?.seed ?? 1}
        motion={motion}
      />
    ),
    [Math.floor(viewMs / 5000), garden?.seed, motion],
  );
  return (
    <div
      class={`focus-shell ${preview !== null ? "focus-is-preview" : ""} ${immersive ? "focus-immersive" : ""} ${hiddenControls ? "focus-controls-hidden" : ""}`}
      ref={root}
    >
      <header class="focus-header">
        <a class="focus-return" href={plannerUrl.toString()}>
          ← Plan
        </a>
        <div class="focus-brand">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 21V9M12 15C1 16 2 3 11 10M12 12C23 13 23 0 13 7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
          Focus garden
        </div>
        <button
          class="focus-text-action"
          onClick={() => {
            void toggleFullscreen();
          }}
        >
          {immersive ? "Exit full screen" : "Full screen"} ↗
        </button>
      </header>
      <main class="focus-layout">
        <div class="focus-landscape-heading">
          <h1>Garden</h1>
          <div class="focus-season">
            <span>{viewStage.season}</span>
            <i />
            {viewStage.phase}
          </div>
        </div>
        <section
          class="focus-garden-panel"
          aria-label="Persistent study garden"
        >
          <div
            class="focus-garden-scene"
            ref={scene}
            onPointerDown={cameraDown}
            onPointerMove={cameraMove}
            onPointerUp={cameraUp}
            onPointerCancel={cameraUp}
          >
            {landscape}
            {preview !== null && (
              <div class="focus-scene-badges">
                <span>Preview</span>
                <button onClick={() => setPreview(null)}>
                  Return to garden
                </button>
              </div>
            )}
            <div class="focus-camera-controls">
              <button
                disabled={fitGarden}
                aria-label="View left side of garden"
                onClick={() => moveCamera(camera.current - 0.3)}
              >
                ←
              </button>
              <button
                class="focus-fit"
                onClick={toggleFitGarden}
                aria-pressed={fitGarden}
              >
                {fitGarden ? "Fill view" : "Fit garden"}
              </button>
              <button
                disabled={fitGarden}
                aria-label="View right side of garden"
                onClick={() => moveCamera(camera.current + 0.3)}
              >
                →
              </button>
            </div>
            <div class="focus-scene-controls">
              <button
                class="focus-show-controls"
                hidden={!immersive}
                onClick={() => setHiddenControls(!hiddenControls)}
                aria-label={
                  hiddenControls
                    ? "Show garden controls"
                    : "Hide garden controls"
                }
              >
                {hiddenControls ? "Show controls" : "Hide controls"}
              </button>
              <button
                class="focus-exit"
                aria-label={
                  immersive ? "Exit full screen" : "Enter full screen"
                }
                onClick={() => {
                  void toggleFullscreen();
                }}
              >
                {immersive ? "Exit ↙" : "Full screen ↗"}
              </button>
            </div>
          </div>
        </section>
        <section class="focus-control-panel" aria-label="Focus stopwatch">
          <div class="focus-time-group">
            <span class="focus-eyebrow">THIS SESSION</span>
            <div
              class="focus-clock"
              role="timer"
              aria-label={`Focused for ${formatFocusTime(displayed)}`}
            >
              {formatFocusTime(displayed)}
            </div>
            <span class="focus-timer-state">
              {running ? "Running" : displayed ? "Paused" : "Ready"}
            </span>
          </div>
          <div class="focus-clock-actions">
            <button
              class="focus-main-action"
              disabled={!valid || actionBusy}
              onClick={() => {
                void toggleFocus();
              }}
            >
              {running
                ? "Pause focus"
                : displayed
                  ? "Continue focusing"
                  : "Start focusing"}{" "}
              <span aria-hidden="true">{running ? "Ⅱ" : "→"}</span>
            </button>
            <button
              class="focus-reset"
              disabled={!valid || !displayed || actionBusy}
              onClick={() => {
                void resetStopwatch();
              }}
            >
              Reset stopwatch
            </button>
          </div>
          <div class="focus-garden-stats">
            <div>
              <strong>
                {Math.floor(total / 3600000)}
                <small>h</small> {Math.floor(total / 60000) % 60}
                <small>m</small>
              </strong>
              <span>Garden time</span>
            </div>
            <div>
              <strong>{stage.flowers.toLocaleString()}</strong>
              <span>Flowers</span>
            </div>
          </div>
        </section>
        {error && (
          <div class="focus-notice has-error" role="alert">
            {error}
            {!ready && (
              <button
                onClick={() => {
                  void boot();
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
        {notice && (
          <p class="focus-notice" role="status">
            {notice}
          </p>
        )}
        <footer class="focus-garden-footer">
          <div class="focus-next">
            <span class="focus-eyebrow">{stage.next ? "Next" : "Garden"}</span>
            <span>
              {stage.next
                ? `${stage.next.label} · ${Math.ceil(stage.next.minutes - stage.minutes)} min to go`
                : "Planting continues"}
            </span>
          </div>
          <div class="focus-footer-actions">
            <button aria-pressed={!motion} onClick={() => setMotion(!motion)}>
              {motion ? "Still scene" : "Motion on"}
            </button>
            <details class="focus-roadmap">
              <summary>Explore growth</summary>
              <div>
                <p>Preview · does not change saved progress.</p>
                <label class="focus-preview-time">
                  Study time
                  <input
                    aria-label="Preview study time"
                    type="range"
                    min="0"
                    max="8640"
                    step="1"
                    value={(preview ?? total) / 60000}
                    onInput={(e) =>
                      setPreview(Number(e.currentTarget.value) * 60000)
                    }
                  />
                  <output>
                    {Math.floor((preview ?? total) / 3600000)}h{" "}
                    {Math.floor((preview ?? total) / 60000) % 60}m
                  </output>
                </label>
                <div>
                  {[
                    0, 45, 120, 360, 660, 720, 1440, 2880, 3600, 5760, 8640,
                  ].map((minute) => (
                    <button
                      aria-pressed={preview === minute * 60000}
                      onClick={() => setPreview(minute * 60000)}
                    >
                      {minute === 660
                        ? "Night garden"
                        : minute === 0
                          ? "New"
                          : minute < 60
                            ? `${minute} min`
                            : `${minute / 60} hours`}
                    </button>
                  ))}
                </div>
                <ul>
                  {GARDEN_MILESTONES.map((m) => (
                    <li class={stage.minutes >= m.minutes ? "is-earned" : ""}>
                      <span>
                        {m.minutes < 60
                          ? `${m.minutes}m`
                          : `${m.minutes / 60}h`}
                      </span>
                      {m.label}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
            <button
              onClick={() => setRestartConfirm(true)}
              disabled={!valid || actionBusy}
            >
              Restart the Garden
            </button>
          </div>
        </footer>
        {restartConfirm && (
          <section
            class="focus-restart-confirm"
            role="region"
            aria-label="Restart garden confirmation"
          >
            <h2>Start a new garden?</h2>
            <p>
              This removes the current landscape. Your stopwatch and saved study
              sessions stay.
            </p>
            <div>
              <button onClick={() => setRestartConfirm(false)}>
                Keep my garden
              </button>
              <button
                class="focus-main-action"
                disabled={actionBusy}
                onClick={() => {
                  void restartGarden();
                }}
              >
                Restart the Garden
              </button>
            </div>
          </section>
        )}
      </main>
      <UpdateToast />
    </div>
  );
}
