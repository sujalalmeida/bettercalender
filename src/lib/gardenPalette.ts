export type Season = "Spring" | "Summer";
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const progress = (minute: number, start: number, duration = 30) =>
  clamp((minute - start) / duration);
export const noise = (n: number, seed: number) => {
  const v = Math.sin(n * 127.1 + seed * 0.013) * 43758.5453;
  return v - Math.floor(v);
};
export const mix = (a: string, b: string, t: number) => {
  const channels = [1, 3, 5].map((i) =>
    Math.round(
      parseInt(a.slice(i, i + 2), 16) * (1 - t) +
        parseInt(b.slice(i, i + 2), 16) * t,
    ),
  );
  return `rgb(${channels.join(",")})`;
};
export const palettes = {
  Spring: {
    sky: "#a6dff5",
    far: "#9fd17b",
    hill: "#8fc66b",
    field: "#80bc5c",
    front: "#6ca84e",
    leaf: "#3f824b",
    light: "#7bb653",
  },
  Summer: {
    sky: "#95d7f4",
    far: "#a1cf72",
    hill: "#8ac160",
    field: "#7ab451",
    front: "#659f44",
    leaf: "#367e47",
    light: "#75ae4d",
  },
};
