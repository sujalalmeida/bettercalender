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
  OUTPOST_CLOCK_KEY,
  STUDY_MINUTE,
  gardenElapsed,
  gardenStage,
  legacyGardenCredit,
  newClock,
  parseGardenClock,
  type GardenClock,
  type FocusWorld,
} from "../lib/gardenState";
import { DEFAULT_OUTPOST_GOAL, MAX_OUTPOST_GOAL, OUTPOST_MILESTONES, outpostStage, shouldRaid, validOutpostGoal } from "../lib/outpostState";
import { useObservable } from "../lib/useObservable";
import { gardenViewBox } from "../lib/gardenCamera";
import { GardenLandscape } from "./GardenLandscape";
import { OutpostLandscape } from "./OutpostLandscape";
import { UpdateToast } from "./UpdateToast";
import "../styles/focus.css";
import "../styles/outpost.css";

const FOCUS_WORLD_KEY = "plan.focus-world";

function readClock(key: string): GardenClock | null {
  try {
    return parseGardenClock(localStorage.getItem(key));
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
  const [world, setWorld] = useState<FocusWorld>(() => {
    try {
      return localStorage.getItem(FOCUS_WORLD_KEY) === "outpost" ? "outpost" : "main";
    } catch {
      return "main";
    }
  });
  function selectWorld(next: FocusWorld) {
    setWorld(next);
    try { localStorage.setItem(FOCUS_WORLD_KEY, next); } catch { /* The current choice still works. */ }
  }
  return <FocusWorkspace key={world} world={world} onSelectWorld={selectWorld} />;
}

function FocusWorkspace({ world, onSelectWorld }: { world: FocusWorld; onSelectWorld: (world: FocusWorld) => void }) {
  const isOutpost = world === "outpost";
  const worldName = isOutpost ? "Twin Suns Outpost" : "Garden";
  const clockKey = isOutpost ? OUTPOST_CLOCK_KEY : GARDEN_CLOCK_KEY;
  const garden = useObservable(
    () => liveQuery(() => db.focusGardens.get(world)),
    [],
    undefined,
  );
  const sessions = useObservable(
    () => liveQuery(() => db.focusSessions.toArray()),
    [],
    [],
  );
  const [clock, setClock] = useState<GardenClock | null>(() => readClock(clockKey)),
    clockRef = useRef(clock);
  clockRef.current = clock;
  const [goal, setGoal] = useState(() => String(
    validOutpostGoal(clock?.goalMinutes) ? clock.goalMinutes : DEFAULT_OUTPOST_GOAL,
  ));
  const [raid, setRaid] = useState(false);
  useEffect(() => {
    if (!raid) return;
    const timer = window.setTimeout(() => setRaid(false), 10000);
    return () => window.clearTimeout(timer);
  }, [raid]);
  const [now, setNow] = useState(Date.now()),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [actionBusy, setActionBusy] = useState(false),
    [restartConfirm, setRestartConfirm] = useState(false);
  const [immersive, setImmersive] = useState(false),
    [hiddenControls, setHiddenControls] = useState(false);
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
  const running = clock !== null && clock.timer.startedAt !== null;
  const sessionGoal = validOutpostGoal(clock?.goalMinutes) ? clock.goalMinutes : undefined;
  const goalElapsed = clock ? focusElapsed(clock.timer, now) : 0;
  const goalReached = sessionGoal !== undefined && goalElapsed >= sessionGoal * STUDY_MINUTE;
  const stage = gardenStage(total),
    viewMs = preview ?? total,
    viewStage = gardenStage(viewMs);
  const outpost = outpostStage(total);
  const nextMilestone = isOutpost ? outpost.next : stage.next;
  const milestones = isOutpost ? OUTPOST_MILESTONES : GARDEN_MILESTONES;
  const valid = ready && !!garden && clock?.gardenId === garden.generation;
  const plannerUrl = new URL(window.location.href);
  plannerUrl.searchParams.delete("focus");
  function commit(next: GardenClock) {
    clockRef.current = next;
    setClock(next);
    setNow(Date.now());
    try {
      localStorage.setItem(clockKey, JSON.stringify(next));
    } catch {
      setNotice(
        "The timer could not be remembered by this browser. Keep this window open.",
      );
    }
  }
  async function boot() {
    setError("");
    try {
      if (!isOutpost && !(await db.focusGardens.get(world))) await waitForCloudGarden();
      const credit = (() => {
        try {
          return legacyGardenCredit(localStorage);
        } catch {
          return 0;
        }
      })();
      await ensureFocusGarden(isOutpost ? 0 : credit, world);
      setReady(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Could not load ${worldName}.`,
      );
    }
  }
  useEffect(() => {
    void boot();
    const title = document.title;
    document.title = isOutpost ? "Twin Suns Outpost · Plan" : "Focus Garden · Plan";
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
      if (previous && !isOutpost) {
        next.displayOffsetMs =
          previous.displayOffsetMs + focusElapsed(previous.timer);
        if (previous.timer.startedAt !== null)
          next.timer = startFocus(next.timer);
      }
      commit(next);
    })().catch(() =>
      setError(
        "Could not restore the stopwatch. Your saved progress is still here.",
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
            "Focus progress is waiting to save. Keep this window open and try again.",
          ),
        );
    };
    const heartbeat = window.setInterval(persist, 10000);
    const resume = () => {
      setNow(Date.now());
      persist();
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== clockKey) return;
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
    // Native fullscreen can end on a tab switch. Keep the expanded iPad layout
    // until Exit or Escape, including browsers that do not expose native fullscreen.
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImmersive(false);
        setHiddenControls(false);
        setRestartConfirm(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
    };
  }, []);
  async function toggleFocus() {
    if (!clockRef.current || !valid || actionBusy) return;
    const current = clockRef.current;
    setError("");
    if (isOutpost) {
      const time = Date.now();
      if (current.timer.startedAt !== null) {
        const early = shouldRaid(current, time);
        const stopped = { ...current, timer: pauseFocus(current.timer, time) };
        commit(stopped);
        if (early) launchRaid();
        else setNotice("Focus goal reached.");
        try {
          await saveFocusSession(stopped, time);
        } catch {
          setNotice("Session time is kept in this browser. Progress will retry saving.");
        }
      } else {
        const minutes = Number(goal);
        if (!validOutpostGoal(minutes)) return;
        setActionBusy(true);
        try {
          await saveFocusSession(current);
          setRaid(false);
          setNotice("");
          const next = newClock(current.gardenId);
          commit({ ...next, goalMinutes: minutes, timer: startFocus(next.timer) });
        } catch {
          setError("Could not save the previous session. Try starting again.");
        } finally {
          setActionBusy(false);
        }
      }
      return;
    }
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
  function launchRaid() {
    setPreview(null);
    moveCamera(0.5);
    setRaid(true);
    setNotice("");
  }
  async function resetStopwatch() {
    if (!clockRef.current || !garden || actionBusy) return;
    setActionBusy(true);
    setError("");
    try {
      const current = clockRef.current;
      const time = Date.now();
      const early = isOutpost && shouldRaid(current, time);
      const stopped = isOutpost && current.timer.startedAt !== null
        ? { ...current, timer: pauseFocus(current.timer, time) }
        : current;
      if (stopped !== current) commit(stopped);
      if (early) launchRaid();
      await saveFocusSession(stopped, time);
      const next = newClock(garden.generation);
      const minutes = Number(goal);
      commit(isOutpost && validOutpostGoal(minutes) ? { ...next, goalMinutes: minutes } : next);
      if (!early) setNotice("Stopwatch reset.");
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
  const sceneMs = Math.floor(viewMs / 5000) * 5000;
  const landscape = useMemo(
    () => isOutpost ? (
      <OutpostLandscape elapsedMs={sceneMs} seed={garden?.seed ?? 1} motion={motion} raid={raid} />
    ) : (
      <GardenLandscape
        elapsedMs={sceneMs}
        seed={garden?.seed ?? 1}
        motion={motion}
      />
    ),
    [isOutpost, sceneMs, garden?.seed, motion, raid],
  );
  return (
    <div
      class={`focus-shell ${isOutpost ? "focus-outpost" : ""} ${preview !== null ? "focus-is-preview" : ""} ${immersive ? "focus-immersive" : ""} ${hiddenControls ? "focus-controls-hidden" : ""}`}
      ref={root}
    >
      <header class="focus-header">
        <a class="focus-return" href={plannerUrl.toString()}>
          ← Plan
        </a>
        <div class="focus-world-picker" role="group" aria-label="Focus world">
          <button type="button" aria-pressed={!isOutpost} disabled={running || actionBusy} onClick={() => onSelectWorld("main")}>Garden</button>
          <button type="button" aria-pressed={isOutpost} disabled={running || actionBusy} onClick={() => onSelectWorld("outpost")}>Twin Suns Outpost</button>
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
          <h1>{worldName}</h1>
          <div class="focus-season">
            <span>{isOutpost ? "Outer Rim" : viewStage.season}</span>
            <i />
            {viewStage.phase}
          </div>
        </div>
        <section
          class="focus-garden-panel"
          aria-label={isOutpost ? "Persistent Twin Suns Outpost" : "Persistent study garden"}
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
                  {isOutpost ? "Return to outpost" : "Return to garden"}
                </button>
              </div>
            )}
            <div class="focus-camera-controls">
              <button
                disabled={fitGarden}
                aria-label={isOutpost ? "View left side of outpost" : "View left side of garden"}
                onClick={() => moveCamera(camera.current - 0.3)}
              >
                ←
              </button>
              <button
                class="focus-fit"
                onClick={toggleFitGarden}
                aria-pressed={fitGarden}
              >
                {fitGarden ? "Fill view" : isOutpost ? "Fit outpost" : "Fit garden"}
              </button>
              <button
                disabled={fitGarden}
                aria-label={isOutpost ? "View right side of outpost" : "View right side of garden"}
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
              {running ? "Running" : displayed ? isOutpost ? "Session ended" : "Paused" : "Ready"}
            </span>
          </div>
          <div class="focus-clock-actions">
            <button
              class="focus-main-action"
              disabled={!valid || actionBusy || (isOutpost && !running && !validOutpostGoal(Number(goal)))}
              onClick={() => {
                void toggleFocus();
              }}
            >
              {running
                ? isOutpost ? "End session" : "Pause focus"
                : displayed
                  ? isOutpost ? "Start new session" : "Continue focusing"
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
              <span>{isOutpost ? "Outpost time" : "Garden time"}</span>
            </div>
            <div>
              <strong>{isOutpost ? outpost.completed : stage.flowers.toLocaleString()}</strong>
              <span>{isOutpost ? "Milestones" : "Flowers"}</span>
            </div>
          </div>
          {isOutpost && <div class="focus-goal">
            <label>
              Goal time
              <input type="number" min="1" max={MAX_OUTPOST_GOAL} step="1" inputMode="numeric" value={running ? sessionGoal ?? goal : goal} disabled={running || actionBusy} onInput={event => setGoal(event.currentTarget.value)} />
              <span>min</span>
            </label>
            <div class="focus-goal-status">
              {running && sessionGoal !== undefined ? <>
                <progress aria-label="Focus goal progress" max={sessionGoal * STUDY_MINUTE} value={Math.min(goalElapsed, sessionGoal * STUDY_MINUTE)} />
                <span>{goalReached ? "Goal reached" : `${formatFocusTime(sessionGoal * STUDY_MINUTE - goalElapsed)} to goal`}</span>
              </> : <span>Ending a session early triggers a Sith raid.</span>}
            </div>
          </div>}
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
        {(notice || raid) && (
          <p class="focus-notice" role="status">
            {notice || "Sith raid. The outpost will recover."}
          </p>
        )}
        <footer class="focus-garden-footer">
          <div class="focus-next">
            <span class="focus-eyebrow">{nextMilestone ? "Next" : worldName}</span>
            <span>
              {nextMilestone
                ? `${nextMilestone.label} · ${Math.ceil(nextMilestone.minutes - stage.minutes)} min to go`
                : isOutpost ? "The spaceport is fully built" : "Planting continues"}
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
                        ? isOutpost ? "Night outpost" : "Night garden"
                        : minute === 0
                          ? "New"
                          : minute < 60
                            ? `${minute} min`
                            : `${minute / 60} hours`}
                    </button>
                  ))}
                </div>
                <ul>
                  {milestones.map((m) => (
                    <li key={m.minutes} class={stage.minutes >= m.minutes ? "is-earned" : ""}>
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
            {!isOutpost && <button
              onClick={() => setRestartConfirm(true)}
              disabled={!valid || actionBusy}
            >
              Restart the Garden
            </button>}
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
