import * as T from 'three';

export type EditableRenderLabel = Readonly<{id: string; name: string}>;

export type EditableRenderAuthoredObject = {
  id: string;
  name: string;
  object: T.Group;
};

type SourceState = {
  object: T.Object3D;
  parent: T.Object3D | null;
  index: number;
  matrixAutoUpdate: boolean;
  matrix: T.Matrix4;
  visible: boolean;
};

type Batch = {
  geometry: T.BufferGeometry;
  material: T.Material;
  sample: T.Mesh;
  matrices: T.Matrix4[];
  colors: T.Color[] | null;
};

const worldMatrix = new T.Matrix4();
const inverseMatrix = new T.Matrix4();
const instanceMatrix = new T.Matrix4();
const instanceColor = new T.Color();
const center = new T.Vector3();

function sceneLocalMatrix(scene: T.Scene, world: T.Matrix4) {
  scene.updateMatrixWorld(true);
  inverseMatrix.copy(scene.matrixWorld).invert();
  return new T.Matrix4().multiplyMatrices(inverseMatrix, world);
}

function setExactMatrix(object: T.Object3D, matrix: T.Matrix4, matrixAutoUpdate: boolean) {
  object.matrix.copy(matrix);
  object.matrix.decompose(object.position, object.quaternion, object.scale);
  object.matrixAutoUpdate = matrixAutoUpdate;
  if (matrixAutoUpdate) object.updateMatrix();
}

function addAt(parent: T.Object3D, object: T.Object3D, index: number) {
  parent.add(object);
  const current = parent.children.indexOf(object);
  const target = Math.min(Math.max(index, 0), parent.children.length - 1);
  if (current === target) return;
  parent.children.splice(current, 1);
  parent.children.splice(target, 0, object);
}

function canBatch(mesh: T.Mesh): mesh is T.Mesh<T.BufferGeometry, T.Material> {
  if (mesh instanceof T.SkinnedMesh || mesh instanceof T.InstancedMesh) return false;
  if (Array.isArray(mesh.material) || mesh.material.transparent) return false;
  return true;
}

function isEffectivelyVisible(object: T.Object3D, stop: T.Object3D) {
  for (let node: T.Object3D | null = object; node && node !== stop; node = node.parent) {
    if (!node.visible || node.userData.editorDeleted) return false;
  }
  // The adapter and editor streaming both use the logical root's visibility
  // for culling. Deletion has its own stable flag and is the only root-level
  // visibility state that should affect a rebuilt gameplay proxy.
  return !stop.userData.editorDeleted;
}

function sameBatch(batch: Batch, mesh: T.Mesh<T.BufferGeometry, T.Material>, colored: boolean) {
  const sample = batch.sample;
  return batch.geometry === mesh.geometry
    && batch.material === mesh.material
    && !!batch.colors === colored
    && sample.castShadow === mesh.castShadow
    && sample.receiveShadow === mesh.receiveShadow
    && sample.renderOrder === mesh.renderOrder
    && sample.layers.mask === mesh.layers.mask
    && sample.frustumCulled === mesh.frustumCulled
    && sample.customDepthMaterial === mesh.customDepthMaterial
    && sample.customDistanceMaterial === mesh.customDistanceMaterial
    && sample.onBeforeRender === mesh.onBeforeRender
    && sample.onAfterRender === mesh.onAfterRender;
}

/**
 * Bridges editable Base objects and the draw-call-efficient gameplay scene.
 *
 * Geometry, source materials and textures are always borrowed. The adapter owns
 * only generated instance buffers and inactive-mode light clones. Instanced
 * sources stay instanced in per-entity subsets, preserving instance colors and
 * shaders that depend on instanceMatrix. Animated/skinned content is cloned as a
 * regular render proxy instead of being instanced.
 */
export function createEditableRender(
  scene: T.Scene,
  sources: readonly T.Object3D[],
  rendered: readonly T.Object3D[],
  labels: ReadonlyMap<T.Object3D, EditableRenderLabel>,
  instanceLabels: ReadonlyMap<T.InstancedMesh, readonly EditableRenderLabel[]>,
) {
  const sourceStates = sources.map<SourceState>((object) => ({
    object,
    parent: object.parent,
    index: object.parent?.children.indexOf(object) ?? -1,
    matrixAutoUpdate: object.matrixAutoUpdate,
    matrix: object.matrix.clone(),
    visible: object.visible,
  }));

  for (const source of sources) {
    if (source instanceof T.InstancedMesh) {
      const itemLabels = instanceLabels.get(source);
      if (!itemLabels || itemLabels.length !== source.count) {
        throw new Error(`Editable InstancedMesh "${source.name}" requires one label per instance`);
      }
    } else if (!labels.has(source)) {
      throw new Error(`Editable object "${source.name}" requires a stable label`);
    }
  }

  scene.updateMatrixWorld(true);
  const sourceRoot = new T.Group();
  sourceRoot.name = 'Base editable source objects';
  const renderRoot = new T.Group();
  renderRoot.name = 'Base editable render proxies';
  scene.add(sourceRoot, renderRoot);

  const entries = new Map<string, {label: EditableRenderLabel; parts: T.Object3D[]}>();
  const expandedParts: T.InstancedMesh[] = [];

  function append(label: EditableRenderLabel, part: T.Object3D) {
    const existing = entries.get(label.id);
    if (existing && existing.label.name !== label.name) {
      throw new Error(`Editable label "${label.id}" has conflicting names`);
    }
    const entry = existing ?? {label, parts: []};
    entry.parts.push(part);
    entries.set(label.id, entry);
  }

  for (const source of sources) {
    if (!(source instanceof T.InstancedMesh)) {
      append(labels.get(source)!, source);
      continue;
    }

    const itemLabels = instanceLabels.get(source)!;
    source.updateWorldMatrix(true, false);
    const subsets = new Map<string, {label: EditableRenderLabel; indices: number[]}>();
    itemLabels.forEach((label, index) => {
      const subset = subsets.get(label.id) ?? {label, indices: []};
      if (subset.label.name !== label.name) throw new Error(`Editable label "${label.id}" has conflicting names`);
      subset.indices.push(index);
      subsets.set(label.id, subset);
    });
    for (const subset of subsets.values()) {
      const mesh = new T.InstancedMesh(source.geometry, source.material, subset.indices.length);
      mesh.name = source.name ? `${source.name}:${subset.label.id}` : subset.label.name;
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      mesh.renderOrder = source.renderOrder;
      mesh.frustumCulled = source.frustumCulled;
      mesh.layers.mask = source.layers.mask;
      mesh.onBeforeRender = source.onBeforeRender;
      mesh.onAfterRender = source.onAfterRender;
      mesh.customDepthMaterial = source.customDepthMaterial;
      mesh.customDistanceMaterial = source.customDistanceMaterial;
      subset.indices.forEach((sourceIndex, targetIndex) => {
        source.getMatrixAt(sourceIndex, instanceMatrix);
        mesh.setMatrixAt(targetIndex, instanceMatrix);
        if (source.instanceColor) {
          source.getColorAt(sourceIndex, instanceColor);
          mesh.setColorAt(targetIndex, instanceColor);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      setExactMatrix(mesh, sceneLocalMatrix(scene, source.matrixWorld), false);
      scene.add(mesh);
      expandedParts.push(mesh);
      append(subset.label, mesh);
    }
    source.removeFromParent();
  }

  const authored: EditableRenderAuthoredObject[] = [];
  const templates = new Map<string, T.Group>();
  for (const {label, parts} of entries.values()) {
    scene.updateMatrixWorld(true);
    const bounds = new T.Box3();
    for (const part of parts) bounds.expandByObject(part, true);
    if (bounds.isEmpty()) {
      parts[0].getWorldPosition(center);
    } else {
      bounds.getCenter(center);
      center.y = bounds.min.y;
    }

    const group = new T.Group();
    group.name = label.name;
    group.position.copy(scene.worldToLocal(center.clone()));
    scene.add(group);
    group.updateMatrixWorld(true);
    for (const part of parts) group.attach(part);
    sourceRoot.attach(group);
    group.userData.editableRenderId = label.id;
    authored.push({id: label.id, name: label.name, object: group});
    templates.set(label.id, group);
  }

  const captured = new Set<T.Object3D>();
  sourceRoot.traverse((object) => captured.add(object));
  const renderedStates = rendered
    .filter((object) => object !== scene && !captured.has(object))
    .map((object) => ({object, visible: object.visible}));
  for (const state of renderedStates) state.object.visible = false;

  let active = true;
  let disposed = false;
  let ownedLights: T.Light[] = [];
  let generatedBatches: T.InstancedMesh[] = [];

  function clearRenderRoot() {
    for (const batch of generatedBatches) batch.dispose();
    for (const light of ownedLights) light.dispose();
    generatedBatches = [];
    ownedLights = [];
    renderRoot.clear();
  }

  function rebuild(respectRootVisibility = false) {
    clearRenderRoot();
    scene.updateMatrixWorld(true);
    const sceneInverse = new T.Matrix4().copy(scene.matrixWorld).invert();
    const batches: Batch[] = [];

    function addClone(object: T.Object3D) {
      const clone = object.clone(false);
      clone.matrixAutoUpdate = false;
      clone.matrix.multiplyMatrices(sceneInverse, object.matrixWorld);
      clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
      renderRoot.add(clone);
      if (clone instanceof T.InstancedMesh) generatedBatches.push(clone);
      if (clone instanceof T.Light) {
        ownedLights.push(clone);
        if ((clone instanceof T.DirectionalLight || clone instanceof T.SpotLight) && clone.target) {
          object.updateWorldMatrix(true, false);
          const original = object as T.DirectionalLight | T.SpotLight;
          original.target.updateWorldMatrix(true, false);
          const target = clone.target;
          target.matrixAutoUpdate = false;
          target.matrix.multiplyMatrices(sceneInverse, original.target.matrixWorld);
          target.matrix.decompose(target.position, target.quaternion, target.scale);
          renderRoot.add(target);
        }
      }
    }

    for (const item of authored) {
      const group = item.object;
      if (group.userData.editorDeleted || respectRootVisibility && !group.visible) continue;
      group.traverse((object) => {
        if (object === group || !isEffectivelyVisible(object, group)) return;
        if (object instanceof T.Light) {
          addClone(object);
          return;
        }
        if (object instanceof T.InstancedMesh) {
          if (Array.isArray(object.material) || object.material.transparent) {
            addClone(object);
            return;
          }
          const colored = !!object.instanceColor;
          let batch = batches.find((candidate) => sameBatch(candidate, object, colored));
          if (!batch) {
            batch = {
              geometry: object.geometry,
              material: object.material,
              sample: object,
              matrices: [],
              colors: colored ? [] : null,
            };
            batches.push(batch);
          }
          for (let index = 0; index < object.count; index++) {
            object.getMatrixAt(index, instanceMatrix);
            worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
            batch.matrices.push(new T.Matrix4().multiplyMatrices(sceneInverse, worldMatrix));
            if (batch.colors) {
              object.getColorAt(index, instanceColor);
              batch.colors.push(instanceColor.clone());
            }
          }
          return;
        }
        if (object instanceof T.Mesh) {
          if (!canBatch(object)) {
            addClone(object);
            return;
          }
          let batch = batches.find((candidate) => sameBatch(candidate, object, false));
          if (!batch) {
            batch = {geometry: object.geometry, material: object.material, sample: object, matrices: [], colors: null};
            batches.push(batch);
          }
          batch.matrices.push(new T.Matrix4().multiplyMatrices(sceneInverse, object.matrixWorld));
          return;
        }
        if (object instanceof T.Line || object instanceof T.Points || object instanceof T.Sprite) {
          addClone(object);
        }
      });
    }

    for (const batch of batches) {
      const proxy = new T.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.matrices.forEach((matrix, index) => proxy.setMatrixAt(index, matrix));
      batch.colors?.forEach((color, index) => proxy.setColorAt(index, color));
      proxy.instanceMatrix.needsUpdate = true;
      if (proxy.instanceColor) proxy.instanceColor.needsUpdate = true;
      proxy.castShadow = batch.sample.castShadow;
      proxy.receiveShadow = batch.sample.receiveShadow;
      proxy.renderOrder = batch.sample.renderOrder;
      proxy.layers.mask = batch.sample.layers.mask;
      proxy.frustumCulled = batch.sample.frustumCulled;
      proxy.customDepthMaterial = batch.sample.customDepthMaterial;
      proxy.customDistanceMaterial = batch.sample.customDistanceMaterial;
      proxy.onBeforeRender = batch.sample.onBeforeRender;
      proxy.onAfterRender = batch.sample.onAfterRender;
      renderRoot.add(proxy);
      generatedBatches.push(proxy);
    }
  }

  function setActive(value: boolean) {
    if (disposed) return;
    if (value === active) {
      if (!value) syncVisibility();
      return;
    }
    active = value;
    if (value) {
      for (const item of authored) item.object.visible = !item.object.userData.editorDeleted;
    } else {
      rebuild(true);
      syncVisibility();
    }
    sourceRoot.visible = value;
    renderRoot.visible = !value;
  }

  // Editor streaming reparents modified authored groups to its own root. The
  // scene calls this after streaming so those escaped groups remain hidden in
  // gameplay mode without paying for a full proxy rebuild every frame.
  function syncVisibility() {
    if (disposed || active) return;
    for (const item of authored) item.object.visible = false;
  }

  function refresh() {
    if (!disposed && !active) {
      rebuild();
      syncVisibility();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearRenderRoot();
    for (const item of authored) item.object.removeFromParent();
    sourceRoot.removeFromParent();
    renderRoot.removeFromParent();

    for (const state of sourceStates) {
      state.object.removeFromParent();
      if (state.parent) addAt(state.parent, state.object, state.index);
      setExactMatrix(state.object, state.matrix, state.matrixAutoUpdate);
      state.object.visible = state.visible;
    }
    for (const part of expandedParts) {
      part.removeFromParent();
      part.dispose();
    }
    for (const state of renderedStates) state.object.visible = state.visible;
    scene.updateMatrixWorld(true);
  }

  setActive(false);
  return {
    get active() {
      return active;
    },
    authored,
    templates,
    setActive,
    syncVisibility,
    refresh,
    dispose,
  };
}

export type EditableRender = ReturnType<typeof createEditableRender>;
