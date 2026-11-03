import { GardenProjects } from "./garden/GardenProjects";
import { GardenBeds, GardenFlowerSymbols } from "./garden/GardenBeds";
import { gardenStage } from "../lib/gardenState";
import { progress, noise, mix, palettes } from "../lib/gardenPalette";
import {
  Flowers,
  Tree,
  Cottage,
  Villager,
  Farm,
} from "./garden/GardenPrimitives";

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
  const sky = mix(p.sky, "#15334f", night),
    field = mix(p.field, "#24543d", night * 0.8),
    front = mix(p.front, "#1c4533", night * 0.8);
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
        <GardenFlowerSymbols />
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
        d="M0 438Q180 310 410 375T840 360T1250 372T1600 345V1000H0Z"
        fill={mix(p.far, "#285445", night * 0.8)}
      />
      <path
        d="M0 493Q260 372 510 436T970 410T1600 430V1000H0Z"
        fill={mix(p.hill, "#285743", night * 0.8)}
      />
      {Array.from({ length: 18 }, (_, i) => ({
        i,
        growth: progress(minutes, 20 + i * 30, 120),
      }))
        .filter((t) => t.growth > 0)
        .map(({ i, growth }) => (
          <Tree
            key={i}
            x={i * 98 - 30}
            y={430 + noise(i, seed) * 45}
            scale={(0.34 + noise(i + 40, seed) * 0.22) * growth}
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
      <GardenProjects
        minutes={minutes}
        night={night}
        summer={season === "Summer"}
        seed={seed}
        layer="back"
      />
      {stream > 0 && (
        <g opacity={stream} class="garden-stream">
          <path
            d="M1240 365C1090 441 1385 462 1265 565C1140 676 1128 698 1206 790C1272 879 1127 931 1088 1000H1288C1312 926 1410 864 1338 781C1210 659 1293 651 1370 565C1486 435 1194 431 1280 365Z"
            fill={mix("#c9dc8e", "#66875b", night * 0.6)}
          />
          <path
            d="M1258 370C1150 448 1429 460 1310 565C1193 677 1197 717 1271 792C1336 874 1201 947 1186 1010"
            fill="none"
            stroke={mix("#a6ddd0", "#477d82", night * 0.65)}
            stroke-width="88"
          />
          <path
            d="M1258 370C1150 448 1429 460 1310 565C1193 677 1197 717 1271 792C1336 874 1201 947 1186 1010"
            fill="none"
            stroke={mix("#58bccf", "#367d97", night * 0.6)}
            stroke-width="66"
          />
          <g
            class="garden-water-flow"
            fill="none"
            stroke={mix("#e1f8ef", "#9bd9d9", night * 0.4)}
            stroke-width="2"
            opacity=".75"
            stroke-dasharray="25 88 11 60"
          >
            <path d="M1250 376C1142 448 1421 460 1302 565C1185 677 1189 717 1263 792C1328 874 1193 947 1178 1000" />
            <path d="M1278 405C1296 456 1416 478 1344 559C1251 665 1217 696 1300 801C1367 883 1234 941 1223 1000" />
          </g>
          <path
            class="garden-water-shimmer"
            d="M1265 379C1157 450 1436 461 1317 565C1200 677 1204 717 1278 792C1343 874 1208 947 1193 1000"
            fill="none"
            stroke="#b6eceb"
            stroke-width="7"
            opacity=".4"
            stroke-dasharray="3 153 2 67"
          />
          {[
            { x: 1245, y: 418 },
            { x: 1371, y: 512 },
            { x: 1210, y: 692 },
            { x: 1357, y: 859 },
            { x: 1160, y: 957 },
          ].map((rock, i) => (
            <g key={i} transform={`translate(${rock.x} ${rock.y})`}>
              <ellipse cy="3" rx="14" ry="6" fill="#438981" opacity=".2" />
              <ellipse
                rx={10 + (i % 3) * 2}
                ry="6"
                fill={mix("#d0d0a0", "#829d8a", night * 0.55)}
              />
              <path
                d="M-6-2Q0-6 5-2"
                fill="none"
                stroke="#e7e1ba"
                stroke-width="1.5"
              />
            </g>
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
          {[-9, 2, 10].map((x, i) => (
            <circle
              key={x}
              class="garden-ember"
              style={{ animationDelay: `${-i * 1.3}s` }}
              cx={x}
              cy={-24 - i * 5}
              r="1.5"
              fill="#ffe7a3"
            />
          ))}
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
      <Flowers minutes={minutes} seed={seed} night={night} />
      <GardenBeds minutes={minutes} seed={seed} night={night} />
      <GardenProjects
        minutes={minutes}
        night={night}
        summer={season === "Summer"}
        seed={seed}
        layer="front"
      />
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
    </svg>
  );
}
