import {
  clamp,
  noise,
  mix,
  palettes,
  type Season,
} from "../../lib/gardenPalette";

export function Blossom({ kind, color }: { kind: number; color: string }) {
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
export function Flowers({
  minutes,
  seed,
  night,
}: {
  minutes: number;
  seed: number;
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
    <g opacity={1 - night * 0.12}>
      {plants.map((p) => {
        const depth = 0.35 + (p.y - 550) / 600,
          h = (20 + noise(p.i + 330, seed) * 35) * p.growth * p.mature;
        const kind = p.i % 6,
          color =
            kind === 0
              ? "#fff9ed"
              : kind === 1
                ? "#d94b60"
                : kind === 3
                  ? "#d9bd75"
                  : kind === 4
                    ? "#a7a0bd"
                    : "#dfb0ba";
        return (
          <g key={p.i} transform={`translate(${p.x} ${p.y}) scale(${depth})`}>
            <ellipse cy="3" rx="12" ry="3" fill="#344c33" opacity=".15" />
            <g
              class={p.i % 19 === 0 ? "garden-flower-sway" : ""}
              style={{ "--sway-delay": `${-noise(p.i, seed) * 8}s` }}
            >
              <path
                d={`M0 0Q${p.i % 2 ? 6 : -6} ${-h * 0.5} 0 ${-h}`}
                fill="none"
                stroke={"#367d42"}
                stroke-width="2"
              />
              {p.growth > 0.3 && (
                <path
                  d={`M0 ${-h * 0.35}Q16 ${-h * 0.7} 19 ${-h * 0.4}Q6 ${-h * 0.2} 0 ${-h * 0.35}M0 ${-h * 0.6}Q-15 ${-h * 0.9}-17 ${-h * 0.6}Q-5 ${-h * 0.4} 0 ${-h * 0.6}`}
                  fill={"#63a44c"}
                />
              )}
              {p.growth > 0.5 && (
                <g
                  transform={`translate(0 ${-h}) scale(${clamp((p.growth - 0.5) * 2)})`}
                >
                  <Blossom kind={kind % 4} color={color} />
                </g>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}
export function Tree({
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
    <g data-garden-tree="" transform={`translate(${x} ${y}) scale(${scale})`}>
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
            fill={light}
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
export function Cottage({
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
export function Villager({
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
export function Farm({
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
                  stroke={"#4c733e"}
                  fill={"#73a858"}
                  stroke-width="1.7"
                />
                {season === "Summer" && i % 3 === 0 && (
                  <ellipse cy="5" rx="7" ry="5" fill="#d96952" />
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
