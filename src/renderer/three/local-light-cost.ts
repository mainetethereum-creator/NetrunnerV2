import * as T from 'three';

const INCLUDE = '#include <lights_fragment_begin>';
const DIRECT_CALL = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const CACHE_SUFFIX = '|local-light-visible-v1';

/** Patch only the point and spot sections in the known three.js lighting chunk. */
export function guardedLocalLightChunk(chunk: string): string | null {
  const point = chunk.indexOf('#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )');
  const spot = chunk.indexOf('#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )');
  const directional = chunk.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )');
  if (point < 0 || spot <= point || directional <= spot) return null;
  const before = chunk.slice(0, point);
  const pointBlock = chunk.slice(point, spot);
  const spotBlock = chunk.slice(spot, directional);
  const after = chunk.slice(directional);
  const guard = (block: string) => {
    if (block.split(DIRECT_CALL).length !== 2 || block.includes(`if ( directLight.visible ) { ${DIRECT_CALL} }`)) return null;
    return block.replace(DIRECT_CALL, `if ( directLight.visible ) { ${DIRECT_CALL} }`);
  };
  const guardedPoint = guard(pointBlock), guardedSpot = guard(spotBlock);
  if (!guardedPoint || !guardedSpot) return null;
  return before + guardedPoint + guardedSpot + after;
}

/** Opt-in per-material guard, leaving the global ShaderChunk and sun path intact. */
export function createLocalLightOptimizer() {
  const applied = new WeakSet<T.MeshStandardMaterial>();
  const guardedChunk = guardedLocalLightChunk(T.ShaderChunk.lights_fragment_begin);
  return {
    supported: guardedChunk !== null,
    apply(root: T.Object3D): number {
      if (!guardedChunk) return 0;
      let count = 0;
      root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!(material instanceof T.MeshStandardMaterial) || applied.has(material)) continue;
          const originalCompile = material.onBeforeCompile;
          // Capture the current value before installing a new hook. Three's
          // default cache key derives from onBeforeCompile.toString().
          const originalKey = material.customProgramCacheKey();
          material.onBeforeCompile = (shader, renderer) => {
            originalCompile.call(material, shader, renderer);
            if (shader.fragmentShader.includes(INCLUDE)) {
              shader.fragmentShader = shader.fragmentShader.replace(INCLUDE, guardedChunk);
            }
          };
          material.customProgramCacheKey = () => `${originalKey}${CACHE_SUFFIX}`;
          material.needsUpdate = true;
          applied.add(material);
          count++;
        }
      });
      return count;
    },
  };
}
