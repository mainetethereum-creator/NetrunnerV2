import * as T from 'three';

/** Interior of the authored retaining shell, excluding its walls. These planes
 * cut only ground materials; the existing stair/deck/landing meshes stay solid. */
export const METRO_OPENING = { west: 5.065, east: 11.935, north: -10.73, south: -5.62 } as const;

export function createMetroOpening() {
  const original = [
    new T.Plane(new T.Vector3(-1, 0, 0), METRO_OPENING.west),
    new T.Plane(new T.Vector3(1, 0, 0), -METRO_OPENING.east),
    new T.Plane(new T.Vector3(0, 0, -1), METRO_OPENING.north),
    new T.Plane(new T.Vector3(0, 0, 1), -METRO_OPENING.south),
  ];
  const planes = original.map(plane => plane.clone());
  const copies = new WeakMap<T.Material, T.Material>();

  function apply<M extends T.Material>(material: M): M {
    material.clippingPlanes = planes;
    material.clipIntersection = true;
    material.clipShadows = true;
    material.needsUpdate = true;
    return material;
  }

  return {
    planes,
    apply,
    /** Preserve PBR hooks and shared textures. Scene teardown owns these copies. */
    material<M extends T.Material>(source: M): M {
      let copy = copies.get(source);
      if (!copy) {
        copy = source.clone();
        copy.name = `${source.name || source.type} / metro ground opening`;
        copy.onBeforeCompile = source.onBeforeCompile;
        copy.customProgramCacheKey = source.customProgramCacheKey.bind(source);
        copies.set(source, apply(copy));
      }
      return copy as M;
    },
    /** Delta from the pristine authored metro, not its recentered editor pivot.
     * Delete closes the hole; undo/restore updates the same plane objects. */
    update(delta: T.Matrix4, visible: boolean) {
      for (let index = 0; index < planes.length; index++) {
        if (visible) planes[index].copy(original[index]).applyMatrix4(delta);
        else planes[index].setComponents(0, 0, 0, 1);
      }
    },
  };
}

export type MetroOpening = ReturnType<typeof createMetroOpening>;

/** Capture before any saved transform is applied. No per-frame world traversal. */
export function bindMetroOpening(object: T.Object3D, update: MetroOpening['update']) {
  object.updateWorldMatrix(true, false);
  const inverse = object.matrixWorld.clone().invert();
  const delta = new T.Matrix4();
  return (deleted: boolean) => {
    object.updateWorldMatrix(true, false);
    update(delta.copy(object.matrixWorld).multiply(inverse), !deleted);
  };
}
