import type { ComponentChildren } from "preact";
import {
  GARDEN_PROJECTS,
  projectProgress,
  type GardenProjectKind,
} from "../../lib/gardenGrowth";
import { clamp, mix, noise } from "../../lib/gardenPalette";
import { Cottage, Tree, Villager } from "./GardenPrimitives";

function GardenMotion({
  className,
  at,
  delay = 0,
  children,
}: {
  className: string;
  at: string;
  delay?: number;
  children: ComponentChildren;
}) {
  return (
    <g transform={at}>
      <g class={className} style={{ animationDelay: `${delay}s` }}>
        {children}
      </g>
    </g>
  );
}

function Roses({
  x = 0,
  y = 0,
  count = 9,
}: {
  x?: number;
  y?: number;
  count?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: count }, (_, i) => (
        <g
          key={i}
          transform={`translate(${(i % 3) * 9 - 9} ${-Math.floor(i / 3) * 9})`}
        >
          <ellipse rx="7" ry="5" fill="#4e944d" />
          <use
            href={i % 3 ? "#garden-bloom-red" : "#garden-bloom-white"}
            transform="scale(.65)"
          />
        </g>
      ))}
    </g>
  );
}

function ProjectArt({
  kind,
  night,
  summer,
  variant,
}: {
  kind: GardenProjectKind;
  night: number;
  summer: boolean;
  variant: number;
}) {
  const wood = mix("#a5794d", "#5b624c", night * 0.55),
    cream = mix("#fff0cc", "#b3b7a0", night * 0.45),
    stone = mix("#bfc0a0", "#718b78", night * 0.5),
    leaf = "#4a9148";
  switch (kind) {
    case "arbor":
    case "porch":
      return (
        <>
          <path
            d="M-42 8V-64Q0-112 42-64V8M-35 8V-61Q0-99 35-61V8M-44-60L44-60"
            stroke={cream}
            stroke-width="6"
            fill="none"
          />
          <path
            d="M-42 8Q-62-42-37-66Q0-100 33-68Q58-31 42 8"
            stroke={leaf}
            stroke-width="8"
            fill="none"
          />
          {[-40, -20, 0, 20, 40].map((x, i) => (
            <Roses
              key={x}
              x={x}
              y={-65 - Math.sin((i / 4) * Math.PI) * 20}
              count={6}
            />
          ))}
          <Roses x={-43} y={-16} />
          <Roses x={44} y={-18} />
        </>
      );
    case "apiary":
      return (
        <>
          {[-38, 23].map((x, i) => (
            <g key={x} transform={`translate(${x} ${i * 8})`}>
              <path
                d="M-23 0V-45H23V0Z"
                fill="#e8bc57"
                stroke={wood}
                stroke-width="3"
              />
              <path d="M-30-45L0-64L30-45Z" fill={cream} />
              <path
                d="M-20-31H20M-20-16H20M-17 0V12M17 0V12"
                stroke={wood}
                stroke-width="3"
              />
              <ellipse cy="-5" rx="6" ry="3" fill="#70542e" />
            </g>
          ))}
          <Roses x={-65} y={8} />
          {[0, 1, 2].map((i) => (
            <GardenMotion
              key={i}
              className="garden-bee"
              delay={-i * 3}
              at={`translate(${i * 24 - 30} ${-60 - i * 8})`}
            >
              <ellipse rx="5" ry="3" fill="#edb840" />
              <path d="M-1-3V3M2-3V3" stroke="#675334" stroke-width="1.4" />
              <ellipse cy="-4" rx="3" ry="2" fill="#fff9dc" />
            </GardenMotion>
          ))}
        </>
      );
    case "laundry":
      return (
        <>
          <path
            d="M-80 8V-68M80 8V-68M-80-61Q0-38 80-61"
            fill="none"
            stroke={wood}
            stroke-width="4"
          />
          <g class="garden-laundry">
            {[-49, -17, 17, 49].map((x, i) => (
              <g
                key={x}
                transform={`translate(${x} ${-51 + Math.sin(((i + 1) / 5) * Math.PI) * 7})`}
              >
                <path
                  d={
                    i % 2
                      ? "M-13 0L-21 12L-12 16V38H12V16L21 12L13 0Z"
                      : "M-12 0H12V42H-12Z"
                  }
                  fill={i % 2 ? "#e9b6b0" : "#fff5d7"}
                />
                <path d="M-7-3V4M7-3V4" stroke="#b69464" stroke-width="2" />
              </g>
            ))}
          </g>
        </>
      );
    case "waterwheel":
      return (
        <>
          <path d="M-20 15L-15-58H26L38 15Z" fill={stone} />
          <g class="garden-waterwheel">
            <circle r="49" fill="none" stroke={wood} stroke-width="9" />
            <circle r="35" fill="none" stroke="#d7ad75" stroke-width="4" />
            {Array.from({ length: 10 }, (_, i) => (
              <g key={i} transform={`rotate(${i * 36})`}>
                <path d="M0 0V-45" stroke={wood} stroke-width="4" />
                <path d="M-8-49H8V-40H-8Z" fill="#c4925b" />
              </g>
            ))}
            <circle r="8" fill={cream} />
          </g>
          <path
            d="M-55 18Q-10 29 54 14"
            fill="none"
            stroke="#b5e9df"
            stroke-width="3"
            class="garden-pond-ripple"
          />
        </>
      );
    case "gazebo":
    case "pergola":
      return (
        <>
          <ellipse cy="13" rx="88" ry="20" fill="#b7bc8b" />
          <path
            d="M-67 9V-80M67 9V-80M-35 8V-80M35 8V-80"
            stroke={cream}
            stroke-width="6"
          />
          <path
            d="M-86-78L0-135L86-78Z"
            fill={kind === "gazebo" ? "#a97458" : "#799457"}
            stroke={wood}
            stroke-width="4"
          />
          <path
            d="M-79-75H79M-70-67H70M-67-24H67M-67-4H67"
            stroke={cream}
            stroke-width="4"
          />
          <path
            d="M-24 0V-25H24V0M-32-26H32"
            fill={wood}
            stroke={wood}
            stroke-width="4"
          />
          <Roses x={-70} y={4} count={12} />
          <Roses x={70} y={4} count={12} />
          {night > 0.2 && (
            <g fill="#ffe09c">
              <circle cy="-72" r="5" />
              <circle cx="-45" cy="-75" r="3" />
              <circle cx="45" cy="-75" r="3" />
            </g>
          )}
        </>
      );
    case "well":
      return (
        <>
          <ellipse
            cy="2"
            rx="43"
            ry="21"
            fill={stone}
            stroke="#829475"
            stroke-width="3"
          />
          <path
            d="M-43 0V24Q0 47 43 24V0"
            fill={stone}
            stroke="#829475"
            stroke-width="3"
          />
          <ellipse cy="-1" rx="29" ry="11" fill="#4a8d9e" />
          <path
            d="M-37 7V-72M37 7V-72M-37-42H37"
            stroke={wood}
            stroke-width="6"
          />
          <path d="M-54-69L0-105L54-69Z" fill="#b47c58" />
          <path d="M0-42V3" stroke="#d6b97b" stroke-width="2" />
          <path d="M-10 7L-7-7H8L11 7Z" fill="#d3bb83" />
        </>
      );
    case "pond":
      return (
        <>
          <ellipse rx="112" ry="46" fill="#acd18a" />
          <ellipse
            rx="102"
            ry="37"
            fill="#55b8c4"
            stroke="#9ad7c7"
            stroke-width="5"
          />
          <g
            class="garden-pond-ripple"
            stroke="#dcf6e4"
            fill="none"
            opacity=".7"
          >
            <ellipse cx="-40" cy="7" rx="28" ry="8" />
            <ellipse cx="42" cy="-9" rx="22" ry="6" />
          </g>
          {[-70, -19, 51, 76].map((x, i) => (
            <g key={x} transform={`translate(${x} ${i % 2 ? 18 : -15})`}>
              <ellipse rx="13" ry="6" fill="#3a985c" />
              <use
                href="#garden-bloom-lily"
                transform="translate(0 -5) scale(.6)"
              />
            </g>
          ))}
          <GardenMotion className="garden-duck" at="translate(13 -9)">
            <ellipse rx="14" ry="7" fill="#fff8dc" />
            <circle cx="11" cy="-10" r="6" fill="#fff8dc" />
            <path d="M16-11L24-8L16-6" fill="#e8a242" />
            <ellipse cx="-2" cy="-1" rx="7" ry="3" fill="#e6dcbd" />
            <circle cx="13" cy="-12" r="1" fill="#484d34" />
          </GardenMotion>
          <GardenMotion
            className="garden-duck"
            delay={-3}
            at="translate(-45 10)"
          >
            <ellipse rx="9" ry="5" fill="#f5d56d" />
            <circle cx="7" cy="-6" r="4" fill="#f5d56d" />
            <path d="M10-7L16-5L10-3" fill="#df973f" />
          </GardenMotion>
        </>
      );
    case "herbs":
      return (
        <>
          <path
            d="M-63 4V-39H63V4M-69-40H69M-62-19H62"
            stroke={wood}
            stroke-width="6"
          />
          {[-47, -17, 16, 46].map((x, i) => (
            <g key={x} transform={`translate(${x} -42)`}>
              <path d="M-9-15H9L6 0H-6Z" fill={i % 2 ? "#cf8962" : "#c9ad75"} />
              <path
                d="M0-14V-42M0-20Q-20-37-13-39Q-3-42 0-25M0-28Q20-49 17-36Q12-25 0-28"
                stroke={leaf}
                fill="#70a952"
                stroke-width="2"
              />
              {i % 2 === 0 && (
                <use
                  href="#garden-bloom-lavender"
                  transform="translate(0 -42) scale(1.3)"
                />
              )}
            </g>
          ))}
        </>
      );
    case "bakery":
      return (
        <>
          <path d="M-60 9V-69M60 9V-69" stroke={wood} stroke-width="5" />
          <path d="M-75-69L-55-103H55L75-69Z" fill="#f2cd99" />
          {[-60, -20, 20, 60].map((x) => (
            <path key={x} d={`M${x - 10}-70l12-31h15l12 31Z`} fill="#cc7e72" />
          ))}
          <path d="M-66-12H66V18H-66Z" fill={wood} />
          {[-37, -10, 20, 43].map((x, i) => (
            <g key={x}>
              <ellipse
                cx={x}
                cy="-20"
                rx={i % 2 ? 10 : 13}
                ry="7"
                fill="#e6b65d"
              />
              <path
                d={`M${x - 4}-24l2 5m4-6l2 5`}
                stroke="#bb823b"
                stroke-width="1.3"
              />
            </g>
          ))}
        </>
      );
    case "lavender":
      return (
        <>
          <path
            d="M-73 9Q0 32 73 9"
            fill="none"
            stroke={stone}
            stroke-width="10"
          />
          {Array.from({ length: 17 }, (_, i) => (
            <g
              key={i}
              transform={`translate(${i * 9 - 72} ${Math.sin(i) * 6}) scale(${1.6 + (i % 3) * 0.25})`}
            >
              <use href="#garden-bloom-lavender" />
            </g>
          ))}
        </>
      );
    case "picnic":
      return (
        <>
          <path d="M-70-18L39-37L81 11L-30 35Z" fill="#f5dbc1" />
          <path
            d="M-61-9L46-27M-44 8L61-9M-27 25L74 6M-43-23L-7 31M-13-28L25 24M18-33L53 18"
            stroke="#d98681"
            stroke-width="7"
            opacity=".8"
          />
          <path
            d="M-21-10V-27Q-1-49 16-29V-10Z"
            fill="#bc9558"
            stroke={wood}
            stroke-width="3"
          />
          <ellipse cx="-2" cy="-12" rx="19" ry="8" fill="#dfc88c" />
          <circle cx="29" cy="-8" r="8" fill="#efebcf" />
          <path d="M27-14V-25M22-21H31" stroke="#a57b4f" stroke-width="2" />
        </>
      );
    case "rabbits":
      return (
        <>
          <ellipse cy="6" rx="40" ry="13" fill="#4a9148" />
          <path d="M-39 1Q-29-40 8-29Q24-24 23 1Z" fill="#6ba34d" />
          <ellipse cx="-15" cy="-1" rx="13" ry="11" fill="#526f3b" />
          {[0, 1].map((i) => (
            <GardenMotion
              key={i}
              className="garden-rabbit"
              delay={-i * 4}
              at={`translate(${i * 33 - 6} ${i * 9})`}
            >
              <ellipse rx="11" ry="7" fill={i ? "#d2ba91" : "#fff2d8"} />
              <circle cx="9" cy="-7" r="6" fill={i ? "#d2ba91" : "#fff2d8"} />
              <ellipse cx="8" cy="-17" rx="2.5" ry="8" fill="#efd3ba" />
              <ellipse cx="13" cy="-17" rx="2.5" ry="7" fill="#efd3ba" />
              <circle cx="11" cy="-9" r="1" fill="#5a5b3d" />
              <circle cx="-10" cy="-2" r="4" fill="#fff5db" />
            </GardenMotion>
          ))}
        </>
      );
    case "telescope":
      return (
        <>
          <path
            d="M0-32L-24 22M0-32L24 22M0-32L3 25"
            stroke={wood}
            stroke-width="4"
          />
          <g transform="rotate(-28)">
            <path
              d="M-30-45H29V-23H-30Z"
              fill="#c5ab69"
              stroke="#907c46"
              stroke-width="3"
            />
            <path d="M27-49H36V-19H27Z" fill="#8c9b8b" />
            <path d="M-40-41H-28V-28H-40Z" fill="#6b7c6d" />
          </g>
          <path
            d="M48 14H74V-3H48ZM52 14V29M70 14V29"
            fill={wood}
            stroke={wood}
            stroke-width="4"
          />
        </>
      );
    case "orchard":
      return (
        <>
          {[-58, 0, 62].map((x, i) => (
            <Tree
              key={x}
              x={x}
              y={i % 2 ? 17 : 0}
              scale={0.48 + i * 0.04}
              season={summer ? "Summer" : "Spring"}
              night={night}
              fruit
            />
          ))}
        </>
      );
    case "table":
      return (
        <>
          <path
            d="M-93-16L44-42L94-4L-44 23Z"
            fill="#c39760"
            stroke={wood}
            stroke-width="4"
          />
          <path
            d="M-65 4V36M67 1V28M-35-22V8M34-30V2"
            stroke={wood}
            stroke-width="6"
          />
          <path d="M-90 27L54 0M-56 43L89 14" stroke={cream} stroke-width="9" />
          {[-37, 0, 37].map((x, i) => (
            <g key={x} transform={`translate(${x} ${-10 - i * 5})`}>
              <ellipse rx="12" ry="6" fill="#fff3d0" />
              <circle r="4" fill="#cf9456" />
            </g>
          ))}
          <Roses y={-28} count={6} />
        </>
      );
    case "studio":
      return (
        <>
          <Cottage
            x={0}
            y={0}
            scale={0.8}
            build={1}
            night={night}
            variant={variant % 3}
          />
          <path
            d="M-35 13H35V34H-35ZM-28 34V44M28 34V44"
            fill={wood}
            stroke={wood}
            stroke-width="3"
          />
          {[-18, 0, 18].map((x) => (
            <path
              key={x}
              d={`M${x - 6} 13q-6-17 0-20h12q6 3 0 20Z`}
              fill="#ce9971"
            />
          ))}
        </>
      );
    case "steps":
      return (
        <>
          {Array.from({ length: 7 }, (_, i) => (
            <path
              key={i}
              d={`M${-34 + i * 7} ${i * 7 - 42}l50-7 10 10-50 7Z`}
              fill={i % 2 ? cream : stone}
              stroke="#8b9d7b"
              stroke-width="1"
            />
          ))}
        </>
      );
    case "swing":
      return (
        <>
          <path
            d="M-65 16L-42-112M-22 16L-42-112M65 16L42-112M22 16L42-112M-49-111H49"
            fill="none"
            stroke={wood}
            stroke-width="6"
          />
          <g class="garden-swing">
            <path
              d="M-22-106V-18M22-106V-18"
              stroke="#dec897"
              stroke-width="2"
            />
            <path d="M-30-18H30V-10H-30Z" fill="#ba8e55" />
          </g>
          <Roses x={-65} y={12} count={6} />
        </>
      );
    case "fountain":
      return (
        <>
          <ellipse
            cy="14"
            rx="61"
            ry="24"
            fill={stone}
            stroke="#8ba084"
            stroke-width="4"
          />
          <ellipse cy="9" rx="51" ry="16" fill="#63c1c8" />
          <path d="M-10 8L-7-49H7L10 8Z" fill={cream} />
          <ellipse cy="-48" rx="30" ry="10" fill={stone} />
          <g
            class="garden-fountain-water"
            fill="none"
            stroke="#d6f3de"
            stroke-width="2.5"
          >
            <path d="M0-49Q-35-105-43 1M0-49Q35-105 43 1M0-49V-83" />
          </g>
        </>
      );
    case "cart":
      return (
        <>
          <path
            d="M-45-33H42V0H-45ZM42-18L78-34"
            fill="#bb8c59"
            stroke={wood}
            stroke-width="4"
          />
          <circle
            cx="-27"
            cy="5"
            r="14"
            fill="#c8b77b"
            stroke={wood}
            stroke-width="4"
          />
          <circle
            cx="29"
            cy="5"
            r="14"
            fill="#c8b77b"
            stroke={wood}
            stroke-width="4"
          />
          {[-27, 0, 27].map((x) => (
            <Roses key={x} x={x} y={-37} count={9} />
          ))}
        </>
      );
    case "conservatory":
      return (
        <>
          <path
            d="M-92 4V-77L0-131L92-77V4Z"
            fill="#abdcc6"
            stroke={cream}
            stroke-width="5"
          />
          <path
            d="M-92-77H92M0-131V4M-47-103V4M47-103V4M-92-37H92"
            stroke={cream}
            stroke-width="4"
          />
          <path
            d="M-18 3V-58H18V3Z"
            fill="#73b999"
            stroke={cream}
            stroke-width="3"
          />
          <Roses x={-62} y={-2} count={12} />
          <Roses x={62} y={-2} count={12} />
          <path
            d="M-74-65L-54-90M10-92L26-108"
            stroke="#edf9df"
            stroke-width="3"
          />
        </>
      );
    case "lanterns":
      return (
        <>
          <path
            d="M-100 9V-72M100 9V-72M-100-66Q0-33 100-66"
            fill="none"
            stroke={wood}
            stroke-width="3"
          />
          {[-80, -48, -16, 16, 48, 80].map((x, i) => (
            <g
              key={x}
              transform={`translate(${x} ${-65 + Math.sin(((i + 1) / 7) * Math.PI) * 17})`}
            >
              <path d="M0 0V8" stroke={wood} stroke-width="1.5" />
              {variant % 2 ? (
                <path
                  d="M-10 6H10L0 28Z"
                  fill={i % 2 ? "#f5c29e" : "#fff0b8"}
                />
              ) : (
                <g class="garden-paper-lantern">
                  <ellipse
                    cy="17"
                    rx="9"
                    ry="12"
                    fill={night > 0.2 ? "#ffe49b" : "#f4d9a9"}
                  />
                  <path
                    d="M-5 5H5M-5 29H5M0 6V28"
                    stroke="#c49b63"
                    stroke-width="1.2"
                  />
                  {night > 0.2 && (
                    <ellipse
                      cy="17"
                      rx="17"
                      ry="20"
                      fill="#ffe49b"
                      opacity=".13"
                    />
                  )}
                </g>
              )}
            </g>
          ))}
        </>
      );
  }
}

export function GardenProjects({
  minutes,
  night,
  summer,
  seed,
  layer,
}: {
  minutes: number;
  night: number;
  summer: boolean;
  seed: number;
  layer: "back" | "front";
}) {
  return (
    <g class={`garden-projects garden-projects-${layer}`}>
      {GARDEN_PROJECTS.filter((p) => p.y < 650 === (layer === "back")).map(
        (project, i) => {
          const build = projectProgress(minutes, project);
          if (!build) return null;
          const clip = `garden-project-${project.id}`;
          return (
            <g
              key={project.id}
              data-garden-project={project.id}
              transform={`translate(${project.x} ${project.y}) scale(${project.scale})`}
            >
              <defs>
                <clipPath id={clip}>
                  <rect
                    x="-150"
                    y={40 - 240 * build}
                    width="300"
                    height={240 * build}
                  />
                </clipPath>
              </defs>
              <ellipse
                cy="15"
                rx={95 * clamp(build * 4)}
                ry="17"
                fill="#376a36"
                opacity=".15"
              />
              <g clip-path={`url(#${clip})`}>
                <ProjectArt
                  kind={project.kind}
                  night={night}
                  summer={summer}
                  variant={i}
                />
              </g>
              {build < 1 && (
                <g opacity={clamp((1 - build) * 5)}>
                  <path
                    d="M-65 4V-39M65 4V-39M-65-21H65"
                    stroke="#c4ab78"
                    stroke-width="3"
                    stroke-dasharray="7 3"
                  />
                  <Villager
                    x={55}
                    y={25}
                    seed={Math.floor(noise(i, seed) * 100)}
                    working
                  />
                </g>
              )}
            </g>
          );
        },
      )}
    </g>
  );
}
