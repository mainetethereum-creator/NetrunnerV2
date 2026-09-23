import * as T from 'three';

const FALL_SPEED = 9;
const RESET_HEIGHT = 15;
const INITIAL_HEIGHT = 16;
const STREAK_HEIGHT = .35;

/** Base height of a streak after continuous fall and a shared height wrap. */
export function rainHeight(initialY: number, travel: number): number {
  const remaining = initialY - travel;
  return remaining >= 0 ? remaining : ((remaining % RESET_HEIGHT) + RESET_HEIGHT) % RESET_HEIGHT;
}

/** Ambient Base rain. The scene owns the returned mesh and disposes its tree. */
export function createAmbientRain(count: number, random: () => number) {
  const positions = new Float32Array(count * 6);
  const baseHeights = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (random() - .5) * 64;
    const y = random() * INITIAL_HEIGHT;
    const z = random() * 48 - 14;
    positions.set([x, y, z, x - .06, y + STREAK_HEIGHT, z], i * 6);
    baseHeights[i * 2] = y;
    baseHeights[i * 2 + 1] = y;
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('rainBaseY', new T.BufferAttribute(baseHeights, 1));
  const travel = { value: 0 };
  const material = new T.LineBasicMaterial({ color: 0xb9d8d8, transparent: true, opacity: .085, depthWrite: false });
  const originalCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    originalCompile.call(material, shader, renderer);
    shader.uniforms.rainTravel = travel;
    shader.vertexShader = `attribute float rainBaseY;\nuniform float rainTravel;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float baseY = rainBaseY - rainTravel;
       if (baseY < 0.0) baseY = mod(baseY, ${RESET_HEIGHT.toFixed(1)});
       transformed.y = baseY + position.y - rainBaseY;`,
    );
  };
  material.customProgramCacheKey = () => 'base-ambient-rain-v1';
  const mesh = new T.LineSegments(geometry, material);
  // Dynamic wrap reaches up to the initial 16 m height; skip stale CPU bounds.
  mesh.frustumCulled = false;

  let distance = 0;
  return {
    mesh,
    geometry,
    update(dt: number) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      distance += dt * FALL_SPEED;
      // Keep the shader uniform small during long sessions. The 15 m cycle is
      // valid after every streak has passed its first (up to 16 m) drop.
      travel.value = distance <= INITIAL_HEIGHT ? distance : INITIAL_HEIGHT + ((distance - INITIAL_HEIGHT) % RESET_HEIGHT);
    },
  };
}
