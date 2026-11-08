import { focusElapsed } from "./focusTimer";
import { STUDY_MINUTE, type GardenClock } from "./gardenState";

export const DEFAULT_OUTPOST_GOAL = 25;
export const MAX_OUTPOST_GOAL = 720;

export function validOutpostGoal(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_OUTPOST_GOAL;
}

export function shouldRaid(clock: GardenClock, now: number): boolean {
  return clock.timer.startedAt !== null &&
    validOutpostGoal(clock.goalMinutes) &&
    focusElapsed(clock.timer, now) < clock.goalMinutes * STUDY_MINUTE;
}

export const OUTPOST_MILESTONES = [
  { minutes: 1, label: "Camp beacon" },
  { minutes: 15, label: "Astromech arrives" },
  { minutes: 60, label: "Moisture farm" },
  { minutes: 120, label: "Workshop and landing pad" },
  { minutes: 240, label: "Cargo speeder" },
  { minutes: 360, label: "Starfighter assembly" },
  { minutes: 720, label: "First starfighter flight" },
  { minutes: 1080, label: "Cantina" },
  { minutes: 1440, label: "Rebel hangar" },
  { minutes: 2160, label: "Star Destroyer on the horizon" },
  { minutes: 2880, label: "Cargo terminal" },
  { minutes: 3600, label: "Jedi patrol" },
  { minutes: 4320, label: "Jedi sanctuary" },
  { minutes: 5760, label: "Temple archive" },
  { minutes: 7200, label: "Capital fleet" },
  { minutes: 8640, label: "Twin Suns flyover" },
] as const;

export function outpostStage(elapsedMs: number) {
  const minutes = Math.max(0, elapsedMs / STUDY_MINUTE);
  return {
    minutes,
    completed: OUTPOST_MILESTONES.filter(item => item.minutes <= minutes).length,
    next: OUTPOST_MILESTONES.find(item => item.minutes > minutes),
  };
}
