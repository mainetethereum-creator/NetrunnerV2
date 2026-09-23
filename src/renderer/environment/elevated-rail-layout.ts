import { eastGroundHeight } from './east-district-layout.ts';
/** The live line leaves eastwards; the former southbound viaduct is a ruin. */
const DECK_Y = 12.6;
const START_X = -16;
const REAR_Z = -28.5;
const EXIT_ANGLE = 35 * Math.PI / 180;
export const RAIL_BEND = {
  radius: 32,
  angle: EXIT_ANGLE,
  // Delay the bend by 8 m so the full-width deck and coaches clear the east
  // portrait tower, including its rear facade at z=-24.04.
  start: 36,
  end: 36 + 32 * EXIT_ANGLE,
} as const;
export const EAST_RAIL_BEND = { start: 60, radius: 32, end: 60 + 32 * (Math.PI / 2 - EXIT_ANGLE) } as const;
export const RAIL_FORK = { start: 60, end: 84, brokenEnd: 80, abandonedPiers: [78, 96, 114, 132] } as const;

export type RailRouteSample = { x: number; z: number; yaw: number };

function rearLine(distance: number): RailRouteSample {
  return { x: START_X + distance, z: REAR_Z, yaw: 0 };
}

function bend(distance: number): RailRouteSample {
  const angle = (distance - RAIL_BEND.start) / RAIL_BEND.radius;
  return {
    x: START_X + RAIL_BEND.start + RAIL_BEND.radius * Math.sin(angle),
    z: REAR_Z + RAIL_BEND.radius * (1 - Math.cos(angle)),
    yaw: -angle,
  };
}

function metroExit(distance: number): RailRouteSample {
  const end = bend(RAIL_BEND.end);
  const tail = distance - RAIL_BEND.end;
  return {
    x: end.x + tail * Math.cos(EXIT_ANGLE),
    z: end.z + tail * Math.sin(EXIT_ANGLE),
    yaw: -EXIT_ANGLE,
  };
}

/** Distance is true metres along the route. The visible line begins behind the
 * portrait tower, stays behind both towers, then makes one restrained turn
 * before continuing east past the fork. Local +X follows the route and +Z its right normal. */
export function sampleRailRoute(distance: number): RailRouteSample {
  const metres = Number.isFinite(distance) ? distance : 0;
  if (metres <= RAIL_BEND.start) return rearLine(metres);
  if (metres <= RAIL_BEND.end) return bend(metres);
  return metroExit(metres);
}

/** Frozen old alignment: used only for the broken spur and retained columns. */
export function sampleAbandonedRailRoute(distance: number): RailRouteSample {
  const metres = Number.isFinite(distance) ? distance : 0;
  if (metres <= EAST_RAIL_BEND.start) return sampleRailRoute(metres);
  const start = metroExit(EAST_RAIL_BEND.start);
  const angle = EXIT_ANGLE
    + (Math.min(metres, EAST_RAIL_BEND.end) - EAST_RAIL_BEND.start) / EAST_RAIL_BEND.radius;
  return {
    x: start.x + EAST_RAIL_BEND.radius * (Math.sin(angle) - Math.sin(EXIT_ANGLE)),
    z: start.z + EAST_RAIL_BEND.radius * (Math.cos(EXIT_ANGLE) - Math.cos(angle))
      + Math.max(0, metres - EAST_RAIL_BEND.end),
    yaw: -angle,
  };
}

export const ELEVATED_RAIL = {
  z: 0,
  trackYaw: 0,
  deckY: DECK_Y,
  deckLength: 8,
  deckWidth: 4.4,
  // The Blender junction fills 60..84 m; no duplicate decks at the Y switch.
  deckCentres: [...Array.from({ length: 8 }, (_, index) => index * 8), 88, 96, 104, 112, 120],
  pierCentres: [0, 18, 36, 54, 78, 98, 118],
  pierOffsetZ: -3,
  trainY: DECK_Y + .1773,
  carLength: 9.66,
  carSpacing: 10.5,
  initialX: 42,
  speed: 7,
  // The complete three-car train clears either end before wrapping.
  loopStart: -14,
  loopEnd: 170,
} as const;

export function railSupportPoses() {
  const supports = [
    ...ELEVATED_RAIL.pierCentres.map(distance => ({ distance, abandoned: false })),
    ...RAIL_FORK.abandonedPiers.map(distance => ({ distance, abandoned: true })),
  ];
  return supports.map(({ distance, abandoned }) => {
    const point = (abandoned ? sampleAbandonedRailRoute : sampleRailRoute)(distance);
    const x = point.x + ELEVATED_RAIL.pierOffsetZ * Math.sin(point.yaw);
    const z = point.z + ELEVATED_RAIL.pierOffsetZ * Math.cos(point.yaw);
    return { x, z, y: distance <= 60 ? 0 : eastGroundHeight(x, z), yaw: point.yaw, distance, abandoned };
  });
}

/** Conservative world-space rectangles around live AND abandoned support feet. */
export function railPierFootprints(): { x: number; z: number; w: number; d: number }[] {
  return railSupportPoses().map(point => {
    const cos = Math.cos(point.yaw);
    const sin = Math.sin(point.yaw);
    return {
      x: point.x,
      z: point.z,
      w: Math.abs(cos) * 2.85 + Math.abs(sin) * 3,
      d: Math.abs(sin) * 2.85 + Math.abs(cos) * 3,
    };
  });
}

export const ELEVATED_RAIL_PERIOD =
  (ELEVATED_RAIL.loopEnd - ELEVATED_RAIL.loopStart) / ELEVATED_RAIL.speed;

/** The legacy name returns metres along the route, not world X. */
export function elevatedTrainX(elapsedSeconds: number, reducedMotion = false): number {
  if (reducedMotion || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return ELEVATED_RAIL.initialX;
  const span = ELEVATED_RAIL.loopEnd - ELEVATED_RAIL.loopStart;
  const distance = (elapsedSeconds % ELEVATED_RAIL_PERIOD) * ELEVATED_RAIL.speed;
  return ELEVATED_RAIL.loopStart
    + (ELEVATED_RAIL.initialX - ELEVATED_RAIL.loopStart + distance) % span;
}
