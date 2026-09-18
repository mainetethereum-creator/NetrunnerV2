/** World-space transit route. Distances are metres along the centreline, not X. */
const DECK_Y = 13.2;
const ARC_RADIUS = 24;
const ARC_LENGTH = Math.PI * ARC_RADIUS / 2;
const APPROACH_STEPS = 768;

export type RailRouteSample = { x: number; z: number; yaw: number };

/** The incoming line passes behind the advertising tower, then turns south
 * through the gap west of the directorate. Its end tangent meets the arc. */
function approach(t: number): RailRouteSample {
  const u = 1 - t;
  const x = u ** 3 * -80 + 3 * u * u * t * -33 + 3 * u * t * t * -3 + t ** 3 * -3;
  const z = u ** 3 * -65 + 3 * u * u * t * -65 + 3 * u * t * t * -47 + t ** 3 * -21;
  const dx = 3 * u * u * 47 + 6 * u * t * 30;
  const dz = 6 * u * t * 18 + 3 * t * t * 26;
  return { x, z, yaw: -Math.atan2(dz, dx) };
}

// A short monotonic inverse arc-length table keeps train speed constant without
// a renderer dependency or per-frame integration. Positions/tangents are still
// evaluated on the original curve, so subdivided deck joints share exact points.
const approachLengths = [0];
let previousApproach = approach(0);
for (let index = 1; index <= APPROACH_STEPS; index++) {
  const point = approach(index / APPROACH_STEPS);
  approachLengths.push(approachLengths[index - 1]
    + Math.hypot(point.x - previousApproach.x, point.z - previousApproach.z));
  previousApproach = point;
}
const APPROACH_LENGTH = approachLengths[APPROACH_STEPS];

/** +X is forward in the Blender train; its yaw therefore negates the XZ angle.
 * Local +Z is (sin(yaw), cos(yaw)) in XZ, including cantilever/rail offsets.
 * Straight tails let every coach leave the scene before the loop wraps. */
export function sampleRailRoute(distance: number): RailRouteSample {
  const metres = Number.isFinite(distance) ? distance : 0;
  if (metres < -APPROACH_LENGTH) {
    return { x: -80 + metres + APPROACH_LENGTH, z: -65, yaw: 0 };
  }
  if (metres < 0) {
    const target = metres + APPROACH_LENGTH;
    let low = 0;
    let high = APPROACH_STEPS;
    while (high - low > 1) {
      const middle = (low + high) >>> 1;
      if (approachLengths[middle] <= target) low = middle;
      else high = middle;
    }
    const fraction = (target - approachLengths[low]) / (approachLengths[high] - approachLengths[low]);
    return approach((low + fraction) / APPROACH_STEPS);
  }
  if (metres < ARC_LENGTH) {
    const angle = Math.PI - metres / ARC_RADIUS;
    return {
      x: 21 + ARC_RADIUS * Math.cos(angle),
      z: -21 + ARC_RADIUS * Math.sin(angle),
      yaw: Math.PI / 2 - angle,
    };
  }
  return { x: 21 + metres - ARC_LENGTH, z: 3, yaw: 0 };
}

export const ELEVATED_RAIL = {
  // Placements are already world-space; retain a neutral root transform.
  z: 0,
  trackYaw: 0,
  deckY: DECK_Y,
  deckLength: 8,
  deckWidth: 4.4,
  deckCentres: Array.from({ length: 26 }, (_, index) => -92 + index * 8),
  // On-pad cantilevers sit beside the line, clear of doors and buildings.
  pierCentres: [-96, -72, -48, -24, 0, 24, 44, 68, 92, 108],
  pierOffsetZ: -3,
  // Rail top is deckY + .19; the low-poly wheel's lowest vertex is .0127253.
  trainY: DECK_Y + .1773,
  carLength: 9.66,
  carSpacing: 9.85,
  initialX: 22,
  speed: 7,
  // Both ends are beyond the complete deck. The trailing cab clears the last
  // support before wrapping; the new leading cab begins before the first one.
  loopStart: -104,
  loopEnd: 140,
} as const;

/** Conservative world-space rectangles around the rotated ground-level feet.
 * Cantilever capitals reach toward the track; only the offset feet block walking. */
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

/** Absolute elapsed time avoids frame-rate-dependent acceleration or pauses.
 * The legacy name is retained for callers; the result is now route distance. */
export function elevatedTrainX(elapsedSeconds: number, reducedMotion = false): number {
  if (reducedMotion || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return ELEVATED_RAIL.initialX;
  }
  const span = ELEVATED_RAIL.loopEnd - ELEVATED_RAIL.loopStart;
  const distance = (elapsedSeconds % ELEVATED_RAIL_PERIOD) * ELEVATED_RAIL.speed;
  return ELEVATED_RAIL.loopStart
    + (ELEVATED_RAIL.initialX - ELEVATED_RAIL.loopStart + distance) % span;
}
