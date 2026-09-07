import type { CSSProperties } from "react";
import sailsSvg from "../../assets/windmill-sails.svg?raw";
import towerSvg from "../../assets/windmill-tower.svg?raw";
import { InlineSvg } from "../media/inline-svg";

/**
 * The tower is 200x300 units with the axle at (100, 70); the sails file is 280
 * units square, centred on that axle. Sizing the sails as a fraction of the
 * tower and offsetting them onto the axle keeps the two in register at any
 * size — hence the ratios below rather than eyeballed pixels.
 */
const SAILS_WIDTH_RATIO = 280 / 200;
const SAILS_HEIGHT_RATIO = 280 / 300;
const AXLE_X_RATIO = 100 / 200;
const AXLE_Y_RATIO = 70 / 300;

const percent = (value: number) => `${value * 100}%`;

interface Props {
  className?: string;
  style?: CSSProperties;
}

export function Windmill({ className = "", style }: Props) {
  return (
    <div
      className={`pointer-events-none absolute aspect-[2/3] ${className}`}
      style={style}
    >
      <InlineSvg
        className="absolute inset-0 h-full w-full"
        decorative
        svg={towerSvg}
      />
      <div
        className="absolute"
        style={{
          height: percent(SAILS_HEIGHT_RATIO),
          left: percent(AXLE_X_RATIO - SAILS_WIDTH_RATIO / 2),
          top: percent(AXLE_Y_RATIO - SAILS_HEIGHT_RATIO / 2),
          transform: "rotate(var(--hs-sail-angle, 0deg))",
          width: percent(SAILS_WIDTH_RATIO),
        }}
      >
        <InlineSvg className="h-full w-full" decorative svg={sailsSvg} />
      </div>
    </div>
  );
}
