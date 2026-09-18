import * as T from 'three';
import { COLLIDERS, setBaseAuthoredCollider } from './world.ts';
import type { Entry } from '../world-editor/document.ts';

/** Stable authored collider ownership; edits replace rather than stack on it. */
export const BASE_COLLIDER_OWNERS: Record<string, number[]> = {
  'base:workshop': [0], 'base:oracle': [1], 'base:metro': [2],
  'base:city-gate': [3], 'base:market': [4], 'base:planter-west': [5],
  'base:planter-east': [6], 'base:battery': [7], 'base:contracts': [8],
  'base:rail-north': [9], 'base:rail-south': [10], 'base:charge-back': [11],
  'base:charge-east': [12], 'base:charge-front': [13],
  'base:charge-door-north': [14], 'base:charge-door-south': [15],
  'base:charge-dock': [16],
  'base:media-tower': [17],
};

export function bindBaseColliderEdit(id: string, object: T.Object3D) {
  const indices = BASE_COLLIDER_OWNERS[id] ?? [];
  if (!indices.length) return () => {};
  object.updateMatrixWorld(true);
  const inverse = object.matrixWorld.clone().invert();
  const original = object.matrixWorld.clone();
  return (entry: Entry) => {
    // Only this owner's matrix is needed to transform the original footprint.
    object.updateWorldMatrix(true, false);
    const delta = object.matrixWorld.clone().multiply(inverse);
    for (const index of indices) {
      if (entry.deleted) { setBaseAuthoredCollider(index, []); continue; }
      if (object.matrixWorld.equals(original)) { setBaseAuthoredCollider(index, null); continue; }
      const rect = COLLIDERS[index];
      const bounds = new T.Box3(
        new T.Vector3(rect.x - rect.w / 2, .08, rect.z - rect.d / 2),
        new T.Vector3(rect.x + rect.w / 2, 1.88, rect.z + rect.d / 2),
      ).applyMatrix4(delta);
      setBaseAuthoredCollider(index, bounds.max.y < .08 || bounds.min.y > 1.88 ? [] : [{
        x: (bounds.min.x + bounds.max.x) / 2, z: (bounds.min.z + bounds.max.z) / 2,
        w: bounds.max.x - bounds.min.x, d: bounds.max.z - bounds.min.z,
      }]);
    }
  };
}
