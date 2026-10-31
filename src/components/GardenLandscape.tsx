import { gardenStage } from "../lib/gardenState";

type Season = "Spring" | "Summer" | "Autumn" | "Winter";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const progress = (minute: number, start: number, duration = 30) =>
  clamp((minute - start) / duration);
const noise = (n: number, seed: number) => {
  const v = Math.sin(n * 127.1 + seed * 0.013) * 43758.5453;
  return v - Math.floor(v);
};
const mix = (a: string, b: string, t: number) => {
  const channels = [1, 3, 5].map((i) =>
    Math.round(
      parseInt(a.slice(i, i + 2), 16) * (1 - t) +
        parseInt(b.slice(i, i + 2), 16) * t,
    ),
  );
  return `rgb(${channels.join(",")})`;
};
const palettes = {
  Spring: {
    sky: "#b4d4d6",
    far: "#a4b7a4",
    hill: "#83a482",
    field: "#719269",
    front: "#5c8154",
    leaf: "#57744f",
    light: "#8fa76c",
  },
  Summer: {
    sky: "#acd0d9",
    far: "#94ad9a",
    hill: "#73996f",
    field: "#6b8d55",
    front: "#4f7447",
    leaf: "#46683e",
    light: "#86a459",
  },
  Autumn: {
    sky: "#d8c9b8",
    far: "#b0ad8c",
    hill: "#a6a06e",
    field: "#9d9259",
    front: "#7b7e4b",
    leaf: "#9c6b43",
    light: "#c49a55",
  },
  Winter: {
    sky: "#ccd8dc",
    far: "#b2c4c4",
    hill: "#a0b4ac",
    field: "#bfc8b6",
    front: "#a4b5a0",
    leaf: "#778b7d",
    light: "#e0e4d6",
  },
};
function Blossom({ kind, color }: { kind: number; color: string }) {
  if (kind === 0 || kind === 1)
    return (
      <g>
        <circle r="8" fill={color} />
        <path
          d="M-6 0Q-5-8 1-5Q8-3 5 3Q1 9-4 4Q-6 0-1-1Q3-2 2 2"
          fill="none"
          stroke={kind === 0 ? "#c3bba4" : "#943e4c"}
          stroke-width="1"
        />
        <path
          d="M-8 3L-2 8L4 5"
          fill="none"
          stroke={kind === 0 ? "#d4cdbb" : "#b15260"}
          stroke-width="1"
        />
      </g>
    );
  if (kind === 2)
    return (
      <g>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse
            rx="3"
            ry="10"
            cy="-6"
            fill="#f7eee0"
            stroke="#d9cbb4"
            stroke-width=".45"
            transform={`rotate(${a})`}
          />
        ))}
        <circle r="2.7" fill="#c6a254" />
      </g>
    );
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          rx="3.7"
          ry="6"
          cy="-4"
          fill={color}
          transform={`rotate(${a})`}
        />
      ))}
      <circle r="2.6" fill="#c2a263" />
    </g>
  );
}
function Flowers({
  minutes,
  seed,
  season,
  night,
}: {
  minutes: number;
  seed: number;
  season: Season;
  night: number;
}) {
  const total = Math.max(0, Math.floor((minutes - 0.25) / 0.75)),
    count = Math.min(420, total);
  const plants = Array.from({ length: count }, (_, i) => {
    let x = 45 + noise(i * 5, seed) * 1510,
      y = 550 + noise(i * 5 + 1, seed) * 425;
    // Keep the stream, cottage plots and footpaths clear.
    if (x > 1080 && x < 1385) x = 70 + noise(i * 5 + 2, seed) * 950;
    if (y < 725 && (x < 505 || x > 1360 || (x > 650 && x < 940)))
      y = 770 + noise(i * 5 + 3, seed) * 200;
    const age = minutes - (0.25 + i * 0.75),
      growth = clamp(age / 1.4),
      mature = 1 + clamp(age / 150) * 0.45;
    return { x, y, i, growth, mature };
  }).sort((a, b) => a.y - b.y);
  return (
    <g opacity={1 - night * 0.32}>
      {plants.map((p) => {
        const depth = 0.35 + (p.y - 550) / 600,
          h = (20 + noise(p.i + 330, seed) * 35) * p.growth * p.mature;
        const kind = p.i % 6,
          color =
            kind === 0
              ? "#f4eee3"
              : kind === 1
                ? "#c56372"
                : kind === 3
                  ? "#d9bd75"
                  : kind === 4
                    ? "#a7a0bd"
                    : "#dfb0ba";
        return (
          <g transform={`translate(${p.x} ${p.y}) scale(${depth})`}>
            <ellipse cy="3" rx="12" ry="3" fill="#344c33" opacity=".15" />
            <path
              d={`M0 0Q${p.i % 2 ? 6 : -6} ${-h * 0.5} 0 ${-h}`}
              fill="none"
              stroke={season === "Winter" ? "#7e947f" : "#3c653f"}
              stroke-width="2"
            />
            {p.growth > 0.3 && (
              <path
                d={`M0 ${-h * 0.35}Q16 ${-h * 0.7} 19 ${-h * 0.4}Q6 ${-h * 0.2} 0 ${-h * 0.35}M0 ${-h * 0.6}Q-15 ${-h * 0.9}-17 ${-h * 0.6}Q-5 ${-h * 0.4} 0 ${-h * 0.6}`}
                fill={season === "Winter" ? "#b3bfaa" : "#5c824d"}
              />
            )}
            {p.growth > 0.5 && (
              <g
                class={p.i % 19 === 0 ? "garden-flower-sway" : ""}
                style={{ "--sway-delay": `${-noise(p.i, seed) * 8}s` }}
              >
                <g
                  transform={`translate(0 ${-h}) scale(${clamp((p.growth - 0.5) * 2)})`}
                >
                  <Blossom kind={kind % 4} color={color} />
                </g>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
function Tree({
  x,
  y,
  scale,
  season,
  night,
  fruit = false,
  pine = false,
}: {
  x: number;
  y: number;
  scale: number;
  season: Season;
  night: number;
  fruit?: boolean;
  pine?: boolean;
}) {
  const palette = palettes[season],
    leaf = mix(palette.leaf, "#263d3c", night * 0.7),
    light = mix(palette.light, "#304744", night * 0.65);
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cy="8" rx="55" ry="13" fill="#344831" opacity=".16" />
      <path
        d="M-8 0L-5-97L8-97L10 0Z"
        fill={mix("#796348", "#353b34", night * 0.7)}
      />
      <path
        d="M1-40L-27-79M3-63L30-102M1-88L-17-117"
        fill="none"
        stroke="#796348"
        stroke-width="7"
      />
      {pine ? (
        <g>
          <path
            d="M0-185L-51-90H-30L-68-45H-43L-78-12H78L43-45H68L30-90H51Z"
            fill={leaf}
          />
          <path
            d="M0-185L-25-129H21L0-151ZM-29-89L-45-66H38L22-89Z"
            fill={season === "Winter" ? "#e3e7da" : light}
          />
        </g>
      ) : (
        <g>
          <path
            d="M-3-177C-36-181-47-159-45-142C-83-139-84-108-62-95C-84-67-45-40-21-55C1-29 30-43 35-59C71-44 89-82 66-101C86-130 57-152 35-145C40-173 13-188-3-177Z"
            fill={leaf}
          />
          <path
            d="M-37-151Q-61-133-49-115Q-77-103-49-84Q-31-79-20-94Q3-70 21-88Q47-82 54-109Q37-125 15-113Q12-151-8-155Z"
            fill={light}
            opacity=".7"
          />
          {season === "Winter" && (
            <path
              d="M-43-142Q-50-169-19-175Q4-185 27-169L31-151Q12-165-6-155Q-22-166-43-142"
              fill="#e5e8dc"
            />
          )}
          {fruit &&
            [-38, -10, 24, 46].map((cx, i) => (
              <circle
                cx={cx}
                cy={-100 - (i % 2) * 34}
                r="5"
                fill={season === "Spring" ? "#e2b9bf" : "#c28555"}
              />
            ))}
        </g>
      )}
    </g>
  );
}
function Cottage({
  x,
  y,
  scale = 1,
  build,
  night,
  variant = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  build: number;
  night: number;
  variant?: number;
}) {
  if (build <= 0) return null;
  const wall =
      variant === 1 ? "#d2c5a3" : variant === 2 ? "#b6c0aa" : "#e0cfaf",
    roof = variant === 1 ? "#7c6251" : "#84614f";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="9" rx="116" ry="23" fill="#33482f" opacity=".2" />
      <path d="M-95 4L92 4L108 14L-109 14Z" fill="#a6a18b" />
      <g opacity={clamp(build * 4)}>
        <path
          d="M-84 2V-104H80V2"
          fill={build > 0.23 ? mix(wall, "#62685b", night * 0.6) : "none"}
          stroke="#8d8168"
          stroke-width="3"
        />
        {build < 0.7 && (
          <g stroke="#b09b74" fill="none" stroke-width="3">
            <path d="M-111 0V-139H110V0M-111-90H110M-111-50H110M-111 0L110-139M110 0L-111-139" />
          </g>
        )}
      </g>
      {build > 0.35 && (
        <g opacity={clamp((build - 0.35) * 5)}>
          <path
            d="M53-120V-177H75V-105"
            fill="#a0947e"
            stroke="#807968"
            stroke-width="2"
          />
          <path d="M49-177H80V-168H49Z" fill="#777364" />
          <path
            d="M-116-102L-6-182L111-102L93-92L-7-155L-101-90Z"
            fill={mix(roof, "#3c4240", night * 0.65)}
            stroke="#625542"
            stroke-width="3"
          />
          <path
            d="M-103-105L-7-171L96-103M-82-107L-7-159L77-108"
            stroke="#ab8770"
            fill="none"
            stroke-width="2"
            opacity=".6"
          />
          {Array.from({ length: 9 }, (_, i) => (
            <path
              d={`M${-95 + i * 22} -108l-7 8`}
              stroke="#594c41"
              stroke-width="2"
              opacity=".35"
            />
          ))}
        </g>
      )}
      {build > 0.65 && (
        <g opacity={clamp((build - 0.65) * 4)}>
          <path
            d="M-21 2V-63Q-21-80 0-81Q21-80 21-63V2Z"
            fill={mix("#786b50", "#313b38", night * 0.5)}
            stroke="#8f8367"
            stroke-width="4"
          />
          <circle cx="11" cy="-36" r="2" fill="#d4b371" />
          {[-59, 52].map((cx) => (
            <g>
              <rect
                x={cx - 15}
                y="-80"
                width="30"
                height="37"
                rx="2"
                fill={night > 0.3 ? "#e7c588" : "#aebfba"}
                stroke="#7b765d"
                stroke-width="5"
              />
              <path
                d={`M${cx}-80v37M${cx - 15}-63h30`}
                stroke="#7b765d"
                stroke-width="2.5"
              />
              {night > 0.3 && (
                <ellipse
                  cx={cx}
                  cy="-61"
                  rx="23"
                  ry="27"
                  fill="#f4d799"
                  opacity={night * 0.1}
                  class="garden-window-glow"
                />
              )}
              <rect x={cx - 23} y="-83" width="8" height="43" fill="#708065" />
              <rect x={cx + 15} y="-83" width="8" height="43" fill="#708065" />
            </g>
          ))}
          <path d="M-12 7L-23 26H28L14 7" fill="#c0b49a" />
          <path
            d="M-86-1Q-110-45-86-78M77 0Q105-26 88-65"
            fill="none"
            stroke="#6e8056"
            stroke-width="5"
          />
          {[-86, 83].map((cx) => (
            <g>
              <ellipse cx={cx} cy="-20" rx="16" ry="23" fill="#698057" />
              <circle cx={cx - 4} cy="-34" r="4" fill="#d99aa0" />
              <circle cx={cx + 7} cy="-20" r="5" fill="#c67f89" />
            </g>
          ))}
          <path
            d="M-70 0V17M-104 1V18M-116 7H-50M68 0V17M110 0V19M55 7H118"
            stroke="#b1a588"
            stroke-width="4"
          />
          {night > 0.35 && (
            <g opacity={night}>
              <circle cx="-33" cy="-45" r="5" fill="#efd59e" />
              <path d="M-33-58v6" stroke="#766c53" stroke-width="2" />
            </g>
          )}
        </g>
      )}
      {build >= 1 && (
        <g class="garden-chimney-smoke" opacity=".2">
          <path
            d="M65-182Q42-205 61-220Q79-236 58-253"
            fill="none"
            stroke="#e7e6d8"
            stroke-width="9"
            stroke-linecap="round"
          />
        </g>
      )}
    </g>
  );
}
function Villager({
  x,
  y,
  seed,
  working = false,
}: {
  x: number;
  y: number;
  seed: number;
  working?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        class={working ? "garden-worker" : "garden-walker"}
        style={{ "--walk-delay": `${-seed % 21}s` }}
      >
        <ellipse cy="4" rx="10" ry="3" fill="#35452e" opacity=".2" />
        <path
          d="M-3-11L-5 1M3-11L6 1"
          stroke="#665b49"
          stroke-width="3"
          class="garden-villager-legs"
        />
        <path
          d="M-6-26L-8-10H7L6-26Z"
          fill={seed % 2 ? "#a47769" : "#7b8970"}
        />
        <path
          d="M-5-23L-12-12M6-23L14-18"
          stroke="#b8a080"
          stroke-width="3"
          stroke-linecap="round"
          class={working ? "garden-working-arm" : ""}
        />
        <circle cy="-33" r="6" fill="#c6ab88" />
        <path d="M-8-36Q-7-45 2-42Q8-40 7-35L12-34H-11Z" fill="#b7a47b" />
        {working && (
          <path
            d="M12-26L17-10M11-28L18-30L20-25L13-23"
            stroke="#76664d"
            stroke-width="2"
          />
        )}
      </g>
    </g>
  );
}
function Farm({
  x,
  y,
  progress: grow,
  season,
}: {
  x: number;
  y: number;
  progress: number;
  season: Season;
}) {
  if (grow <= 0) return null;
  return (
    <g transform={`translate(${x} ${y})`} opacity={grow}>
      <path
        d="M-100 0L62-24L119 47L-47 77Z"
        fill="#806d4c"
        stroke="#b7a47b"
        stroke-width="5"
      />
      {[0, 1, 2, 3].map((row) => (
        <g>
          {Array.from({ length: 7 }, (_, i) => {
            const x = -73 + i * 21 + row * 13,
              y = 8 + row * 15 - i * 3;
            return (
              <g transform={`translate(${x} ${y})`}>
                <path
                  d="M0 7L0-7M0 1Q-12-12-12-2Q-9 5 0 3M0-2Q11-17 13-7Q12 0 0 1"
                  stroke={season === "Winter" ? "#acb5a0" : "#4c733e"}
                  fill={season === "Winter" ? "#c9d0be" : "#6c9651"}
                  stroke-width="1.7"
                />
                {season === "Autumn" && i % 3 === 0 && (
                  <ellipse cy="5" rx="7" ry="5" fill="#b78a4d" />
                )}
              </g>
            );
          })}
        </g>
      ))}
      <path
        d="M-113-3V-24M-30-16V-37M55-29V-50M-113-18L55-43"
        stroke="#b3a27d"
        stroke-width="4"
      />
    </g>
  );
}

export function GardenLandscape({
  elapsedMs,
  seed,
  motion,
}: {
  elapsedMs: number;
  seed: number;
  motion: boolean;
}) {
  const stage = gardenStage(elapsedMs),
    { minutes, season, night } = stage,
    p = palettes[season];
  const sky = mix(p.sky, "#23374c", night),
    field = mix(p.field, "#354b41", night * 0.84),
    front = mix(p.front, "#2c4339", night * 0.8);
  const stream = progress(minutes, 45, 10),
    cottage = progress(minutes, 90, 40),
    second = progress(minutes, 300, 45);
  const cottageLibrary = progress(minutes, 1440, 60);
  return (
    <svg
      class={`garden-landscape ${motion ? "" : "garden-still"}`}
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${season.toLowerCase()} cottage garden, ${stage.phase.toLowerCase()}, ${stage.flowers} blooms grown${stream ? ", a flowing stream" : ""}${cottage ? ", cottages" : ""}${minutes >= 60 ? ", garden keepers" : ""}`}
    >
      <defs>
        <pattern
          id="garden-meadow-specks"
          width={Math.max(30, 110 - stage.meadowLevel * 6)}
          height="55"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M12 44l-2-10m2 10l4-14M63 51l-3-10m3 10l5-9"
            stroke="#aac296"
            stroke-width="1.3"
            opacity=".34"
          />
          {stage.meadowLevel > 0 && (
            <g opacity=".7">
              <circle cx="14" cy="28" r="2" fill="#ead9b4" />
              <circle cx="66" cy="39" r="2" fill="#d4a0ac" />
            </g>
          )}
        </pattern>
        <clipPath id="garden-field-clip">
          <path d="M0 500Q350 390 700 510T1600 455V1000H0Z" />
        </clipPath>
      </defs>
      <rect width="1600" height="1000" fill={sky} class="garden-sky" />
      <g opacity={night * 0.85}>
        {Array.from({ length: 45 }, (_, i) => (
          <circle
            class="garden-star"
            style={{ animationDelay: `${-noise(i, seed) * 8}s` }}
            cx={30 + noise(i, seed) * 1540}
            cy={25 + noise(i + 70, seed) * 260}
            r={i % 4 === 0 ? 1.7 : 0.9}
            fill="#f2ead4"
          />
        ))}
      </g>
      <g
        class="garden-sun"
        opacity={1 - night}
        transform={`translate(${220 + stage.dayProgress * 1120} ${130 - Math.sin(stage.dayProgress * Math.PI) * 60})`}
      >
        <circle r="65" fill="#f1e2b2" opacity=".12" />
        <circle r="43" fill="#eee1b9" />
      </g>
      <g
        opacity={night}
        transform={`translate(${1130 - stage.dayProgress * 400} 117)`}
      >
        <circle r="32" fill="#f1ead3" />
        <circle cx="12" cy="-9" r="27" fill={sky} />
      </g>
      <g class="garden-clouds" opacity={0.65 - night * 0.4}>
        <path
          d="M61 174C77 149 92 150 104 156C111 119 153 122 167 152C197 142 224 161 217 177Z"
          fill="#f3efdc"
        />
        <path
          d="M774 113C790 94 806 96 816 102C826 75 853 77 863 103C885 95 908 108 906 116Z"
          fill="#f1eddf"
        />
        <path
          d="M1338 218C1355 197 1372 197 1387 204C1400 171 1441 174 1451 204C1486 197 1503 217 1500 225Z"
          fill="#f1eddf"
        />
      </g>
      <path
        d="M0 359L160 233L262 312L407 178L548 295L671 222L838 329L1019 184L1170 293L1371 196L1600 335V650H0Z"
        fill={mix(p.far, "#314858", night * 0.8)}
      />
      <path
        d="M347 233L407 178L466 243L420 226L404 241L387 221Z M965 236L1019 184L1076 237L1037 224L1017 237L997 221Z M1321 240L1371 196L1433 248L1382 228L1366 240L1347 226Z"
        fill={mix("#e3e3d3", "#8c9da1", night * 0.8)}
        opacity=".65"
      />
      <path
        d="M0 408Q218 292 435 377T862 355T1251 375T1600 340V1000H0Z"
        fill={mix(p.hill, "#314e49", night * 0.8)}
      />
      {Array.from({ length: 18 }, (_, i) => (
        <Tree
          x={i * 98 - 30}
          y={430 + noise(i, seed) * 45}
          scale={0.34 + noise(i + 40, seed) * 0.22}
          season={season}
          night={night}
          pine={i % 3 !== 0}
        />
      ))}
      <path d="M0 530Q350 395 700 510T1600 455V1000H0Z" fill={field} />
      <path d="M0 788Q440 646 812 778T1600 721V1000H0Z" fill={front} />
      <rect
        y="400"
        width="1600"
        height="600"
        fill="url(#garden-meadow-specks)"
        clip-path="url(#garden-field-clip)"
      />
      {stream > 0 && (
        <g opacity={stream}>
          <path
            d="M1240 365C1090 441 1385 462 1265 565C1140 676 1128 698 1206 790C1272 879 1127 931 1088 1000H1288C1312 926 1410 864 1338 781C1210 659 1293 651 1370 565C1486 435 1194 431 1280 365Z"
            fill={mix("#b1c6b7", "#506d71", night * 0.7)}
          />
          <path
            d="M1258 370C1150 448 1429 460 1310 565C1193 677 1197 717 1271 792C1336 874 1201 947 1186 1010"
            fill="none"
            stroke={mix("#8cbbc2", "#466570", night * 0.7)}
            stroke-width="67"
          />
          <g
            class="garden-water-flow"
            fill="none"
            stroke={mix("#d4e3d5", "#8da4a3", night * 0.65)}
            stroke-width="2.5"
            opacity=".6"
            stroke-dasharray="18 53 8 37"
          >
            <path d="M1258 376C1150 448 1429 460 1310 565C1193 677 1197 717 1271 792C1336 874 1201 947 1186 1000" />
            <path d="M1265 405C1283 456 1403 478 1331 559C1238 665 1204 696 1287 801C1354 883 1221 941 1210 1000" />
          </g>
          {Array.from({ length: 14 }, (_, i) => (
            <ellipse
              cx={i < 7 ? 1102 + i * 16 : 1305 + (i - 7) * 14}
              cy={813 + (i % 7) * 24}
              rx={7 + (i % 3) * 3}
              ry={4 + (i % 2) * 2}
              fill={mix("#939d8b", "#58665d", night * 0.7)}
            />
          ))}
        </g>
      )}
      {minutes >= 30 && (
        <path
          d="M292 582Q473 611 598 664Q765 738 1058 728L1105 763Q771 795 572 703Q437 643 271 625Z"
          fill={mix("#b6a885", "#727460", night * 0.7)}
          opacity={progress(minutes, 30, 30) * 0.75}
        />
      )}
      {minutes >= 75 &&
        (minutes < 960 ? (
          <g opacity={progress(minutes, 75, 20)}>
            <path
              d="M1144 649Q1238 611 1337 639L1342 671Q1241 643 1139 682Z"
              fill="#9d8867"
              stroke="#776f54"
              stroke-width="3"
            />
            {Array.from({ length: 10 }, (_, i) => (
              <path
                d={`M${1151 + i * 19} ${645 - Math.sin((i / 9) * Math.PI) * 14}l-4 30`}
                stroke="#c0a887"
                stroke-width="2"
              />
            ))}
            <path
              d="M1142 644V612M1184 631V599M1232 626V594M1283 629V597M1337 641V609M1142 615Q1234 577 1337 612"
              fill="none"
              stroke="#9d8867"
              stroke-width="5"
            />
          </g>
        ) : (
          <g>
            <path
              d="M1139 648Q1237 580 1344 635L1348 695H1312Q1240 613 1171 706H1134Z"
              fill={mix("#aaa68e", "#65736b", night * 0.7)}
              stroke="#7b806d"
              stroke-width="3"
            />
            <path
              d="M1139 640Q1237 576 1344 628L1345 646Q1243 593 1137 660Z"
              fill={mix("#d0c7a9", "#839388", night * 0.65)}
            />
            {Array.from({ length: 9 }, (_, i) => (
              <path
                d={`M${1148 + i * 23} ${640 - Math.sin((i / 8) * Math.PI) * 33}l3 23`}
                stroke="#7c826f"
                stroke-width="2"
              />
            ))}
            <path
              d="M1137 663l35-8m136-7l36 12M1137 685l24-9m162-5l22 8"
              stroke="#89917b"
              stroke-width="2"
            />
          </g>
        ))}
      {minutes >= 20 && (
        <g>
          {[110, 575, 1000, 1515].map((x, i) => (
            <Tree
              x={x}
              y={i % 2 ? 592 : 674}
              scale={progress(minutes, 20 + i * 10, 150) * (0.75 + i * 0.12)}
              season={season}
              night={night}
              pine={i === 3}
            />
          ))}
          {minutes >= 240 &&
            [650, 800, 957].map((x, i) => (
              <Tree
                x={x}
                y={495 + i * 9}
                scale={progress(minutes, 240 + i * 15, 90) * 0.65}
                season={season}
                night={night}
                fruit
              />
            ))}
        </g>
      )}
      <Cottage x={326} y={590} build={cottage} night={night} />
      <Cottage
        x={1455}
        y={600}
        scale={0.75}
        build={second}
        night={night}
        variant={1}
      />
      {minutes >= 480 && (
        <g transform="translate(775 554)" opacity={progress(minutes, 480, 45)}>
          <path
            d="M-72 0V-63L0-105L73-63V0Z"
            fill={mix("#b6ccc0", "#516d65", night * 0.6)}
            stroke="#a6ad91"
            stroke-width="4"
          />
          <path
            d="M-72-63H73M0-105V0M-35-83V0M35-83V0M-72-31H73"
            stroke="#e0d9ba"
            stroke-width="3"
          />
          <path
            d="M-15 0V-55H15V0"
            fill="#798c70"
            stroke="#c6c3a7"
            stroke-width="3"
          />
          <path
            d="M-64 0V-20M-35 0V-25M35 0V-25M64 0V-18"
            stroke="#56734e"
            stroke-width="6"
          />
        </g>
      )}
      {minutes >= 600 && (
        <g transform="translate(1030 430)" opacity={progress(minutes, 600, 45)}>
          <path
            d="M-28 0L-17-103H17L29 0Z"
            fill={mix("#cfbea0", "#737867", night * 0.7)}
          />
          <path d="M-24-102L0-135L24-102Z" fill="#7e6652" />
          <g class="garden-windmill">
            <path
              d="M0-72V-165M0-72V21M0-72H-93M0-72H93"
              stroke="#947c5d"
              stroke-width="4"
            />
            <path
              d="M0-88L12-155L-1-155M16-72L83-60V-73M0-56L-12 11H1M-16-72L-83-84V-71"
              fill="#c8b99b"
              stroke="#8d795d"
              stroke-width="2"
            />
          </g>
        </g>
      )}
      <Cottage
        x={644}
        y={750}
        scale={0.8}
        build={cottageLibrary}
        night={night}
        variant={2}
      />
      <Farm
        x={562}
        y={555}
        progress={progress(minutes, 120, 30)}
        season={season}
      />
      {minutes >= 150 && (
        <g transform="translate(904 765)" opacity={progress(minutes, 150, 12)}>
          <ellipse cy="3" rx="35" ry="13" fill="#6b6d54" />
          {Array.from({ length: 9 }, (_, i) => (
            <ellipse
              cx={Math.cos((i / 9) * Math.PI * 2) * 31}
              cy={Math.sin((i / 9) * Math.PI * 2) * 11}
              rx="7"
              ry="4"
              fill="#a5a38a"
            />
          ))}
          <path d="M-18 2L19-6M-17-6L18 3" stroke="#72573c" stroke-width="7" />
          {night > 0.2 && (
            <ellipse
              cy="-5"
              rx="60"
              ry="30"
              fill="#e3b66e"
              opacity={night * 0.12}
            />
          )}
          <g class="garden-campfire">
            <path
              d="M-13-3Q-23-20-6-32Q-2-41-3-48Q18-31 9-21Q24-13 15-2Z"
              fill="#d89b53"
            />
            <path d="M-6-4Q-13-14 0-28Q11-15 6-3Z" fill="#edd28c" />
          </g>
          <path
            d="M-49 16L-48-2M-64 12L-48-6L-33 10"
            stroke="#8f7958"
            stroke-width="4"
          />
          <path
            d="M40 6L50 24M50 6L61 24M37 6H65"
            stroke="#8d7757"
            stroke-width="5"
          />
        </g>
      )}
      {minutes >= 60 && (
        <g>
          <Villager x={440} y={637} seed={seed} working={cottage < 1} />
          <Villager x={610} y={616} seed={seed + 1} working={minutes >= 120} />
          {minutes >= 180 && <Villager x={1005} y={748} seed={seed + 2} />}
          {minutes >= 300 && (
            <Villager x={1403} y={657} seed={seed + 3} working={second < 1} />
          )}
        </g>
      )}
      <Flowers minutes={minutes} seed={seed} season={season} night={night} />
      {minutes >= 120 && (
        <g class="garden-butterflies" opacity={1 - night}>
          {[0, 1, 2].map((i) => (
            <g transform={`translate(${680 + i * 140} ${660 + i * 32})`}>
              <path
                d="M0 0Q-13-15-12-4Q-9 5 0 0Q12-16 12-4Q8 7 0 0"
                fill={i % 2 ? "#d9bd9a" : "#deb7ba"}
              />
              <path d="M0-2v9" stroke="#645f48" stroke-width="1" />
            </g>
          ))}
        </g>
      )}
      {night > 0.25 && minutes >= 150 && (
        <g>
          {Array.from({ length: 18 }, (_, i) => (
            <circle
              class="garden-firefly"
              style={{ animationDelay: `${-noise(i, seed) * 8}s` }}
              cx={120 + noise(i, seed) * 1320}
              cy={570 + noise(i + 44, seed) * 350}
              r="1.8"
              fill="#e3d7a0"
              opacity={night * 0.7}
            />
          ))}
        </g>
      )}
      {season === "Winter" && (
        <g opacity=".6">
          {Array.from({ length: 45 }, (_, i) => (
            <circle
              class="garden-snow"
              style={{ animationDelay: `${-i % 20}s` }}
              cx={noise(i + 260, seed) * 1600}
              cy={noise(i + 80, seed) * 950}
              r={1.2 + (i % 3) * 0.5}
              fill="#f3f3e8"
            />
          ))}
        </g>
      )}
    </svg>
  );
}
