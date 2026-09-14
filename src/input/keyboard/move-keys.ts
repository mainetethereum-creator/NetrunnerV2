// Keyboard movement bindings. Keys are stored the way the scenes read them:
// `KeyboardEvent.key.toLowerCase()` ("w", "arrowup", "shift", …).

export interface MoveKeyBindings {
  /** Screen right (+x). */
  readonly right: readonly string[];
  /** Screen left (−x). */
  readonly left: readonly string[];
  /** Towards the camera / screen down (+y). */
  readonly back: readonly string[];
  /** Away from the camera / screen up (−y). */
  readonly forward: readonly string[];
}

/** WASD and arrow keys, as used by every scene. */
export const MOVE_KEYS: MoveKeyBindings = {
  right: ["d", "arrowright"],
  left: ["a", "arrowleft"],
  back: ["s", "arrowdown"],
  forward: ["w", "arrowup"],
};

/** Expedition MASTER camera panning additionally treats Q as "back". */
export const EDITOR_PAN_KEYS: MoveKeyBindings = { ...MOVE_KEYS, back: ["s", "q", "arrowdown"] };

export const RUN_KEY = "shift";

/** −1, 0 or +1: whether any positive key minus whether any negative key is held. */
export function keyAxis(keys: ReadonlySet<string>, positive: readonly string[], negative: readonly string[]): number {
  return (positive.some((key) => keys.has(key)) ? 1 : 0) - (negative.some((key) => keys.has(key)) ? 1 : 0);
}
