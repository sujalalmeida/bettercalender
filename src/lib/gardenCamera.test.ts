import { describe, expect, it } from "vitest";
import { gardenViewBox } from "./gardenCamera";

describe("garden camera", () => {
  it("reveals both edges on a portrait screen without stretching the scene", () => {
    const left = gardenViewBox(390, 700, 0);
    const right = gardenViewBox(390, 700, 1);
    expect(left[0]).toBe(0);
    expect(right[0] + right[2]).toBeCloseTo(1600);
    expect(left[2] / left[3]).toBeCloseTo(390 / 700);
    expect(gardenViewBox(390, 700, 2)).toEqual(right);
  });
  it("preserves the full garden width on a landscape screen", () => {
    const view = gardenViewBox(1600, 800);
    expect(view[0]).toBe(0);
    expect(view[2]).toBe(1600);
    expect(view[2] / view[3]).toBe(2);
    expect(view[1]).toBeGreaterThanOrEqual(0);
    expect(view[1] + view[3]).toBeLessThanOrEqual(1000);
  });
});
