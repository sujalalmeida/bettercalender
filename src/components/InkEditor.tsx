import { useEffect, useRef, useState } from "preact/hooks";
import { liveQuery } from "dexie";
import type { InkDocument, InkPoint, InkStroke } from "../db/types";
import { getInk, saveInk } from "../db/repository";
import {
  addInkPage,
  appendStroke,
  blankInkDocument,
  clearInkPage,
  eraseAt,
  eraseInkAt,
  hitStroke,
  lassoStrokes,
  removeInkPage,
  replacePage,
  selectionBounds,
  shapePoints,
  transformStrokes,
  INK_HEIGHT,
  INK_WIDTH,
} from "../lib/ink";
import { InkRenderer } from "../lib/inkRenderer";
import { exportInkImage, printInkDocument } from "../lib/inkExport";
import { createId } from "../lib/id";
import { registerInkFlusher } from "../lib/inkSaveCoordinator";
import "../styles/ink.css";

interface Props {
  dateISO: string;
}
type Tool = "pen" | "pencil" | "highlighter" | "eraser" | "lasso" | "shape";
const COLORS = [
  { value: "#182331", name: "Black" },
  { value: "#1766b5", name: "Blue" },
  { value: "#27815b", name: "Green" },
  { value: "#b44844", name: "Red" },
  { value: "#935fa3", name: "Purple" },
  { value: "#e9bc45", name: "Gold" },
];
const MAX_HISTORY = 60;
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function InkEditor({ dateISO }: Props) {
  const [document, setDocument] = useState<InkDocument | null>(null);
  const docRef = useRef<InkDocument | null>(null);
  const [pageIndex, setPageIndex] = useState(0),
    pageRef = useRef(0);
  const [tool, setTool] = useState<Tool>("pen"),
    toolRef = useRef<Tool>("pen");
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(4);
  const [fingerDraw, setFingerDraw] = useState(false);
  const [eraserMode, setEraserMode] = useState<"partial" | "stroke">("partial");
  const [shape, setShape] = useState<"line" | "rectangle" | "ellipse">("line");
  const [ruler, setRuler] = useState(false),
    [rulerAngle, setRulerAngle] = useState(0);
  const [zoom, setZoom] = useState(1),
    zoomRef = useRef(1);
  const [paperWidth, setPaperWidth] = useState(860);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState("Loading…"),
    [saveError, setSaveError] = useState(false);
  const [selected, setSelected] = useState<string[]>([]),
    selectedRef = useRef<string[]>([]);
  const clipboard = useRef<InkStroke[]>([]),
    [hasClipboard, setHasClipboard] = useState(false);
  const undoRef = useRef<InkDocument[]>([]),
    redoRef = useRef<InkDocument[]>([]);
  const rootRef = useRef<HTMLDivElement>(null),
    scrollRef = useRef<HTMLDivElement>(null),
    paperRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null),
    activeCanvasRef = useRef<HTMLCanvasElement>(null),
    feedbackRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<InkRenderer | null>(null);
  const mounted = useRef(true),
    dirty = useRef(false),
    renderFrame = useRef<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    writeQueue = useRef<Promise<void>>(Promise.resolve());
  const active = useRef<InkStroke | null>(null),
    predicted = useRef<InkStroke | null>(null);
  const pointerType = useRef(""),
    pointer = useRef<number | null>(null),
    penUntil = useRef(0),
    rectRef = useRef<DOMRect | null>(null);
  const before = useRef<InkDocument | null>(null),
    start = useRef<InkPoint | null>(null),
    lastPoint = useRef<InkPoint | null>(null);
  const lasso = useRef<InkPoint[]>([]),
    moving = useRef<{ x: number; y: number } | null>(null),
    baseDirty = useRef(false);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    outer: number;
  } | null>(null);
  const pinch = useRef<{
    distance: number;
    zoom: number;
    x: number;
    y: number;
  } | null>(null);

  function select(ids: string[]) {
    selectedRef.current = ids;
    setSelected(ids);
    schedulePaint();
  }
  function page() {
    return docRef.current!.pages[pageRef.current];
  }
  function currentSelection() {
    return docRef.current && selectedRef.current.length
      ? page().strokes.filter((s) => selectedRef.current.includes(s.id))
      : [];
  }
  function paint() {
    const view = renderer.current,
      doc = docRef.current;
    if (!view || !doc) return;
    if (baseDirty.current) {
      view.page(doc.pages[pageRef.current]);
      baseDirty.current = false;
    }
    view.stroke(active.current);
    const strokes = currentSelection();
    const moved = moving.current
      ? transformStrokes(strokes, moving.current.x, moving.current.y)
      : [];
    view.overlay(
      predicted.current,
      lasso.current,
      selectionBounds(moved.length ? moved : strokes),
      moved,
      ruler && start.current
        ? { start: start.current, angle: rulerAngle }
        : undefined,
    );
  }
  function schedulePaint() {
    if (renderFrame.current === null)
      renderFrame.current = requestAnimationFrame(() => {
        renderFrame.current = null;
        paint();
      });
  }
  function sizeCanvas() {
    const box = paperRef.current?.getBoundingClientRect();
    if (
      !box?.width ||
      !box.height ||
      !baseRef.current ||
      !activeCanvasRef.current ||
      !feedbackRef.current
    )
      return;
    if (!renderer.current)
      renderer.current = new InkRenderer(
        baseRef.current,
        activeCanvasRef.current,
        feedbackRef.current,
      );
    if (renderer.current.resize(box.width, box.height, window.devicePixelRatio))
      baseDirty.current = true;
    rectRef.current = box;
    schedulePaint();
  }
  function saveSoon() {
    dirty.current = true;
    if (mounted.current) {
      setStatus("Saving…");
      setSaveError(false);
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 350);
  }
  function update(next: InkDocument, previous = docRef.current) {
    if (!previous || next === previous) return;
    undoRef.current = [...undoRef.current.slice(-MAX_HISTORY + 1), previous];
    redoRef.current = [];
    docRef.current = next;
    if (mounted.current) setDocument(next);
    baseDirty.current = true;
    saveSoon();
    schedulePaint();
  }
  function finish() {
    if (pointer.current === null) return;
    const current = docRef.current;
    if (current && active.current)
      update(appendStroke(current, pageRef.current, active.current));
    else if (current && before.current && current !== before.current)
      update(current, before.current);
    else if (current && moving.current) {
      const transformed = transformStrokes(
        currentSelection(),
        moving.current.x,
        moving.current.y,
      );
      if (transformed.length && (moving.current.x || moving.current.y))
        update(
          replacePage(current, pageRef.current, {
            ...page(),
            strokes: page().strokes.map(
              (s) => transformed.find((t) => t.id === s.id) ?? s,
            ),
          }),
        );
    } else if (current && lasso.current.length) {
      const first = lasso.current[0],
        last = lasso.current[lasso.current.length - 1];
      select(
        lasso.current.length < 4 &&
          Math.hypot(first.x - last.x, first.y - last.y) < 8
          ? hitStroke(page(), first)
          : lassoStrokes(page(), lasso.current),
      );
    }
    if (moving.current) baseDirty.current = true;
    pointer.current = null;
    active.current = null;
    predicted.current = null;
    before.current = null;
    lasso.current = [];
    moving.current = null;
    start.current = null;
    lastPoint.current = null;
    schedulePaint();
  }
  function flush(): Promise<void> {
    finish();
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const snapshot = docRef.current;
    if (!snapshot || !dirty.current) return writeQueue.current;
    writeQueue.current = writeQueue.current
      .catch(() => undefined)
      .then(() => saveInk(snapshot))
      .then(() => {
        if (docRef.current === snapshot) {
          dirty.current = false;
          if (mounted.current) {
            setStatus("Saved");
            setSaveError(false);
          }
        }
      })
      .catch((error) => {
        if (mounted.current) {
          setStatus("Not saved · retry");
          setSaveError(true);
        }
        throw error;
      });
    return writeQueue.current;
  }
  useEffect(() => {
    mounted.current = true;
    const subscription = liveQuery(() => getInk(dateISO)).subscribe({
      next: (saved) => {
        if (dirty.current || pointer.current !== null) return;
        const next = saved?.pages.length
          ? saved
          : (docRef.current ?? blankInkDocument(dateISO));
        if (
          !docRef.current ||
          JSON.stringify(docRef.current.pages) !== JSON.stringify(next.pages)
        ) {
          docRef.current = next;
          setDocument(next);
          undoRef.current = [];
          redoRef.current = [];
          const index = Math.min(pageRef.current, next.pages.length - 1);
          pageRef.current = index;
          setPageIndex(index);
          select([]);
          baseDirty.current = true;
          schedulePaint();
        }
        setStatus("Saved");
      },
      error: () => {
        setSaveError(true);
        setStatus("Could not load · reopen this day");
      },
    });
    return () => {
      void flush().catch(() => undefined);
      mounted.current = false;
      subscription.unsubscribe();
      if (renderFrame.current !== null)
        cancelAnimationFrame(renderFrame.current);
      window.document.body.classList.remove("ink-is-expanded");
    };
  }, [dateISO]);
  useEffect(() => registerInkFlusher(dateISO, flush), [dateISO]);
  useEffect(() => {
    if (!document || !paperRef.current || !scrollRef.current) return;
    const observer = new ResizeObserver(() => {
      const width = Math.min(
        1000,
        Math.max(240, scrollRef.current!.clientWidth - 24),
      );
      setPaperWidth(width);
      sizeCanvas();
    });
    observer.observe(paperRef.current);
    observer.observe(scrollRef.current);
    sizeCanvas();
    return () => observer.disconnect();
  }, [!!document]);
  useEffect(() => {
    baseDirty.current = true;
    sizeCanvas();
  }, [paperWidth, zoom, pageIndex, expanded]);
  useEffect(() => {
    const hide = () => {
      if (window.document.hidden) void flush().catch(() => undefined);
    };
    const leave = () => {
      void flush().catch(() => undefined);
    };
    window.document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    window.addEventListener("blur", leave);
    return () => {
      window.document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("blur", leave);
    };
  }, []);
  function chooseTool(next: Tool) {
    finish();
    toolRef.current = next;
    setTool(next);
    if (next !== "lasso") select([]);
    schedulePaint();
  }
  function changePage(index: number) {
    finish();
    pageRef.current = index;
    setPageIndex(index);
    select([]);
    scrollRef.current?.scrollTo(0, 0);
    baseDirty.current = true;
    schedulePaint();
  }
  function history(redo = false) {
    finish();
    const source = redo ? redoRef : undoRef,
      destination = redo ? undoRef : redoRef,
      next = source.current.pop(),
      current = docRef.current;
    if (!next || !current) return;
    destination.current.push(current);
    docRef.current = next;
    setDocument(next);
    changePage(Math.min(pageRef.current, next.pages.length - 1));
    saveSoon();
  }
  function point(event: PointerEvent): InkPoint {
    const box = rectRef.current!;
    return {
      x: clamp(
        ((event.clientX - box.left) / box.width) * INK_WIDTH,
        0,
        INK_WIDTH,
      ),
      y: clamp(
        ((event.clientY - box.top) / box.height) * INK_HEIGHT,
        0,
        INK_HEIGHT,
      ),
      pressure:
        event.pointerType === "pen"
          ? clamp(
              event.pressure > 0
                ? event.pressure
                : (lastPoint.current?.pressure ?? 0.5),
              0.05,
              1,
            )
          : 0.65,
      tilt:
        event.pointerType === "pen"
          ? Math.min(1, Math.hypot(event.tiltX || 0, event.tiltY || 0) / 90)
          : 0,
    };
  }
  function updateZoom(next: number) {
    zoomRef.current = clamp(next, 0.75, 3);
    setZoom(zoomRef.current);
  }
  function cancelTouchInput() {
    // Navigation and Pencil take priority over an uncommitted finger edit.
    if (before.current) docRef.current = before.current;
    pointer.current = null;
    active.current = null;
    predicted.current = null;
    before.current = null;
    start.current = null;
    lastPoint.current = null;
    lasso.current = [];
    moving.current = null;
    baseDirty.current = true;
    schedulePaint();
  }
  function beginTouch(event: PointerEvent) {
    const scroller = scrollRef.current!;
    touches.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    baseRef.current?.setPointerCapture(event.pointerId);
    if (touches.current.size >= 2) {
      // A second finger turns a possible finger stroke into a navigation gesture.
      if (pointer.current !== null && pointerType.current !== "pen")
        cancelTouchInput();
      const [a, b] = [...touches.current.values()],
        box = scroller.getBoundingClientRect(),
        cx = (a.x + b.x) / 2 - box.left,
        cy = (a.y + b.y) / 2 - box.top;
      pinch.current = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: zoomRef.current,
        x: (scroller.scrollLeft + cx) / zoomRef.current,
        y: (scroller.scrollTop + cy) / zoomRef.current,
      };
      pan.current = null;
      return true;
    }
    if (!fingerDraw) {
      pan.current = {
        x: event.clientX,
        y: event.clientY,
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
        outer: scroller.closest(".day-panel-body")?.scrollTop ?? 0,
      };
      return true;
    }
    return false;
  }
  function down(event: PointerEvent) {
    if (
      !docRef.current ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    if (
      event.pointerType === "touch" &&
      ((pointer.current !== null &&
        pointerType.current === "pen" &&
        event.pointerId !== pointer.current) ||
        performance.now() < penUntil.current)
    )
      return;
    event.preventDefault();
    if (event.pointerType === "pen") {
      penUntil.current = performance.now() + 350;
      if (pointer.current !== null && pointerType.current !== "pen")
        cancelTouchInput();
      touches.current.clear();
      pan.current = null;
      pinch.current = null;
    } else if (event.pointerType === "touch" && beginTouch(event)) return;
    if (pointer.current !== null) return;
    rectRef.current = paperRef.current!.getBoundingClientRect();
    baseRef.current?.focus({ preventScroll: true });
    baseRef.current?.setPointerCapture(event.pointerId);
    pointer.current = event.pointerId;
    pointerType.current = event.pointerType;
    const p = point(event);
    start.current = p;
    lastPoint.current = p;
    const mode = toolRef.current;
    if (mode === "eraser") {
      before.current = docRef.current;
      erase(p);
    } else if (mode === "lasso") {
      const b = selectionBounds(currentSelection());
      if (
        b &&
        p.x >= b.x - 10 &&
        p.x <= b.x + b.width + 10 &&
        p.y >= b.y - 10 &&
        p.y <= b.y + b.height + 10
      ) {
        moving.current = { x: 0, y: 0 };
        renderer.current?.page({
          ...page(),
          strokes: page().strokes.filter(
            (s) => !selectedRef.current.includes(s.id),
          ),
        });
      } else {
        select([]);
        lasso.current = [p];
      }
    } else
      active.current = {
        id: createId(),
        color,
        size,
        tool: mode === "shape" ? "pen" : mode,
        shape: mode === "shape" ? shape : undefined,
        points: [p],
      };
    paint();
  }
  function erase(p: InkPoint) {
    const current = docRef.current!;
    const previous = lastPoint.current ?? p,
      distance = Math.hypot(p.x - previous.x, p.y - previous.y),
      steps = Math.max(1, Math.ceil(distance / 9));
    let next = current;
    for (let i = 1; i <= steps; i++) {
      const q = {
        ...p,
        x: previous.x + ((p.x - previous.x) * i) / steps,
        y: previous.y + ((p.y - previous.y) * i) / steps,
      };
      next = (eraserMode === "stroke" ? eraseAt : eraseInkAt)(
        next,
        pageRef.current,
        q,
        Math.max(8, size * 2.5),
      );
    }
    if (next !== current) {
      docRef.current = next;
      baseDirty.current = true;
    }
  }
  function move(event: PointerEvent) {
    if (touches.current.has(event.pointerId)) {
      touches.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (pinch.current && touches.current.size >= 2) {
        event.preventDefault();
        const [a, b] = [...touches.current.values()],
          s = scrollRef.current!,
          box = s.getBoundingClientRect(),
          next = clamp(
            (pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
              pinch.current.distance,
            0.75,
            3,
          );
        updateZoom(next);
        // The paper width changes synchronously for a pinch; canvas rasterization follows once per frame.
        if (paperRef.current)
          paperRef.current.style.width = `${paperWidth * next}px`;
        s.scrollLeft = pinch.current.x * next - ((a.x + b.x) / 2 - box.left);
        s.scrollTop = pinch.current.y * next - ((a.y + b.y) / 2 - box.top);
        return;
      }
      if (pan.current) {
        event.preventDefault();
        const s = scrollRef.current!,
          desired = pan.current.top + pan.current.y - event.clientY;
        s.scrollLeft = pan.current.left + pan.current.x - event.clientX;
        s.scrollTop = desired;
        const outer = s.closest(".day-panel-body");
        if (outer) outer.scrollTop = pan.current.outer + desired - s.scrollTop;
        return;
      }
    }
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    if (event.pointerType === "pen") penUntil.current = performance.now() + 350;
    const batch = event.getCoalescedEvents?.() ?? [];
    for (const sample of batch.length ? batch : [event]) {
      let p = point(sample);
      if (toolRef.current === "eraser") erase(p);
      else if (toolRef.current === "lasso") {
        if (moving.current && start.current)
          moving.current = {
            x: p.x - start.current.x,
            y: p.y - start.current.y,
          };
        else lasso.current.push(p);
      } else if (active.current) {
        if (toolRef.current === "shape" && start.current)
          active.current.points = shapePoints(shape, start.current, p);
        else {
          if (ruler && start.current) {
            const rad = (rulerAngle * Math.PI) / 180,
              projection =
                (p.x - start.current.x) * Math.cos(rad) +
                (p.y - start.current.y) * Math.sin(rad);
            p = {
              ...p,
              x: clamp(
                start.current.x + projection * Math.cos(rad),
                0,
                INK_WIDTH,
              ),
              y: clamp(
                start.current.y + projection * Math.sin(rad),
                0,
                INK_HEIGHT,
              ),
            };
          }
          const previous =
            active.current.points[active.current.points.length - 1];
          if (
            Math.hypot(p.x - previous.x, p.y - previous.y) >= 0.25 ||
            Math.abs(p.pressure - previous.pressure) > 0.02
          )
            active.current.points.push(p);
        }
      }
      lastPoint.current = p;
    }
    const guesses =
      (
        event as PointerEvent & { getPredictedEvents?: () => PointerEvent[] }
      ).getPredictedEvents?.() ?? [];
    predicted.current =
      active.current && toolRef.current !== "shape" && !ruler && guesses.length
        ? {
            ...active.current,
            points: [
              ...active.current.points.slice(-2),
              ...guesses.slice(0, 5).map(point),
            ],
          }
        : null;
    schedulePaint();
  }
  function up(event: PointerEvent) {
    if (pointer.current === event.pointerId) {
      if (event.type === "pointerup") move(event);
      finish();
    }
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) {
      pinch.current = null;
      if (touches.current.size === 1 && pointer.current === null) {
        const p = [...touches.current.values()][0],
          s = scrollRef.current!;
        pan.current = {
          x: p.x,
          y: p.y,
          left: s.scrollLeft,
          top: s.scrollTop,
          outer: s.closest(".day-panel-body")?.scrollTop ?? 0,
        };
      }
    }
    if (!touches.current.size) pan.current = null;
    if (baseRef.current?.hasPointerCapture(event.pointerId))
      baseRef.current.releasePointerCapture(event.pointerId);
  }
  function selectionAction(
    action: "copy" | "paste" | "delete" | "smaller" | "larger",
  ) {
    finish();
    if (!docRef.current) return;
    const strokes = currentSelection();
    if (action === "copy") {
      clipboard.current = strokes;
      setHasClipboard(!!strokes.length);
      setStatus("Selection copied");
      return;
    }
    if (action === "paste") {
      const copy = transformStrokes(clipboard.current, 24, 24, 1, true);
      if (copy.length) {
        update(
          replacePage(docRef.current, pageRef.current, {
            ...page(),
            strokes: [...page().strokes, ...copy],
          }),
        );
        select(copy.map((s) => s.id));
        chooseTool("lasso");
      }
      return;
    }
    if (!strokes.length) return;
    const changes =
      action === "delete"
        ? []
        : transformStrokes(strokes, 0, 0, action === "smaller" ? 0.9 : 1.1);
    update(
      replacePage(docRef.current, pageRef.current, {
        ...page(),
        strokes: page().strokes.flatMap((s) =>
          selectedRef.current.includes(s.id)
            ? changes.filter((c) => c.id === s.id)
            : [s],
        ),
      }),
    );
    if (action === "delete") select([]);
  }
  function keyDown(event: KeyboardEvent) {
    const input = (event.target as HTMLElement).closest(
      "input,textarea,select",
    );
    if (input) return;
    if (event.key === "Escape" && expanded) {
      event.stopPropagation();
      event.preventDefault();
      toggleExpanded();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      history(event.shiftKey);
    }
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "c" &&
      selectedRef.current.length
    ) {
      event.preventDefault();
      selectionAction("copy");
    }
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "v" &&
      clipboard.current.length
    ) {
      event.preventDefault();
      selectionAction("paste");
    }
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      selectedRef.current.length
    ) {
      event.preventDefault();
      selectionAction("delete");
    }
  }
  function toggleExpanded() {
    finish();
    const next = !expanded;
    setExpanded(next);
    window.document.body.classList.toggle("ink-is-expanded", next);
    requestAnimationFrame(sizeCanvas);
  }
  async function exportPage(pdf = false) {
    try {
      await flush();
      if (pdf) await printInkDocument(docRef.current!);
      else
        await exportInkImage(
          page(),
          `plan-${dateISO}-page-${pageRef.current + 1}.png`,
        );
    } catch {
      setSaveError(true);
      setStatus("Export failed · try again");
    }
  }
  return (
    <div
      class={`ink-editor ink-editor-inline ${expanded ? "ink-expanded" : ""}`}
      ref={rootRef}
      role="region"
      aria-label={`Handwriting for ${dateISO}`}
      onKeyDown={keyDown}
    >
      <div class="ink-workspace-heading">
        <span>
          Notebook <small>{dateISO}</small>
        </span>
        <div>
          <button
            class="ink-tool"
            disabled={!undoRef.current.length}
            onClick={() => history()}
            aria-label="Undo stroke"
          >
            ↶ Undo
          </button>
          <button
            class="ink-tool"
            disabled={!redoRef.current.length}
            onClick={() => history(true)}
            aria-label="Redo stroke"
          >
            ↷ Redo
          </button>
          <button
            class="ink-tool"
            onClick={toggleExpanded}
            aria-pressed={expanded}
          >
            {expanded ? "Done writing" : "Expand canvas"} {expanded ? "↙" : "↗"}
          </button>
        </div>
      </div>
      <div class="ink-tools" role="toolbar" aria-label="Drawing tools">
        <div class="ink-tool-group">
          {(
            [
              "pen",
              "pencil",
              "highlighter",
              "eraser",
              "lasso",
              "shape",
            ] as const
          ).map((mode) => (
            <button
              class={`ink-tool ${tool === mode ? "is-active" : ""}`}
              aria-pressed={tool === mode}
              onClick={() => chooseTool(mode)}
            >
              {mode === "highlighter"
                ? "Marker"
                : mode === "shape"
                  ? "Shapes"
                  : mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <div class="ink-colors" aria-label="Ink color">
          {COLORS.map((c) => (
            <button
              class={`ink-color ${color === c.value ? "is-active" : ""}`}
              style={{ backgroundColor: c.value }}
              aria-label={`${c.name} ink`}
              aria-pressed={color === c.value}
              onClick={() => {
                finish();
                setColor(c.value);
              }}
            />
          ))}
          <label class="ink-custom-color" title="Custom ink color">
            <span class="visually-hidden">Custom ink color</span>
            <input
              type="color"
              value={color}
              onInput={(e) => {
                finish();
                setColor(e.currentTarget.value);
              }}
            />
          </label>
        </div>
        <label class="ink-size">
          Width
          <input
            type="range"
            min="1"
            max="18"
            step=".5"
            value={size}
            onInput={(e) => {
              finish();
              setSize(Number(e.currentTarget.value));
            }}
          />
          <output>{size}</output>
        </label>
      </div>
      <div class="ink-options">
        <div class="ink-option-controls">
          {tool === "eraser" && (
            <label>
              Eraser
              <select
                aria-label="Eraser mode"
                value={eraserMode}
                onChange={(e) => {
                  finish();
                  setEraserMode(e.currentTarget.value as typeof eraserMode);
                }}
              >
                <option value="partial">Partial ink</option>
                <option value="stroke">Whole stroke</option>
              </select>
            </label>
          )}
          {tool === "shape" && (
            <label>
              Shape
              <select
                aria-label="Shape"
                value={shape}
                onChange={(e) => {
                  finish();
                  setShape(e.currentTarget.value as typeof shape);
                }}
              >
                <option value="line">Line</option>
                <option value="rectangle">Rectangle</option>
                <option value="ellipse">Ellipse</option>
              </select>
            </label>
          )}
          <label>
            Paper
            <select
              aria-label="Paper"
              value={document?.pages[pageIndex]?.paper ?? "ruled"}
              onChange={(e) => {
                finish();
                if (docRef.current)
                  update(
                    replacePage(docRef.current, pageRef.current, {
                      ...page(),
                      paper: e.currentTarget.value as
                        "plain" | "ruled" | "grid" | "dots",
                    }),
                  );
              }}
            >
              <option value="ruled">Ruled</option>
              <option value="plain">Plain</option>
              <option value="grid">Grid</option>
              <option value="dots">Dots</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={ruler}
              onChange={(e) => {
                finish();
                setRuler(e.currentTarget.checked);
              }}
            />
            Ruler
          </label>
          {ruler && (
            <label>
              Angle
              <input
                type="range"
                min="-90"
                max="90"
                value={rulerAngle}
                onInput={(e) => {
                  finish();
                  setRulerAngle(Number(e.currentTarget.value));
                }}
              />
              <output>{rulerAngle}°</output>
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={fingerDraw}
              onChange={(e) => {
                finish();
                setFingerDraw(e.currentTarget.checked);
              }}
            />
            Finger drawing
          </label>
        </div>
        <div class="ink-zoom">
          <button
            class="ink-tool"
            aria-label="Zoom out"
            disabled={zoom <= 0.75}
            onClick={() => {
              finish();
              updateZoom(zoom - 0.25);
            }}
          >
            −
          </button>
          <button
            class="ink-tool"
            aria-label="Fit page width"
            onClick={() => {
              finish();
              updateZoom(1);
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            class="ink-tool"
            aria-label="Zoom in"
            disabled={zoom >= 3}
            onClick={() => {
              finish();
              updateZoom(zoom + 0.25);
            }}
          >
            +
          </button>
        </div>
      </div>
      {(selected.length > 0 || hasClipboard) && (
        <div
          class="ink-selection-bar"
          role="toolbar"
          aria-label="Selection actions"
        >
          <span>
            {selected.length ? `${selected.length} selected` : "Clipboard"}
          </span>
          <button
            disabled={!selected.length}
            onClick={() => selectionAction("copy")}
          >
            Copy
          </button>
          <button
            disabled={!hasClipboard}
            onClick={() => selectionAction("paste")}
          >
            Paste
          </button>
          <button
            disabled={!selected.length}
            onClick={() => selectionAction("smaller")}
          >
            Smaller
          </button>
          <button
            disabled={!selected.length}
            onClick={() => selectionAction("larger")}
          >
            Larger
          </button>
          <button
            disabled={!selected.length}
            onClick={() => selectionAction("delete")}
          >
            Delete selection
          </button>
          <button onClick={() => select([])}>Deselect</button>
        </div>
      )}
      <div
        class="ink-scroll scroll-panel"
        ref={scrollRef}
        onScroll={() => {
          if (pointer.current === null)
            rectRef.current = paperRef.current?.getBoundingClientRect() ?? null;
        }}
      >
        {document ? (
          <div
            class="ink-paper"
            ref={paperRef}
            style={{ width: `${paperWidth * zoom}px` }}
          >
            <canvas
              class="ink-canvas ink-base"
              ref={baseRef}
              tabIndex={0}
              role="img"
              aria-label={`Handwritten page ${pageIndex + 1} of ${document.pages.length}`}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onLostPointerCapture={up}
            />
            <canvas
              class="ink-active"
              ref={activeCanvasRef}
              aria-hidden="true"
            />
            <canvas class="ink-feedback" ref={feedbackRef} aria-hidden="true" />
          </div>
        ) : (
          <p>{status}</p>
        )}
      </div>
      <footer class="ink-footer">
        <div class="ink-page-controls">
          <button
            class="ink-tool"
            disabled={pageIndex === 0}
            onClick={() => changePage(pageIndex - 1)}
            aria-label="Previous ink page"
          >
            ‹
          </button>
          <span>
            {pageIndex + 1} / {document?.pages.length ?? 1}
          </span>
          <button
            class="ink-tool"
            disabled={!document || pageIndex >= document.pages.length - 1}
            onClick={() => changePage(pageIndex + 1)}
            aria-label="Next ink page"
          >
            ›
          </button>
          <button
            class="ink-tool"
            disabled={!document}
            onClick={() => {
              finish();
              if (docRef.current) {
                const index = docRef.current.pages.length;
                update(addInkPage(docRef.current));
                changePage(index);
              }
            }}
          >
            + Page
          </button>
        </div>
        <details class="ink-page-menu">
          <summary>Page actions</summary>
          <div>
            <button
              disabled={!document}
              onClick={() => {
                void exportPage();
              }}
            >
              Save PNG
            </button>
            <button
              disabled={!document}
              onClick={() => {
                void exportPage(true);
              }}
            >
              Print / PDF
            </button>
            <button
              disabled={!document?.pages[pageIndex]?.strokes.length}
              onClick={() => {
                finish();
                if (docRef.current) {
                  update(clearInkPage(docRef.current, pageRef.current));
                  select([]);
                }
              }}
            >
              Clear page
            </button>
            <button
              disabled={!document}
              onClick={() => {
                finish();
                if (docRef.current) {
                  update(removeInkPage(docRef.current, pageRef.current));
                  changePage(
                    Math.max(
                      0,
                      Math.min(
                        pageRef.current,
                        docRef.current.pages.length - 1,
                      ),
                    ),
                  );
                }
              }}
            >
              Delete page
            </button>
          </div>
        </details>
        <button
          class={`ink-save-status ${saveError ? "has-error" : ""}`}
          role="status"
          onClick={() => {
            if (saveError) void flush().catch(() => undefined);
          }}
        >
          {status}
        </button>
      </footer>
    </div>
  );
}
