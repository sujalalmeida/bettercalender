import { gardenStage } from "../lib/gardenState";
import { mix, noise } from "../lib/gardenPalette";
import { outpostStage } from "../lib/outpostState";

interface Props {
  elapsedMs: number;
  seed: number;
  motion: boolean;
  raid: boolean;
}

function growth(minutes: number, start: number, duration: number) {
  if (minutes < start) return 0;
  return Math.min(1, 0.16 + (minutes - start) / duration);
}

function Lightsaber({ color, path }: { color: string; path: string }) {
  return <g fill="none" stroke-linecap="round">
    <path d={path} stroke={color} stroke-width="19" opacity=".18" />
    <path d={path} stroke={color} stroke-width="10" opacity=".7" />
    <path d={path} stroke="#fff4df" stroke-width="4" />
  </g>;
}

function ForceUser({ x, y, scale = 1, sith = false, facing = 1 }: {
  x: number; y: number; scale?: number; sith?: boolean; facing?: number;
}) {
  return <g transform={`translate(${x} ${y}) scale(${scale * facing} ${scale})`}>
    <ellipse cy="4" rx="28" ry="8" fill="#301c26" opacity=".35" />
    <path d="M-12-70Q-25-55-34-6l21-8 11 12 18-9 22 2-18-61Z" fill={sith ? "#211923" : "#59404a"} />
    <path d="m-15-63-5 49h36l-1-50Z" fill={sith ? "#35232f" : "#bc9571"} />
    <path d="m-14-37 28-2 2 7-32 2Z" fill="#483041" />
    <path d="M-15-65q-4-29 15-35 19 6 16 35Z" fill={sith ? "#171520" : "#805e54"} />
    <path d="M-9-79q8-10 18 0l-2 13-13 1Z" fill={sith ? "#3c2430" : "#ce9971"} />
    <path d="m8-58 14 16 15-6" fill="none" stroke={sith ? "#35232f" : "#8c664e"} stroke-width="13" stroke-linecap="round" />
    <path d="m31-44 11-8" stroke="#403645" stroke-width="8" stroke-linecap="round" />
    <Lightsaber color={sith ? "#ff384f" : facing < 0 ? "#8df8bd" : "#58ccff"} path="M42-52 84-98" />
  </g>;
}

function Astromech({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cy="4" rx="19" ry="5" fill="#59333b" opacity=".35" />
    <path d="M-13-33q0-24 26-16l5 16Z" fill="#8a9ca4" />
    <path d="M-12-33h26v33h-26Z" fill="#e1d9ca" />
    <path d="M-13-31-20-5m34-26 8 26" stroke="#bbb9b4" stroke-width="7" />
    <path d="M-7-27h15v5H-7zm2 10h9v8h-9Z" fill="#35637e" />
    <path d="M-9-38v-8h9v8Z" fill="#395c78" />
    <circle cx="8" cy="-40" r="3" fill="#fe9f86" />
    <path d="M-24-6h10v8h-10zm39 0h10v8h-10Z" fill="#60717d" />
  </g>;
}

function StarDestroyer({ x, y, scale }: { x: number; y: number; scale: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <g class="outpost-capital-drift">
      <path d="m-150 12 51-42 154 7 129 55-212-10Z" fill="#4b485b" />
      <path d="m-150 12 334 20-177 13-99-11Z" fill="#302d44" />
      <path d="m-97-30 103 13 178 49-137-17Z" fill="#898092" />
      <path d="m-101-30 12-18 47 1 10 21m-39-21 6-18h23l8 17" fill="#686277" />
      <path d="M-67-65v-9m24 9v-9" stroke="#a899a3" stroke-width="3" />
      <path d="M-128 19l224 16M-100 25l122 12" stroke="#ba9da2" stroke-width="1.8" stroke-dasharray="2 7" />
      <path d="m-118 23 13 6m5-4 13 6" stroke="#8adbf0" stroke-width="3" />
    </g>
  </g>;
}

function Fighter({ x, y, scale = 1, build = 1, flying = false }: {
  x: number; y: number; scale?: number; build?: number; flying?: boolean;
}) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <g class={flying ? "outpost-fighter-flight" : undefined}>
      {!flying && <ellipse cy="27" rx="99" ry="13" fill="#3d2a36" opacity=".4" />}
      <path d="m-56 5 54-21 70 12 24 14-55 11-72-5Z" fill="#d4c5ae" />
      <path d="m-56 5 93 16 55-11-58 19-84-13Z" fill="#75616a" />
      <path d="m-2-16 18-5 29 11-31 5Z" fill="#4b617a" />
      <g opacity={build}>
        <path d="m-17 4-50-21-43 3 49 26 65 3Zm21 11 60 37 49-9-54-32Z" fill="#b3a5a0" />
        <path d="m-65-17-10 1 46 24 10-1Zm143 45-12 2 26 17 12-3Z" fill="#a3544d" />
        <path d="M-110-14l-22 4m245 53 24-5" stroke="#ded4bf" stroke-width="5" />
        <path d="m-43 12-17 4m12 4-17 3" stroke="#88d9e7" stroke-width="4" stroke-linecap="round" />
      </g>
    </g>
  </g>;
}

type StructureKind = "dome" | "garage" | "tower" | "temple";

function Structure({ x, y, scale = 1, build, kind }: {
  x: number; y: number; scale?: number; build: number; kind: StructureKind;
}) {
  if (!build) return null;
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cy="6" rx="104" ry="21" fill="#432832" opacity=".26" />
    <g class="outpost-structure"><g transform={`scale(1 ${build})`}>
      {kind === "dome" && <>
        <path d="M-85-13v-31q5-68 78-70 62 2 84 62v44Z" fill="url(#outpost-plaster)" />
        <path d="M-85-44q69-20 162-8v43H-85Z" fill="#ad7f69" />
        <path d="m-22-48 27-7 28 5v42h-55Z" fill="#684651" />
        <path d="M-10-34h26v26h-26Z" fill="#ffca83" opacity=".7" />
        <path d="M-59-47h18m86-5h15" stroke="#ffcc84" stroke-width="6" />
        <path d="M-51-96q15-13 44-16" fill="none" stroke="#f6cfab" stroke-width="4" opacity=".8" />
      </>}
      {kind === "garage" && <>
        <path d="M-95-12v-62l27-31h111l45 31v62Z" fill="url(#outpost-plaster)" />
        <path d="M-95-74h183v62H-95Z" fill="#8d6561" />
        <path d="M-59-68h112v56H-59Z" fill="#413345" />
        <path d="M-56-64h106v42H-56Z" fill="#5a4c58" />
        <path d="M-54-63h101m-103 42h109" stroke="#e7af81" stroke-width="3" />
        <path d="M-82-63v40m155-40v40" stroke="#ffc381" stroke-width="5" />
        <path d="m-59-102-15 25m115-25 31 25" stroke="#855c56" stroke-width="4" />
      </>}
      {kind === "tower" && <>
        <path d="M-47-10-31-137h62L46-10Z" fill="#a77d71" />
        <path d="m-31-137 17-18 34 3 11 15Z" fill="#e4bb99" />
        <path d="M-42-101h84v-30h-84Z" fill="#745661" />
        <path d="M-34-123h68v9h-68Z" fill="#fbd08f" />
        <path d="M0-155v-37m0 9 15-6" stroke="#4d414d" stroke-width="4" />
        <circle cx="0" cy="-193" r="4" fill="#ffaf8c" class="outpost-beacon" />
        <path d="M-29-62h58m-61 9h65" stroke="#d8a382" stroke-width="4" />
      </>}
      {kind === "temple" && <>
        <path d="M-102-11h204v-14H-102Zm16-14h172v-16H-86Z" fill="#877381" />
        <path d="M-76-41v-46l17-19 20 18v47Zm115 0v-47l20-18 17 19v46Z" fill="#b29c9a" />
        <path d="m-37-39 4-69 16-21 17-70 17 70 16 21 4 69Z" fill="url(#outpost-temple)" />
        <path d="M-9-43v-40l9-17 9 17v40Z" fill="#b8dbdf" />
        <path d="M-56-84v28m112-28v28m-56-68v19" stroke="#e6cba6" stroke-width="3" />
      </>}
    </g></g>
    {build < 0.82 && <path d="M-108-8v-55h27m166 0h26v55M-114-8h229" fill="none" stroke="#f3c28c" stroke-width="2" stroke-dasharray="5 7" opacity=".8" />}
  </g>;
}

function SithRaid() {
  return <g class="outpost-raid" transform="translate(0 -145)" aria-hidden="true">
    <ellipse cx="822" cy="715" rx="275" ry="125" fill="url(#outpost-raid-glow)" class="outpost-raid-glow" />
    <g class="outpost-raid-smoke" fill="#503745" opacity=".65">
      <path d="M640 723q-24-27 13-50-24-26 18-48-5-33 38-25 31 14 8 47 35 12 10 50l18 22Z" />
      <path d="M923 711q-33-30 0-57-9-36 24-47 35-5 31 36 36 18 6 53l25 21Z" />
    </g>
    <g class="outpost-raid-debris" fill="#d98465">
      <path d="m613 729 19-22 25 18-14 15Zm56-8 16-23 13 19-4 13Zm251 1 19-16 25 24-24 6Zm54-27 24 12-16 19-13-14Z" />
      <path d="m685 644 29-22m222 35 35-31m-295 53-35-19m307 21 39-8" stroke="#ffd390" stroke-width="4" />
    </g>
    <g class="outpost-raid-sith">
      <ForceUser x={910} y={789} scale={1.27} sith facing={-1} />
      <path class="outpost-saber-sweep" d="M835 651q-81 33-115 104 65-49 132-55Z" fill="#ff4560" opacity=".35" />
    </g>
    <g class="outpost-raid-defense"><ForceUser x={723} y={793} scale={1.24} /></g>
  </g>;
}

export function OutpostLandscape({ elapsedMs, seed, motion, raid }: Props) {
  const { minutes, completed } = outpostStage(elapsedMs);
  const { night, dayProgress } = gardenStage(elapsedMs);
  const farm = growth(minutes, 60, 45);
  const pad = growth(minutes, 120, 65);
  const fighter = growth(minutes, 360, 360);
  const finished = minutes >= 8640;
  const sunX = 420 + dayProgress * 780;
  const sunY = 172 - Math.sin(dayProgress * Math.PI) * 74;

  return <svg
    class={`garden-landscape outpost-landscape ${raid ? "outpost-under-raid" : ""} ${motion ? "" : "garden-still"}`}
    viewBox="0 0 1600 1000"
    preserveAspectRatio="xMidYMid slice"
    role="img"
    aria-label={raid ? "Sith raid at Twin Suns Outpost. A red lightsaber clashes with a Jedi." : `Twin Suns Outpost, ${completed} milestones built${finished ? ", fleet flyover" : ""}`}
  >
    <defs>
      <clipPath id="outpost-boundary"><rect width="1600" height="1000" /></clipPath>
      <linearGradient id="outpost-sky" x2="0" y2="1">
        <stop stop-color={mix("#38435e", "#15162d", night)} />
        <stop offset="1" stop-color={mix("#ed9b76", "#4b344c", night)} />
      </linearGradient>
      <linearGradient id="outpost-sand" x2="0" y2="1">
        <stop stop-color={mix("#c58a70", "#655066", night)} />
        <stop offset="1" stop-color={mix("#76515a", "#3a324d", night)} />
      </linearGradient>
      <linearGradient id="outpost-plaster" x2="1" y2=".8">
        <stop stop-color="#efc9a4" /><stop offset="1" stop-color="#ad7a69" />
      </linearGradient>
      <linearGradient id="outpost-temple" x2="1" y2="1">
        <stop stop-color="#ded2bc" /><stop offset="1" stop-color="#9c8190" />
      </linearGradient>
      <radialGradient id="outpost-sun-glow">
        <stop stop-color="#ffd59a" stop-opacity=".5" /><stop offset="1" stop-color="#ffd59a" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="outpost-raid-glow">
        <stop stop-color="#fa7655" stop-opacity=".58" /><stop offset="1" stop-color="#ed573b" stop-opacity="0" />
      </radialGradient>
    </defs>
    <g clip-path="url(#outpost-boundary)">
      <rect width="1600" height="1000" fill="url(#outpost-sky)" />
      <g fill="#ffe9c7" opacity={0.18 + night * 0.72}>
        {Array.from({ length: 48 }, (_, i) => <circle key={i} cx={noise(i, seed) * 1600} cy={noise(i + 63, seed) * 406} r={i % 9 === 0 ? 2.2 : 1.2} />)}
      </g>
      <g opacity={1 - night * 0.78}>
        <circle cx={sunX + 50} cy={sunY + 25} r="187" fill="url(#outpost-sun-glow)" />
        <circle cx={sunX} cy={sunY} r="69" fill="#ffe5b7" />
        <circle cx={sunX + 134} cy={sunY + 56} r="43" fill="#ffae80" />
      </g>
      {minutes >= 2160 && <StarDestroyer x={1230} y={267} scale={1.27} />}
      {minutes >= 7200 && <>
        <StarDestroyer x={330} y={257} scale={0.82} />
        <StarDestroyer x={1020} y={168} scale={0.62} />
      </>}
      <path d="M0 404 118 351 182 364 229 303 335 295 383 338 455 351 530 403 666 401 766 354 850 383 943 358 1012 277 1165 267 1199 330 1310 362 1434 339 1600 401V557H0Z" fill={mix("#885f6b", "#55415b", night)} />
      <path d="m183 364 45-61 107-8 47 43-88-10-69 28Zm813-68 16-19 153-10 30 59-77-28-85 17Z" fill="#e1a48e" opacity=".24" />
      <path d="M0 467q168-69 363-35t388 21q193-70 381-53t468 54v546H0Z" fill="url(#outpost-sand)" />
      <path d="M0 522q286-98 518-35t396-7q318-112 686-21v72q-278-56-529 33t-477-13Q262 493 0 588Z" fill="#e6a083" opacity=".29" />
      <path d="M0 731q189-93 413-37t378 73q210 17 410-90t399-31v354H0Z" fill={mix("#a36861", "#5a4358", night)} />
      <path d="M0 878q237-92 420-23t374 62q287-82 425-69t381 27v125H0Z" fill={mix("#835256", "#3f354c", night)} />
      <g fill="#e8a483" opacity=".22">
        {Array.from({ length: 60 }, (_, i) => <ellipse key={i} cx={noise(i + 156, seed) * 1600} cy={525 + noise(i + 96, seed) * 475} rx={3 + noise(i + 46, seed) * 9} ry={1 + noise(i + 19, seed) * 2} />)}
      </g>
      <path d="M109 899q290-66 456-100 226-46 436-148 131-65 274-55" stroke="#dd9c7d" stroke-width="42" opacity=".22" fill="none" />
      <path d="m384 768 35-13m36 26 63-13m633-193 56-13m-963 270 30-7" stroke="#f2b492" stroke-width="3" opacity=".26" />

      <g transform="translate(493 703)"><g class="outpost-structure">
        <ellipse cy="10" rx="76" ry="17" fill="#52313c" opacity=".38" />
        <path d="M-66 6 0-68 61 6Z" fill="#b58468" />
        <path d="M0-68 61 6H16Z" fill="#8d5e5a" />
        <path d="m-14 6 15-38 15 38Z" fill="#402f41" />
        <path d="M-77 8h18m120 0h19" stroke="#e4ac84" stroke-width="3" />
        {minutes >= 1 && <g>
          <path d="M-79 8v-74m0 11 15 6" stroke="#554354" stroke-width="5" />
          <circle cx="-79" cy="-70" r="5" fill="#ffe1a8" class="outpost-beacon" />
          <circle cx="1" cy="-11" r="6" fill="#ffa971" />
        </g>}
      </g></g>
      {minutes >= 15 && <g transform="translate(586 722)"><g class="outpost-droid-roll"><Astromech x={0} y={0} scale={0.83} /></g></g>}
      {farm > 0 && <g opacity={farm}>
        <path d="m188 654 174-30 74 33-176 40Z" fill="#815759" />
        {[0, 1, 2, 3].map(i => <g key={i} transform={`translate(${240 + 41 * i} ${654 - 7 * i})`}>
          <path d="M0 5v-97m-10 29h21m-17-9h12m-10-11h8" stroke="#dac2ae" stroke-width="5" />
          <path d="m-15 6 15-14 15 14Z" fill="#a97d6d" />
          <circle cy="-94" r="4" fill="#aedbce" />
        </g>)}
        <path d="m216 667 142-29m-111 45 140-34" stroke="#d49e81" stroke-width="2" />
      </g>}
      {pad > 0 && <g opacity={pad}>
        <ellipse cx="868" cy="650" rx="213" ry="54" fill="#8c7478" stroke="#c29c8d" stroke-width="7" />
        <ellipse cx="868" cy="650" rx="168" ry="38" fill="#766571" stroke="#e3ae84" stroke-width="3" stroke-dasharray="22 12" />
        <path d="M820 646h97m-73-15-20 28m67-28 20 28" stroke="#d1b3a1" stroke-width="4" />
      </g>}
      <Structure x={650} y={639} build={pad} kind="garage" />
      {minutes >= 240 && <g transform="translate(554 826)"><g class="outpost-speeder">
        <path d="M-57-15 27-24 54-9 38 4h-74Z" fill="#a35955" />
        <path d="m-57-15 84-9 15 8-77 13Z" fill="#d49572" />
        <path d="M-20-14-9-30h30l10 10Z" fill="#55667a" />
        <path d="M-61-8h20m55 10h21" stroke="#a6dbe4" stroke-width="4" stroke-linecap="round" />
      </g></g>}
      {fighter > 0 && <Fighter x={865} y={637} scale={1.06} build={fighter} />}
      {minutes >= 720 && <Fighter x={765} y={347} scale={0.42} flying />}
      <Structure x={1055} y={703} build={growth(minutes, 1080, 300)} kind="dome" />
      <Structure x={370} y={585} scale={1.16} build={growth(minutes, 1440, 500)} kind="garage" />
      <Structure x={147} y={599} scale={0.83} build={growth(minutes, 1600, 400)} kind="tower" />
      <Structure x={1290} y={616} scale={0.92} build={growth(minutes, 2880, 750)} kind="garage" />
      <Structure x={1118} y={545} scale={0.64} build={growth(minutes, 3200, 550)} kind="tower" />
      <Structure x={1350} y={484} scale={1.05} build={growth(minutes, 4320, 960)} kind="temple" />
      <Structure x={1494} y={551} scale={0.57} build={growth(minutes, 5760, 1050)} kind="temple" />
      <Structure x={270} y={777} scale={0.62} build={growth(minutes, 6400, 700)} kind="dome" />
      <Structure x={1192} y={784} scale={0.74} build={growth(minutes, 6850, 800)} kind="dome" />
      <Structure x={1483} y={727} scale={0.78} build={growth(minutes, 7550, 890)} kind="tower" />
      {minutes >= 180 && <ForceUser x={772} y={772} scale={0.9} />}
      {minutes >= 3600 && <ForceUser x={866} y={776} scale={0.88} facing={-1} />}
      {minutes >= 2880 && <Astromech x={1260} y={685} scale={0.73} />}
      {finished && <>
        <Fighter x={566} y={258} scale={0.62} flying />
        <Fighter x={730} y={301} scale={0.71} flying />
        <Fighter x={1004} y={290} scale={0.53} flying />
      </>}
      {raid && <SithRaid />}
    </g>
  </svg>;
}
