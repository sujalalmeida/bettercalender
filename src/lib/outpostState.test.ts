import { describe, expect, it } from "vitest";
import { newClock, parseGardenClock, STUDY_MINUTE } from "./gardenState";
import { pauseFocus, startFocus } from "./focusTimer";
import { OUTPOST_MILESTONES, outpostStage, shouldRaid } from "./outpostState";

describe("outpost focus", () => {
  it("keeps the locked goal across reloads and triggers a raid only when a running session ends early", () => {
    const clock = newClock("outpost-v1", 1000);
    clock.goalMinutes = 25;
    clock.timer = startFocus(clock.timer, 1000);
    const deadline = 1000 + 25 * STUDY_MINUTE;
    const restored = parseGardenClock(JSON.stringify(clock), deadline - 1)!;
    expect(shouldRaid(restored, deadline - 1)).toBe(true);
    expect(shouldRaid(restored, deadline)).toBe(false);
    const stopped = { ...restored, timer: pauseFocus(restored.timer, deadline - 1) };
    expect(shouldRaid(stopped, deadline - 1)).toBe(false);
    expect(stopped.timer.elapsedMs).toBe(25 * STUDY_MINUTE - 1);
  });

  it("finishes the 144-hour roadmap while keeping all milestones earned thereafter", () => {
    const end = 144 * 60 * STUDY_MINUTE;
    expect(outpostStage(end - 1).next?.label).toBe("Twin Suns flyover");
    expect(outpostStage(end).next).toBeUndefined();
    expect(outpostStage(end + STUDY_MINUTE).completed).toBe(OUTPOST_MILESTONES.length);
  });
});
