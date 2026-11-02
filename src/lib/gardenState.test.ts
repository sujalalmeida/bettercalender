import { describe, expect, it } from "vitest";
import {
  gardenElapsed,
  gardenStage,
  newClock,
  parseGardenClock,
  sessionSnapshot,
} from "./gardenState";
import { startFocus } from "./focusTimer";
const garden = {
  id: "main",
  generation: "garden-1",
  seed: 1,
  createdAt: 0,
  updatedAt: 0,
};
describe("persistent garden clock", () => {
  it("counts active time once even if its saved session already contains the same credit", () => {
    const clock = {
      ...newClock(garden.generation, 1000),
      timer: startFocus(
        { elapsedMs: 0, startedAt: null, lastSeenAt: null },
        1000,
      ),
    };
    const row = sessionSnapshot(clock, 61000);
    expect(gardenElapsed(garden, [row], clock, 61000)).toBe(60000);
    expect(
      gardenElapsed(garden, [row], newClock(garden.generation, 61000), 61000),
    ).toBe(60000);
  });
  it("continues a running stopwatch across a long background/reopen interval", () => {
    const clock = {
      ...newClock(garden.generation, 1000),
      timer: startFocus(
        { elapsedMs: 0, startedAt: null, lastSeenAt: null },
        1000,
      ),
    };
    const restored = parseGardenClock(JSON.stringify(clock), 7201000)!;
    expect(sessionSnapshot(restored, 7201000).elapsedMs).toBe(7200000);
    expect(restored.timer.startedAt).toBe(1000);
  });
  it("keeps stopped session credits and excludes previous garden generations", () => {
    const a = sessionSnapshot({
      ...newClock("garden-1"),
      timer: { elapsedMs: 3600000, startedAt: null, lastSeenAt: null },
    });
    const b = sessionSnapshot({
      ...newClock("old-garden"),
      timer: { elapsedMs: 7200000, startedAt: null, lastSeenAt: null },
    });
    expect(gardenElapsed(garden, [a, b], null)).toBe(3600000);
  });
  it("continues plant growth and cycles seasons beyond one hour and one day", () => {
    expect(gardenStage(44 * 60000).next?.label).toBe("A flowing stream");
    expect(gardenStage(45 * 60000).minutes).toBe(45);
    expect(gardenStage(12 * 3600000).flowers).toBeGreaterThan(
      gardenStage(3600000).flowers,
    );
    expect(gardenStage(24 * 3600000).flowers).toBeGreaterThan(
      gardenStage(12 * 3600000).flowers,
    );
    expect(gardenStage(6 * 3600000).season).toBe("Summer");
    expect(gardenStage(18 * 3600000).season).toBe("Summer");
    expect(gardenStage(24 * 3600000).season).toBe("Spring");
    expect(gardenStage(100 * 3600000).detailedFlowers).toBeLessThanOrEqual(420);
  });
  it("moves continuously from day to night and dawn", () => {
    expect(gardenStage(0).night).toBe(0);
    expect(gardenStage(120 * 60000).phase).toBe("Night");
    expect(gardenStage(120 * 60000).night).toBe(1);
    expect(gardenStage(175 * 60000).phase).toBe("Dawn");
    expect(gardenStage(179.99 * 60000).night).toBeCloseTo(
      gardenStage(180 * 60000).night,
      5,
    );
    for (const boundary of [0.33, 0.53, 0.8]) {
      expect(gardenStage((boundary * 180 - 0.001) * 60000).night).toBeCloseTo(
        gardenStage((boundary * 180 + 0.001) * 60000).night,
        5,
      );
    }
  });
});
