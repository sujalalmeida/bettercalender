import { clamp, noise } from "./gardenPalette";

export type GardenProjectKind =
  | "arbor"
  | "apiary"
  | "laundry"
  | "waterwheel"
  | "gazebo"
  | "well"
  | "pond"
  | "herbs"
  | "bakery"
  | "lavender"
  | "picnic"
  | "rabbits"
  | "porch"
  | "telescope"
  | "orchard"
  | "table"
  | "studio"
  | "steps"
  | "swing"
  | "fountain"
  | "cart"
  | "conservatory"
  | "lanterns"
  | "pergola";
export interface GardenProject {
  id: string;
  minutes: number;
  label: string;
  kind: GardenProjectKind;
  x: number;
  y: number;
  scale: number;
  duration: number;
}
// Existing early unlocks keep their timing. Later projects extend the village for six days.
export const GARDEN_PROJECTS: GardenProject[] = [
  {
    id: "rose-arbor",
    minutes: 720,
    label: "Rose arbor",
    kind: "arbor",
    x: 173,
    y: 754,
    scale: 0.85,
    duration: 90,
  },
  {
    id: "beehives",
    minutes: 1080,
    label: "Bee garden",
    kind: "apiary",
    x: 126,
    y: 514,
    scale: 0.65,
    duration: 100,
  },
  {
    id: "washing-line",
    minutes: 1260,
    label: "Cottage washing line",
    kind: "laundry",
    x: 386,
    y: 474,
    scale: 0.7,
    duration: 75,
  },
  {
    id: "waterwheel",
    minutes: 1620,
    label: "Stream waterwheel",
    kind: "waterwheel",
    x: 1375,
    y: 799,
    scale: 0.85,
    duration: 120,
  },
  {
    id: "tea-gazebo",
    minutes: 1800,
    label: "Tea gazebo",
    kind: "gazebo",
    x: 798,
    y: 367,
    scale: 0.65,
    duration: 135,
  },
  {
    id: "stone-well",
    minutes: 1980,
    label: "Stone well",
    kind: "well",
    x: 490,
    y: 737,
    scale: 0.65,
    duration: 90,
  },
  {
    id: "lily-pond",
    minutes: 2160,
    label: "Lily pond",
    kind: "pond",
    x: 392,
    y: 864,
    scale: 0.9,
    duration: 135,
  },
  {
    id: "herb-nursery",
    minutes: 2340,
    label: "Herb nursery",
    kind: "herbs",
    x: 623,
    y: 434,
    scale: 0.7,
    duration: 120,
  },
  {
    id: "bakery-stall",
    minutes: 2520,
    label: "Bakery stall",
    kind: "bakery",
    x: 1479,
    y: 762,
    scale: 0.7,
    duration: 120,
  },
  {
    id: "lavender-terrace",
    minutes: 2700,
    label: "Lavender terrace",
    kind: "lavender",
    x: 88,
    y: 389,
    scale: 0.75,
    duration: 150,
  },
  {
    id: "picnic",
    minutes: 2880,
    label: "Picnic garden",
    kind: "picnic",
    x: 1021,
    y: 869,
    scale: 0.8,
    duration: 120,
  },
  {
    id: "rabbit-garden",
    minutes: 3060,
    label: "Rabbit garden",
    kind: "rabbits",
    x: 231,
    y: 941,
    scale: 0.8,
    duration: 90,
  },
  {
    id: "cottage-porch",
    minutes: 3240,
    label: "Climbing rose porch",
    kind: "porch",
    x: 323,
    y: 609,
    scale: 0.65,
    duration: 135,
  },
  {
    id: "stargazing",
    minutes: 3420,
    label: "Stargazing nook",
    kind: "telescope",
    x: 1458,
    y: 425,
    scale: 0.65,
    duration: 120,
  },
  {
    id: "apple-grove",
    minutes: 3600,
    label: "Apple grove",
    kind: "orchard",
    x: 378,
    y: 353,
    scale: 0.7,
    duration: 180,
  },
  {
    id: "garden-table",
    minutes: 3960,
    label: "Garden supper table",
    kind: "table",
    x: 771,
    y: 898,
    scale: 0.9,
    duration: 150,
  },
  {
    id: "pottery-studio",
    minutes: 4320,
    label: "Pottery studio",
    kind: "studio",
    x: 1110,
    y: 347,
    scale: 0.62,
    duration: 180,
  },
  {
    id: "stone-steps",
    minutes: 4680,
    label: "Hillside stone steps",
    kind: "steps",
    x: 570,
    y: 359,
    scale: 0.8,
    duration: 150,
  },
  {
    id: "swing",
    minutes: 5040,
    label: "Garden swing",
    kind: "swing",
    x: 73,
    y: 861,
    scale: 0.7,
    duration: 120,
  },
  {
    id: "fountain",
    minutes: 5400,
    label: "Courtyard fountain",
    kind: "fountain",
    x: 933,
    y: 548,
    scale: 0.7,
    duration: 180,
  },
  {
    id: "flower-cart",
    minutes: 5760,
    label: "Flower cart",
    kind: "cart",
    x: 1492,
    y: 934,
    scale: 0.8,
    duration: 135,
  },
  {
    id: "hill-bakery",
    minutes: 6120,
    label: "Hillside bakery",
    kind: "studio",
    x: 1314,
    y: 333,
    scale: 0.6,
    duration: 180,
  },
  {
    id: "conservatory",
    minutes: 6480,
    label: "Flower conservatory",
    kind: "conservatory",
    x: 223,
    y: 381,
    scale: 0.64,
    duration: 180,
  },
  {
    id: "stream-steps",
    minutes: 6840,
    label: "Stream stepping stones",
    kind: "steps",
    x: 1237,
    y: 918,
    scale: 0.7,
    duration: 150,
  },
  {
    id: "lantern-walk",
    minutes: 7200,
    label: "Lantern walk",
    kind: "lanterns",
    x: 625,
    y: 828,
    scale: 1,
    duration: 150,
  },
  {
    id: "reading-pergola",
    minutes: 7560,
    label: "Reading pergola",
    kind: "pergola",
    x: 964,
    y: 952,
    scale: 0.8,
    duration: 180,
  },
  {
    id: "rose-pavilion",
    minutes: 7920,
    label: "Rose pavilion",
    kind: "gazebo",
    x: 553,
    y: 940,
    scale: 0.7,
    duration: 180,
  },
  {
    id: "herb-courtyard",
    minutes: 8280,
    label: "Herb courtyard",
    kind: "herbs",
    x: 1540,
    y: 491,
    scale: 0.55,
    duration: 150,
  },
  {
    id: "village-bunting",
    minutes: 8460,
    label: "Village bunting",
    kind: "lanterns",
    x: 464,
    y: 563,
    scale: 0.8,
    duration: 180,
  },
];

export const GARDEN_BED_COUNT = 64;
export const GARDEN_BED_INTERVAL = 135;
export const GARDEN_BED_DURATION = 180;
export interface GardenBed {
  id: number;
  x: number;
  y: number;
  age: number;
  growth: number;
}
function reserved(x: number, y: number) {
  return (
    (x > 1090 && x < 1395) ||
    (y < 800 && ((x > 510 && x < 780) || (x > 840 && x < 980))) ||
    (x < 300 && y > 680 && y < 800) ||
    (x > 300 && x < 485 && y > 815 && y < 910) ||
    (x > 930 && x < 1090 && y > 810 && y < 925) ||
    (x > 680 && x < 875 && y > 850)
  );
}
export function gardenBeds(minutes: number, seed: number): GardenBed[] {
  const candidates = Array.from({ length: 144 }, (_, i) => ({
    x: 40 + (i % 18) * 88 + noise(i + 800, seed) * 20,
    y: 660 + Math.floor(i / 18) * 43 + noise(i + 900, seed) * 12,
  })).filter((p) => !reserved(p.x, p.y));
  // Stable locations: previews and reloads never shuffle earned growth.
  candidates.sort((a, b) => noise(a.x + a.y, seed) - noise(b.x + b.y, seed));
  return candidates.slice(0, GARDEN_BED_COUNT).flatMap((p, i) => {
    const age = minutes - (5 + i * GARDEN_BED_INTERVAL);
    return age <= 0
      ? []
      : [{ id: i, ...p, age, growth: clamp(age / GARDEN_BED_DURATION) }];
  });
}

export function projectProgress(
  minutes: number,
  project: GardenProject,
): number {
  return clamp((minutes - project.minutes) / project.duration);
}
