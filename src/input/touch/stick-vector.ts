/** Dead zone prevents accidental drift; radial clamp keeps diagonal speed equal. */
export function stickVector(x: number, y: number, radius: number) {
  const length = Math.hypot(x, y), strength = Math.min(1, length / Math.max(1, radius));
  if (strength < .12 || !Number.isFinite(length)) return { x: 0, z: 0 };
  const magnitude = (strength - .12) / .88;
  return { x: x / length * magnitude, z: y / length * magnitude };
}
