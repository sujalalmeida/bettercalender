import { describe, expect, it } from "vitest";
import { GardenLandscape } from "../GardenLandscape";
import { GARDEN_PROJECTS } from "../../lib/gardenGrowth";

interface ElementNode {
  type: string;
  props: Record<string, unknown>;
}
// These scene components are pure SVG functions, so their output can be inspected without a DOM.
function elements(node: unknown): ElementNode[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (
    !node ||
    typeof node !== "object" ||
    !("type" in node) ||
    !("props" in node)
  )
    return [];
  const v = node as { type: unknown; props: Record<string, unknown> };
  if (typeof v.type === "function") return elements(v.type(v.props));
  return [
    ...(typeof v.type === "string" ? [v as ElementNode] : []),
    ...elements(v.props.children),
  ];
}
const scene = (minutes: number, motion = true) =>
  elements(GardenLandscape({ elapsedMs: minutes * 60000, seed: 42, motion }));
describe("garden scene", () => {
  it("starts as grass without trees, flowers, villagers, or buildings", () => {
    const start = scene(0);
    expect(
      start.some(
        (e) =>
          "data-garden-tree" in e.props ||
          "data-garden-bed" in e.props ||
          "data-garden-project" in e.props,
      ),
    ).toBe(false);
    expect(
      start.some((e) => String(e.props.class ?? "").includes("garden-walker")),
    ).toBe(false);
    expect(
      start.some((e) =>
        String(e.props.class ?? "").includes("garden-chimney-smoke"),
      ),
    ).toBe(false);
    expect(scene(30).some((e) => "data-garden-tree" in e.props)).toBe(true);
  });
  it("renders all earned projects and keeps SVG references valid at six days", () => {
    const mature = scene(144 * 60);
    const earned = mature
      .filter((e) => "data-garden-project" in e.props)
      .map((e) => e.props["data-garden-project"]);
    expect(earned.sort()).toEqual(GARDEN_PROJECTS.map((p) => p.id).sort());
    expect(
      mature.some(
        (e) =>
          e.type === "g" &&
          e.props["clip-path"] === "url(#garden-world-boundary)",
      ),
    ).toBe(true);
    const ids = mature.flatMap((e) => (e.props.id ? [e.props.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of mature.filter((e) => e.type === "use"))
      expect(ids).toContain(String(e.props.href).slice(1));
    expect(mature.length).toBeLessThan(12000);
  });
  it("stops motion through the existing still-scene switch", () => {
    expect(scene(60, false)[0].props.class).toContain("garden-still");
    expect(scene(60, true)[0].props.class).not.toContain("garden-still");
  });
});
