// Isometric follow camera shared by the scene engines (base, expedition, metro).
//
// The camera looks at a pivot that eases towards a target above the player and sits
// at a fixed azimuth and pitch; the distance depends on portrait/landscape and on the
// MASTER editor zoom. The arithmetic keeps the exact order of the per-scene code it
// replaced (three.js `Vector3.lerp` / `distanceToSquared`), so results are
// bit-identical — `tests/camera.test.mjs` compares both.
//
// No three.js import: scenes pass their own Vector3 as the pivot (editors and
// streaming read it) and the camera position as the output of `place`.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec3Output {
  set(x: number, y: number, z: number): unknown;
}

export interface EditorZoom {
  initial: number;
  min: number;
  max: number;
}

/** MASTER editor panning: speed in m/s and the pivot bounds. */
export interface EditorPan {
  speed: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface FollowCameraPreset {
  azimuth: number;
  /** Distance from the pivot in landscape. */
  distance: number;
  /** Distance from the pivot when the viewport aspect is below `PORTRAIT_ASPECT`. */
  portraitDistance: number;
  /** Exponential pivot damping per second. */
  damping: number;
  /** The pivot snaps onto the target below this squared distance; `null` never snaps. */
  snapDistanceSquared: number | null;
  editorZoom: EditorZoom | null;
  editorPan: EditorPan | null;
}

export const PORTRAIT_ASPECT = 0.85;
/** Wheel `deltaY` → editor zoom distance. */
export const WHEEL_ZOOM_SCALE = 0.015;

export const BASE_CAMERA: FollowCameraPreset = {
  azimuth: 0.48,
  distance: 25,
  portraitDistance: 32,
  damping: 8,
  snapDistanceSquared: 0.000001,
  editorZoom: { initial: 28, min: 8, max: 65 },
  editorPan: null,
};

export const EXPEDITION_CAMERA: FollowCameraPreset = {
  azimuth: 0.48,
  distance: 22,
  portraitDistance: 28,
  damping: 8,
  snapDistanceSquared: null,
  editorZoom: { initial: 22, min: 5, max: 42 },
  editorPan: { speed: 12, minX: 0, maxX: 144, minZ: 0, maxZ: 72 },
};

export const METRO_CAMERA: FollowCameraPreset = {
  azimuth: 0.48,
  distance: 22,
  portraitDistance: 28,
  damping: 8,
  snapDistanceSquared: null,
  editorZoom: null,
  editorPan: null,
};

export interface FollowCamera {
  readonly azimuth: number;
  /** The scene's pivot object, mutated in place. */
  readonly pivot: Vec3;
  /** The last target passed to `follow`. */
  readonly target: Readonly<Vec3>;
  /** Current editor zoom distance. */
  readonly zoom: number;
  /** Eases the pivot towards the target (instantly with reduced motion). */
  follow(x: number, y: number, z: number, dt: number, reducedMotion: boolean): void;
  /** Moves the pivot onto the last target ("Reset camera"). */
  snapToTarget(): void;
  distance(aspect: number, editorActive: boolean): number;
  /** Writes the camera position for the current pivot; the scene then calls `lookAt(pivot)`. */
  place(out: Vec3Output, aspect: number, editorActive: boolean): void;
  /** Editor wheel zoom; no-op for presets without `editorZoom`. */
  zoomBy(deltaY: number): void;
  /** Editor panning by a direction over `dt`; no-op without `editorPan`. */
  pan(dx: number, dz: number, dt: number): void;
  /** Editor panning by a world offset (tree editor); no-op without `editorPan`. */
  nudge(x: number, z: number): void;
  /** Moves the pivot to a world point on the ground plane (tree editor focus). */
  moveTo(x: number, z: number): void;
}

// Same argument order as three.js MathUtils.clamp.
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createFollowCamera(preset: FollowCameraPreset, pivot: Vec3): FollowCamera {
  const target: Vec3 = { x: pivot.x, y: pivot.y, z: pivot.z };
  const { azimuth, editorZoom, editorPan, snapDistanceSquared } = preset;
  let zoom = editorZoom ? editorZoom.initial : preset.distance;

  const distance = (aspect: number, editorActive: boolean) =>
    editorActive && editorZoom ? zoom : aspect < PORTRAIT_ASPECT ? preset.portraitDistance : preset.distance;

  return {
    azimuth,
    pivot,
    target,
    get zoom() {
      return zoom;
    },
    follow(x, y, z, dt, reducedMotion) {
      target.x = x;
      target.y = y;
      target.z = z;
      const alpha = reducedMotion ? 1 : 1 - Math.exp(-dt * preset.damping);
      pivot.x += (target.x - pivot.x) * alpha;
      pivot.y += (target.y - pivot.y) * alpha;
      pivot.z += (target.z - pivot.z) * alpha;
      if (snapDistanceSquared === null) return;
      // End the exponential tail below a subpixel world-space distance.
      const dx = pivot.x - target.x, dy = pivot.y - target.y, dz = pivot.z - target.z;
      if (dx * dx + dy * dy + dz * dz < snapDistanceSquared) {
        pivot.x = target.x;
        pivot.y = target.y;
        pivot.z = target.z;
      }
    },
    snapToTarget() {
      pivot.x = target.x;
      pivot.y = target.y;
      pivot.z = target.z;
    },
    distance,
    place(out, aspect, editorActive) {
      const d = distance(aspect, editorActive);
      out.set(
        pivot.x + Math.sin(azimuth) * d * 0.86,
        pivot.y + d * 0.62,
        pivot.z + Math.cos(azimuth) * d * 0.86,
      );
    },
    zoomBy(deltaY) {
      if (!editorZoom) return;
      zoom = clamp(zoom + deltaY * WHEEL_ZOOM_SCALE, editorZoom.min, editorZoom.max);
    },
    pan(dx, dz, dt) {
      if (!editorPan) return;
      pivot.x = clamp(pivot.x + dx * dt * editorPan.speed, editorPan.minX, editorPan.maxX);
      pivot.z = clamp(pivot.z + dz * dt * editorPan.speed, editorPan.minZ, editorPan.maxZ);
    },
    nudge(x, z) {
      if (!editorPan) return;
      pivot.x = clamp(pivot.x + x, editorPan.minX, editorPan.maxX);
      pivot.z = clamp(pivot.z + z, editorPan.minZ, editorPan.maxZ);
    },
    moveTo(x, z) {
      pivot.x = x;
      pivot.z = z;
    },
  };
}
