import type { InkDocument, InkPage, InkPoint, InkStroke } from "../db/types";
import { createId } from "./id";

export const INK_WIDTH = 1000;
export const INK_HEIGHT = 1400;
export type InkBounds = { x: number; y: number; width: number; height: number };
const boundsCache = new WeakMap<InkStroke, InkBounds>();
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));
export function blankInkDocument(date: string): InkDocument {
  return {
    date,
    pages: [{ id: createId(), strokes: [] }],
    updatedAt: Date.now(),
  };
}
export function appendStroke(
  document: InkDocument,
  pageIndex: number,
  stroke: InkStroke,
): InkDocument {
  return {
    ...document,
    pages: document.pages.map((page, i) =>
      i === pageIndex ? { ...page, strokes: [...page.strokes, stroke] } : page,
    ),
  };
}
export function replacePage(
  document: InkDocument,
  pageIndex: number,
  page: InkPage,
): InkDocument {
  return {
    ...document,
    pages: document.pages.map((p, i) => (i === pageIndex ? page : p)),
  };
}
export function strokeBounds(stroke: InkStroke): InkBounds {
  const cached = boundsCache.get(stroke);
  if (cached) return cached;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of stroke.points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  boundsCache.set(stroke, bounds);
  return bounds;
}
export function selectionBounds(strokes: InkStroke[]): InkBounds | null {
  if (!strokes.length) return null;
  const all = strokes.map(strokeBounds);
  const x = Math.min(...all.map((b) => b.x)),
    y = Math.min(...all.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...all.map((b) => b.x + b.width)) - x,
    height: Math.max(...all.map((b) => b.y + b.height)) - y,
  };
}
export function distanceToSegment(
  point: InkPoint,
  a: InkPoint,
  b: InkPoint,
): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / length, 0, 1);
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}
function nearby(stroke: InkStroke, point: InkPoint, radius: number): boolean {
  const b = strokeBounds(stroke);
  return (
    point.x >= b.x - radius &&
    point.x <= b.x + b.width + radius &&
    point.y >= b.y - radius &&
    point.y <= b.y + b.height + radius
  );
}
export function eraseAt(
  document: InkDocument,
  pageIndex: number,
  point: InkPoint,
  radius: number,
): InkDocument {
  const page = document.pages[pageIndex];
  const strokes = page.strokes.filter(
    (s) =>
      !nearby(s, point, radius + s.size * 2) ||
      !s.points.some(
        (p, i) =>
          distanceToSegment(point, s.points[Math.max(0, i - 1)], p) <=
          radius + s.size,
      ),
  );
  return strokes.length === page.strokes.length
    ? document
    : replacePage(document, pageIndex, { ...page, strokes });
}
const interpolate = (a: InkPoint, b: InkPoint, t: number): InkPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  pressure: a.pressure + (b.pressure - a.pressure) * t,
  tilt: (a.tilt ?? 0) + ((b.tilt ?? 0) - (a.tilt ?? 0)) * t,
});
/** Split crossing segments at the eraser boundary, including sparsely sampled lines. */
export function eraseInkAt(
  document: InkDocument,
  pageIndex: number,
  point: InkPoint,
  radius: number,
): InkDocument {
  const page = document.pages[pageIndex];
  let changed = false;
  const strokes = page.strokes.flatMap((stroke) => {
    const r = radius + stroke.size / 2;
    if (!nearby(stroke, point, r)) return [stroke];
    if (stroke.points.length === 1) {
      if (
        Math.hypot(stroke.points[0].x - point.x, stroke.points[0].y - point.y) >
        r
      )
        return [stroke];
      changed = true;
      return [];
    }
    const pieces: InkPoint[][] = [];
    let piece: InkPoint[] = [];
    let hit = false;
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1],
        b = stroke.points[i];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        ax = a.x - point.x,
        ay = a.y - point.y;
      const aa = dx * dx + dy * dy,
        bb = 2 * (ax * dx + ay * dy),
        cc = ax * ax + ay * ay - r * r;
      const discriminant = bb * bb - 4 * aa * cc;
      const cuts = [0, 1];
      if (aa > 0 && discriminant > 0)
        for (const t of [
          (-bb - Math.sqrt(discriminant)) / (2 * aa),
          (-bb + Math.sqrt(discriminant)) / (2 * aa),
        ])
          if (t > 0 && t < 1) cuts.push(t);
      cuts.sort((x, y) => x - y);
      for (let j = 1; j < cuts.length; j++) {
        const from = cuts[j - 1],
          to = cuts[j],
          middle = interpolate(a, b, (from + to) / 2);
        if (Math.hypot(middle.x - point.x, middle.y - point.y) > r) {
          if (!piece.length) piece.push(interpolate(a, b, from));
          piece.push(interpolate(a, b, to));
        } else {
          hit = true;
          if (piece.length) pieces.push(piece);
          piece = [];
        }
      }
    }
    if (piece.length) pieces.push(piece);
    if (!hit) return [stroke];
    changed = true;
    return pieces.map((points, i) => ({
      ...stroke,
      id: i === 0 ? stroke.id : createId(),
      points,
    }));
  });
  return changed
    ? replacePage(document, pageIndex, { ...page, strokes })
    : document;
}
export function pointInPolygon(point: InkPoint, polygon: InkPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
const orient = (a: InkPoint, b: InkPoint, c: InkPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function crosses(a: InkPoint, b: InkPoint, c: InkPoint, d: InkPoint): boolean {
  return (
    orient(a, b, c) * orient(a, b, d) < 0 &&
    orient(c, d, a) * orient(c, d, b) < 0
  );
}
export function lassoStrokes(page: InkPage, polygon: InkPoint[]): string[] {
  if (polygon.length < 3) return [];
  return page.strokes
    .filter((s) =>
      s.points.some(
        (p, i) =>
          pointInPolygon(p, polygon) ||
          (i > 0 &&
            polygon.some((q, j) =>
              crosses(s.points[i - 1], p, q, polygon[(j + 1) % polygon.length]),
            )),
      ),
    )
    .map((s) => s.id);
}
export function hitStroke(
  page: InkPage,
  point: InkPoint,
  radius = 12,
): string[] {
  const stroke = [...page.strokes]
    .reverse()
    .find(
      (s) =>
        nearby(s, point, radius + s.size * 2) &&
        s.points.some(
          (p, i) =>
            distanceToSegment(point, s.points[Math.max(0, i - 1)], p) <=
            radius + s.size,
        ),
    );
  return stroke ? [stroke.id] : [];
}
export function transformStrokes(
  strokes: InkStroke[],
  dx: number,
  dy: number,
  scale = 1,
  duplicate = false,
): InkStroke[] {
  const bounds = selectionBounds(strokes);
  if (!bounds) return [];
  const cx = bounds.x + bounds.width / 2,
    cy = bounds.y + bounds.height / 2;
  const safeScale = Math.max(
    0.05,
    Math.min(
      scale,
      bounds.width ? INK_WIDTH / bounds.width : 100,
      bounds.height ? INK_HEIGHT / bounds.height : 100,
    ),
  );
  const left = cx - (bounds.width * safeScale) / 2,
    top = cy - (bounds.height * safeScale) / 2;
  dx = clamp(dx, -left, INK_WIDTH - left - bounds.width * safeScale);
  dy = clamp(dy, -top, INK_HEIGHT - top - bounds.height * safeScale);
  return strokes.map((s) => ({
    ...s,
    id: duplicate ? createId() : s.id,
    size: clamp(s.size * safeScale, 0.5, 100),
    points: s.points.map((p) => ({
      ...p,
      x: clamp(cx + (p.x - cx) * safeScale + dx, 0, INK_WIDTH),
      y: clamp(cy + (p.y - cy) * safeScale + dy, 0, INK_HEIGHT),
    })),
  }));
}
export function shapePoints(
  kind: "line" | "rectangle" | "ellipse",
  start: InkPoint,
  end: InkPoint,
): InkPoint[] {
  if (kind === "line") return [start, end];
  const x = Math.min(start.x, end.x),
    y = Math.min(start.y, end.y),
    w = Math.abs(end.x - start.x),
    h = Math.abs(end.y - start.y);
  const point = (x: number, y: number) => ({ x, y, pressure: 0.65 });
  if (kind === "rectangle")
    return [
      point(x, y),
      point(x + w, y),
      point(x + w, y + h),
      point(x, y + h),
      point(x, y),
    ];
  return Array.from({ length: 65 }, (_, i) =>
    point(
      x + w / 2 + (w / 2) * Math.cos((i / 64) * Math.PI * 2),
      y + h / 2 + (h / 2) * Math.sin((i / 64) * Math.PI * 2),
    ),
  );
}
export function addInkPage(document: InkDocument): InkDocument {
  return {
    ...document,
    pages: [
      ...document.pages,
      {
        id: createId(),
        strokes: [],
        paper: document.pages[document.pages.length - 1]?.paper,
      },
    ],
  };
}
export function clearInkPage(
  document: InkDocument,
  pageIndex: number,
): InkDocument {
  const page = document.pages[pageIndex];
  return page.strokes.length
    ? replacePage(document, pageIndex, { ...page, strokes: [] })
    : document;
}
export function removeInkPage(
  document: InkDocument,
  pageIndex: number,
): InkDocument {
  return document.pages.length === 1
    ? clearInkPage(document, 0)
    : { ...document, pages: document.pages.filter((_, i) => i !== pageIndex) };
}

export function drawPaper(
  ctx: CanvasRenderingContext2D,
  page: InkPage,
  guides = true,
): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, INK_WIDTH, INK_HEIGHT);
  if (!guides || page.paper === "plain") return;
  ctx.strokeStyle = "#e5e9ee";
  ctx.fillStyle = "#d4dbe4";
  ctx.lineWidth = 0.8;
  if (page.paper === "dots") {
    for (let y = 48; y < INK_HEIGHT; y += 32)
      for (let x = 36; x < INK_WIDTH; x += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
  } else {
    ctx.beginPath();
    const step = page.paper === "grid" ? 32 : 48;
    for (let y = page.paper === "grid" ? 32 : 96; y < INK_HEIGHT; y += step) {
      ctx.moveTo(32, y);
      ctx.lineTo(INK_WIDTH - 32, y);
    }
    if (page.paper === "grid")
      for (let x = 32; x < INK_WIDTH; x += step) {
        ctx.moveTo(x, 32);
        ctx.lineTo(x, INK_HEIGHT - 32);
      }
    ctx.stroke();
  }
}
/** One filled pressure ribbon per stroke; midpoint curves preserve small handwriting. */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: InkStroke,
): void {
  const input = stroke.points;
  if (!input.length) return;
  const points: InkPoint[] = [input[0]];
  if (stroke.shape) points.push(...input.slice(1));
  else
    for (let i = 1; i < input.length; i++) {
      const a = i > 1 ? interpolate(input[i - 2], input[i - 1], 0.5) : input[0];
      const c = input[i - 1],
        b = i === input.length - 1 ? input[i] : interpolate(c, input[i], 0.5);
      for (const t of [0.5, 1])
        points.push({
          x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
          y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
          pressure: c.pressure + (b.pressure - c.pressure) * t,
          tilt: c.tilt,
        });
    }
  ctx.save();
  ctx.globalAlpha *=
    stroke.tool === "highlighter" ? 0.28 : stroke.tool === "pencil" ? 0.72 : 1;
  if (stroke.tool === "highlighter") ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = stroke.color;
  const radii = points.map((p) =>
    Math.max(
      0.4,
      stroke.size *
        (stroke.tool === "highlighter" ? 1.7 : 0.18 + p.pressure * 0.38) *
        (stroke.tool === "pencil" ? 1 + (p.tilt ?? 0) * 2 : 1),
    ),
  );
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, radii[0], 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const left: { x: number; y: number }[] = [],
    right: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / d) * radii[i],
      ny = ((b.x - a.x) / d) * radii[i];
    left.push({ x: p.x + nx, y: p.y + ny });
    right.push({ x: p.x - nx, y: p.y - ny });
  });
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const p of left.slice(1)) ctx.lineTo(p.x, p.y);
  const last = points[points.length - 1],
    lastR = radii[radii.length - 1];
  ctx.arc(
    last.x,
    last.y,
    lastR,
    Math.atan2(
      left[left.length - 1].y - last.y,
      left[left.length - 1].x - last.x,
    ),
    Math.atan2(
      right[right.length - 1].y - last.y,
      right[right.length - 1].x - last.x,
    ),
    true,
  );
  for (const p of right.reverse()) ctx.lineTo(p.x, p.y);
  ctx.arc(
    points[0].x,
    points[0].y,
    radii[0],
    Math.atan2(
      right[right.length - 1].y - points[0].y,
      right[right.length - 1].x - points[0].x,
    ),
    Math.atan2(left[0].y - points[0].y, left[0].x - points[0].x),
    true,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
export function drawInkPage(
  ctx: CanvasRenderingContext2D,
  page: InkPage,
  active?: InkStroke | null,
  showGuides = true,
): void {
  drawPaper(ctx, page, showGuides);
  for (const stroke of page.strokes) drawStroke(ctx, stroke);
  if (active) drawStroke(ctx, active);
}
