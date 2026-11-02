import { gardenBeds } from "../../lib/gardenGrowth";
import { clamp, noise } from "../../lib/gardenPalette";

export function GardenFlowerSymbols() {
  return (
    <>
      <g id="garden-bloom-white">
        <circle r="5" fill="#fff8e6" />
        <path
          d="M-4 0Q-3-5 1-3Q6 0 2 3Q-2 5-2 0Q0-2 2 0"
          fill="none"
          stroke="#c3b589"
          stroke-width=".6"
        />
      </g>
      <g id="garden-bloom-red">
        <circle r="5" fill="#db5169" />
        <path
          d="M-4 0Q-3-5 1-3Q6 0 2 3Q-2 5-2 0Q0-2 2 0"
          fill="none"
          stroke="#a12f48"
          stroke-width=".7"
        />
      </g>
      <g id="garden-bloom-lily">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse
            key={a}
            rx="2"
            ry="5"
            cy="-3"
            transform={`rotate(${a})`}
            fill="#fffdf0"
          />
        ))}
        <circle r="1.7" fill="#e1b846" />
      </g>
      <g id="garden-bloom-lavender">
        <path d="M0 1V-12" stroke="#588c4b" stroke-width="1.4" />
        {[-10, -7, -4].map((y, i) => (
          <g key={y}>
            <ellipse
              cx="-2"
              cy={y}
              rx="2.3"
              ry="1.7"
              fill={i % 2 ? "#aa85d4" : "#8663b4"}
            />
            <ellipse cx="2" cy={y - 1} rx="2.3" ry="1.7" fill="#ba94dd" />
          </g>
        ))}
      </g>
      {["white", "red", "lily", "lavender"].map((kind) => (
        <g key={kind} id={`garden-plant-${kind}`}>
          <path
            d="M0 0Q3-10 0-23"
            stroke="#367b3e"
            stroke-width="1.2"
            fill="none"
          />
          <path
            d="M0-5Q-11-17-10-8Q-5-1 0-5M1-12Q11-25 10-16Q8-6 1-12"
            fill="#5a9b45"
          />
          <use href={`#garden-bloom-${kind}`} transform="translate(0 -23)" />
        </g>
      ))}
    </>
  );
}

/** Slow overlapping planting windows keep the scene changing through six study days. */
export function GardenBeds({
  minutes,
  seed,
  night,
}: {
  minutes: number;
  seed: number;
  night: number;
}) {
  const beds = gardenBeds(minutes, seed).sort((a, b) => a.y - b.y);
  return (
    <g class="garden-beds" opacity={1 - night * 0.12}>
      {beds.map((bed) => (
        <g
          key={bed.id}
          data-garden-bed={bed.id}
          transform={`translate(${bed.x} ${bed.y})`}
        >
          <ellipse
            rx={28 * clamp(bed.age / 20)}
            ry={9 * clamp(bed.age / 20)}
            fill="#498c43"
            opacity=".4"
          />
          {Array.from({ length: 24 }, (_, j) => {
            const grow = clamp((bed.age - j * 6) / 36);
            if (!grow) return null;
            const x = (noise(j + bed.id * 30, seed) - 0.5) * 61,
              y = (noise(j + bed.id * 30 + 140, seed) - 0.5) * 15;
            const height = (15 + noise(j + 410, seed) * 13) * grow;
            const kind = (bed.id + j) % 6;
            const symbol =
              kind === 0
                ? "white"
                : kind === 1
                  ? "red"
                  : kind === 2
                    ? "lily"
                    : kind === 3
                      ? "lavender"
                      : kind === 4
                        ? "white"
                        : "red";
            return (
              <use
                key={j}
                href={`#garden-plant-${symbol}`}
                transform={`translate(${x} ${y}) scale(${grow} ${height / 23})`}
              />
            );
          })}
        </g>
      ))}
    </g>
  );
}
