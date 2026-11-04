import { describe, expect, it } from "vitest";
import {
  GARDEN_BED_COUNT,
  GARDEN_PROJECTS,
  gardenBeds,
  projectProgress,
} from "./gardenGrowth";
import { gardenStage } from "./gardenState";

describe("continuous garden development", () => {
  it("starts unplanted and places earned beds consistently across reloads", () => {
    expect(gardenBeds(0, 42)).toEqual([]);
    const early = gardenBeds(600, 42),
      later = gardenBeds(1200, 42);
    expect(gardenBeds(600, 42)).toEqual(early);
    expect(
      later
        .filter((b) => early.some((e) => e.id === b.id))
        .map((b) => [b.x, b.y]),
    ).toEqual(early.map((b) => [b.x, b.y]));
    expect(gardenBeds(600, 13).map((b) => [b.x, b.y])).not.toEqual(
      early.map((b) => [b.x, b.y]),
    );
  });
  it("keeps changing visually over every fifteen minute interval for six days", () => {
    const signature = (minute: number) =>
      JSON.stringify([
        Math.min(420, gardenStage(minute * 60000).flowers),
        gardenBeds(minute, 42).map((b) => [b.id, b.growth]),
      ]);
    for (let minute = 15; minute <= 144 * 60; minute += 15) {
      expect(signature(minute), `unchanged at ${minute} minutes`).not.toBe(
        signature(minute - 15),
      );
    }
  });
  it("interpolates construction and plants within a minute rather than using timed bursts", () => {
    const project = GARDEN_PROJECTS[0];
    const a = projectProgress(project.minutes + 12, project),
      b = projectProgress(project.minutes + 12.1, project);
    expect(b).toBeGreaterThan(a);
    expect(b - a).toBeLessThan(0.01);
    expect(gardenBeds(12.1, 42)[0].growth).toBeGreaterThan(
      gardenBeds(12, 42)[0].growth,
    );
  });
  it("bounds planting details while covering the requested six days for different seeds", () => {
    for (const seed of [0, 1, 42, 817, 2147483646]) {
      const beds = gardenBeds(200 * 60, seed);
      expect(beds).toHaveLength(GARDEN_BED_COUNT);
      expect(new Set(beds.map((b) => `${b.x},${b.y}`)).size).toBe(
        GARDEN_BED_COUNT,
      );
      expect(
        beds.every(
          (b) => b.growth === 1 && b.x >= 0 && b.x <= 1600 && b.y <= 1000,
        ),
      ).toBe(true);
    }
    expect(
      Math.max(...GARDEN_PROJECTS.map((p) => p.minutes + p.duration)),
    ).toBe(144 * 60);
  });
  it("uses only spring and summer without slowing existing early unlocks", () => {
    for (let hour = 0; hour <= 144; hour++)
      expect(["Spring", "Summer"]).toContain(
        gardenStage(hour * 3600000).season,
      );
    for (const minute of [20, 45, 60, 75, 90, 120, 150, 240, 300, 480, 600]) {
      expect(gardenStage((minute - 0.01) * 60000).next?.minutes).toBe(minute);
    }
  });
});
