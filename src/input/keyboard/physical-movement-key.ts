const PHYSICAL_MOVEMENT: Readonly<Record<string, string>> = {
  KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d",
  ArrowUp: "arrowup", ArrowLeft: "arrowleft",
  ArrowDown: "arrowdown", ArrowRight: "arrowright",
  ShiftLeft: "shift", ShiftRight: "shift",
};
const FALLBACK_MOVEMENT = new Set(Object.values(PHYSICAL_MOVEMENT));

/** Physical WASD works on non-Latin layouts too. Same normalization on keyup
 * prevents stuck movement if the keyboard layout changes while a key is held.
 * The scene still owns focus, modifier, modal and editor gating.
 */
export function physicalMovementKey(event: { code: string; key: string }): string | null {
  const physical = PHYSICAL_MOVEMENT[event.code];
  if (physical) return physical;
  // A different known physical key must not become WASD on an alternate layout.
  if (event.code && event.code !== "Unidentified") return null;
  const key = event.key.toLowerCase();
  return FALLBACK_MOVEMENT.has(key) ? key : null;
}
