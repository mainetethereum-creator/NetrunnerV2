/** Short world-space guideway behind the portrait and Coinbase towers. */
const DECK_Y = 12.6;
const START_X = -16;
const REAR_Z = -28.5;
const EXIT_ANGLE = 35 * Math.PI / 180;
export const RAIL_BEND = {
  radius: 32,
  angle: EXIT_ANGLE,
  start: 28,
  end: 28 + 32 * EXIT_ANGLE,
} as const;

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
 * toward the metro on the right. Local +X follows the route and +Z its right normal. */
export function sampleRailRoute(distance: number): RailRouteSample {
  const metres = Number.isFinite(distance) ? distance : 0;
  if (metres <= RAIL_BEND.start) return rearLine(metres);
  if (metres <= RAIL_BEND.end) return bend(metres);
  return metroExit(metres);
}

export const ELEVATED_RAIL = {
  z: 0,
  trackYaw: 0,
  deckY: DECK_Y,
  deckLength: 8,
  deckWidth: 4.4,
  // Eight modules make one compact city fragment instead of a horizon-wide line.
  deckCentres: Array.from({ length: 8 }, (_, index) => index * 8),
  pierCentres: [0, 18, 36, 54],
  pierOffsetZ: -3,
  trainY: DECK_Y + .1773,
  carLength: 9.66,
  carSpacing: 10.5,
  initialX: 42,
  speed: 7,
  // The complete three-car train clears either end before wrapping.
  loopStart: -14,
  loopEnd: 88,
} as const;

/** Conservative world-space rectangles around the grounded support feet. */
export function railPierFootprints(): { x: number; z: number; w: number; d: number }[] {
  return ELEVATED_RAIL.pierCentres.map(distance => {
    const point = sampleRailRoute(distance);
    const cos = Math.cos(point.yaw);
    const sin = Math.sin(point.yaw);
    return {
      x: point.x + ELEVATED_RAIL.pierOffsetZ * sin,
      z: point.z + ELEVATED_RAIL.pierOffsetZ * cos,
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
