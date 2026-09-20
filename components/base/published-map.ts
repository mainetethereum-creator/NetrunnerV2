import * as T from 'three';
import { createEditableRender, type EditableRenderLabel } from './editable-render.ts';
import { bindBaseColliderEdit } from './editor-colliders.ts';
import { bindMetroOpening, type MetroOpening } from '../../src/renderer/environment/metro-opening.ts';
import { createReferenceBuildingLibrary } from '../../src/renderer/three/reference-building-library.ts';
import { REFERENCE_BUILDINGS } from '../../src/assets/reference-buildings.ts';
import { createBuildingLibrary, BUILDING_PROPS } from '../expedition/building-props.ts';
import { BASE_PUBLISHED_LAYOUT } from '../../src/assets/base-published-layout.ts';
import type { Entry } from '../world-editor/document.ts';

/** Immutable release scenery. No editor controller, catalogue UI or browser storage. */
export function createPublishedMap(options: {
  scene: T.Scene;
  sources: T.Object3D[];
  rendered: T.Object3D[];
  labels: Map<T.Object3D, EditableRenderLabel>;
  instanceLabels: Map<T.InstancedMesh, readonly EditableRenderLabel[]>;
  npcs: { id: string; object: T.Object3D; onTransform: (entry: Entry) => void }[];
  onColliders: (rects: { x: number; z: number; w: number; d: number }[]) => void;
  onFloorVisibility: (visible: boolean) => void;
  onMetroTransform: MetroOpening['update'];
  onAssetsChanged: () => void;
}) {
  const render = createEditableRender(options.scene, options.sources, options.rendered, options.labels, options.instanceLabels);
  render.setActive(true);
  const references = createReferenceBuildingLibrary(4,undefined,undefined,undefined,true);
  const buildings = createBuildingLibrary(4, options.onAssetsChanged);
  const placements: T.Object3D[] = [];
  let disposed = false;
  const authored = new Map<string, { object: T.Object3D; onTransform: (entry: Entry) => void }>(render.authored.map(item => {
    const collider = bindBaseColliderEdit(item.id, item.object);
    const opening = item.id === 'base:metro' ? bindMetroOpening(item.object, options.onMetroTransform) : undefined;
    return [item.id, { object: item.object, onTransform(entry: Entry) {
      collider(entry);
      opening?.(!!entry.deleted);
      if (item.id === 'base:floor') options.onFloorVisibility(!entry.deleted);
    } }];
  }));
  for (const npc of options.npcs) authored.set(npc.id, npc);
  function transform(object: T.Object3D, entry: Entry) {
    object.position.set(entry.x, entry.y, entry.z);
    object.rotation.set(entry.rx * Math.PI / 180, entry.rotation * Math.PI / 180, entry.rz * Math.PI / 180);
    object.scale.set(entry.sx, entry.sy, entry.sz);
    object.visible = !entry.deleted;
    object.userData.editorDeleted = !!entry.deleted;
    object.matrixAutoUpdate = true;
    object.updateMatrix();
    object.updateMatrixWorld(true);
  }
  const ready = (async () => {
    const rects: { x: number; z: number; w: number; d: number }[] = [];
    // Sequential preparation limits peak decode/geometry work on phones.
    for (const entry of BASE_PUBLISHED_LAYOUT.entries) {
      if (disposed) return;
      const original = authored.get(entry.id);
      if (original) {
        transform(original.object, entry);
        original.onTransform(entry);
        continue;
      }
      if (entry.deleted) continue;
      const reference = REFERENCE_BUILDINGS.find(asset => asset.id === entry.source);
      const building = BUILDING_PROPS.find(asset => asset.id === entry.source);
      let object: T.Object3D;
      if (reference) {
        await references.prepare(reference.id);
        if (disposed) return;
        object = references.create(reference.id);
      } else if (building) object = buildings.create(building.id);
      else throw new Error(`Unknown published Base object: ${entry.id} (${entry.source})`);
      placements.push(object);
      options.scene.add(object);
      transform(object, entry);
      const bounds = new T.Box3().setFromObject(object);
      if (!bounds.isEmpty() && bounds.max.y >= .08 && bounds.min.y <= 1.88) rects.push({
        x: (bounds.min.x + bounds.max.x) / 2, z: (bounds.min.z + bounds.max.z) / 2,
        w: bounds.max.x - bounds.min.x, d: bounds.max.z - bounds.min.z,
      });
    }
    if (disposed) return;
    options.onColliders(rects);
    render.setActive(false);
    options.onAssetsChanged();
  })();
  return { ready, dispose() {
    if (disposed) return;
    disposed = true;
    placements.forEach(object => object.removeFromParent());
    render.dispose();
    references.dispose();
    buildings.dispose();
  } };
}
