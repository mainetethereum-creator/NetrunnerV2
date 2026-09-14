// Movement input shared by the scenes: held keys plus the on-screen stick, resolved
// into a world-space direction relative to the fixed isometric camera.
//
// The arithmetic is kept in exactly the order the scenes used, so results are
// bit-identical (`tests/input.test.mjs` compares against the original formula).
// Whether the player may move, walk/run speeds and editor panning stay in the scenes.

import { keyAxis, MOVE_KEYS, RUN_KEY, type MoveKeyBindings } from "./keyboard/move-keys.ts";

export interface MoveDirection {
  x: number;
  z: number;
}

export interface MovementInput {
  /** Held keys as `KeyboardEvent.key.toLowerCase()`. */
  readonly keys: Set<string>;
  /** Stick deflection in screen space: x right, y towards the camera; each in [−1, 1]. */
  readonly stick: { x: number; y: number };
  /** True while the run key is held. */
  readonly running: boolean;
  /** Sets the stick; non-finite values become 0 and values are clamped to [−1, 1]. */
  setStick(x: number, y: number): void;
  clearStick(): void;
  /** Releases all keys and centres the stick. */
  clear(): void;
  /**
   * Writes the camera-relative world direction (length ≤ 1) into `out` and returns
   * true when the combined key + stick input exceeds `deadZone`; otherwise returns
   * false and leaves `out` untouched.
   */
  resolve(out: MoveDirection, azimuth: number, deadZone: number, bindings?: MoveKeyBindings): boolean;
}

const clampUnit = (value: number) => (Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0);

export function createMovementInput(): MovementInput {
  const keys = new Set<string>();
  const stick = { x: 0, y: 0 };
  return {
    keys,
    stick,
    get running() {
      return keys.has(RUN_KEY);
    },
    setStick(x, y) {
      stick.x = clampUnit(x);
      stick.y = clampUnit(y);
    },
    clearStick() {
      stick.x = stick.y = 0;
    },
    clear() {
      keys.clear();
      stick.x = stick.y = 0;
    },
    resolve(out, azimuth, deadZone, bindings = MOVE_KEYS) {
      let sx = keyAxis(keys, bindings.right, bindings.left) + stick.x;
      let sy = keyAxis(keys, bindings.back, bindings.forward) + stick.y;
      const length = Math.hypot(sx, sy);
      if (!(length > deadZone)) return false;
      sx /= Math.max(1, length);
      sy /= Math.max(1, length);
      out.x = sx * Math.cos(azimuth) + sy * Math.sin(azimuth);
      out.z = -sx * Math.sin(azimuth) + sy * Math.cos(azimuth);
      return true;
    },
  };
}
