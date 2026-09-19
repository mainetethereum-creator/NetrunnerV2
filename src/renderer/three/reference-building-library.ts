import * as T from 'three';
import { REFERENCE_BUILDINGS, type ReferenceBuildingId } from '../../assets/reference-buildings.ts';
import { createGltfLoader } from './gltf-loader.ts';
import { disposeObjectTree } from './dispose.ts';
import { ASSET_URLS } from '../../assets/registry.ts';
import { createConcreteMaterial, prepareConcreteUv } from './cold-concrete.ts';

type LoadModel = (url: string) => Promise<{ scene: T.Group }>;

/** Explicit asynchronous preparation keeps placement/ghost/undo synchronous.
 * Each library owns its loaded resources; placements share those resources.
 * No placeholder geometry, timers, lights or background catalogue preload.
 */
export function createReferenceBuildingLibrary(anisotropy = 4, load?: LoadModel,
  loadAtlas: () => Promise<T.Texture> = () => new T.TextureLoader().loadAsync(ASSET_URLS.buildingAtlas)) {
  const prototypes = new Map<ReferenceBuildingId, T.Group>();
  const pending = new Map<ReferenceBuildingId, Promise<void>>();
  let disposed = false;
  let concrete: T.MeshStandardMaterial | undefined;
  let concretePending: Promise<T.MeshStandardMaterial> | undefined;
  function prepareConcrete() {
    concretePending ??= loadAtlas().then(atlas => {
      if (disposed) { atlas.dispose(); throw new Error('Reference building library disposed'); }
      atlas.colorSpace = T.SRGBColorSpace;
      atlas.anisotropy = Math.min(8, Math.max(1, anisotropy));
      concrete = createConcreteMaterial(atlas);
      concrete.vertexColors = false;
      // Same material as the balcony house, one owner-requested tone darker.
      concrete.color.setHex(0xb5b5b5).multiplyScalar(.75);
      return concrete;
    }).catch(error => { concretePending = undefined; throw error; });
    return concretePending;
  }
  // Create the loader only on the first GLB request, and release its Draco worker pool.
  let gltf: ReturnType<typeof createGltfLoader> | undefined;
  const loadModel: LoadModel = load ?? (url => {
    gltf ??= createGltfLoader();
    return gltf.loader.loadAsync(url);
  });

  function prepare(id: ReferenceBuildingId): Promise<void> {
    if (disposed) return Promise.reject(new Error('Reference building library disposed'));
    if (prototypes.has(id)) return Promise.resolve();
    const existing = pending.get(id);
    if (existing) return existing;
    const asset = REFERENCE_BUILDINGS.find(item => item.id === id)!;
    // Public assets have long cache headers in this project. Bump after a rebake.
    const promise = loadModel(`${asset.url}?v=20260919-outskirts-3`).then(async ({ scene }) => {
      if (disposed) {
        disposeObjectTree(scene);
        throw new Error('Reference building library disposed');
      }
      const concreteMeshes: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[] = [];
      scene.traverse(object => {
        if (object instanceof T.Mesh && object.material instanceof T.MeshStandardMaterial
          && object.material.name.startsWith('CBR1_Concrete')) concreteMeshes.push(object);
      });
      if (concreteMeshes.length) {
        let replacement: T.MeshStandardMaterial;
        try {
          replacement = await prepareConcrete();
          if (disposed) throw new Error('Reference building library disposed');
        } catch (error) {
          disposeObjectTree(scene);
          throw error;
        }
        const oldMaterials = new Set<T.Material>(), oldTextures = new Set<T.Texture>();
        for (const mesh of concreteMeshes) {
          // Re-project in actual metres, independent of the imported UV layout.
          prepareConcreteUv(mesh.geometry, 0, 0, 0);
          oldMaterials.add(mesh.material);
          for (const value of Object.values(mesh.material)) if (value instanceof T.Texture) oldTextures.add(value);
          mesh.material = replacement;
        }
        // Only dispose textures no remaining material uses (metals are preserved).
        scene.traverse(object => {
          if (!(object instanceof T.Mesh)) return;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            for (const value of Object.values(material)) if (value instanceof T.Texture) oldTextures.delete(value);
          }
        });
        oldMaterials.forEach(material => material.dispose());
        oldTextures.forEach(texture => texture.dispose());
      }
      scene.name = asset.name;
      scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          for (const value of Object.values(material)) {
            if (value instanceof T.Texture) value.anisotropy = Math.min(8, Math.max(1, anisotropy));
          }
        }
      });
      scene.updateMatrixWorld(true);
      prototypes.set(id, scene);
    }).finally(() => pending.delete(id));
    pending.set(id, promise);
    return promise;
  }

  return {
    prepare,
    isReady: (id: ReferenceBuildingId) => prototypes.has(id),
    create(id: ReferenceBuildingId): T.Group {
      if (disposed) throw new Error('Reference building library disposed');
      const prototype = prototypes.get(id);
      if (!prototype) throw new Error(`Prepare building before creation: ${id}`);
      return prototype.clone(true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gltf?.draco.dispose();
      // Concrete is shared across prototypes; dispose the complete tree once.
      const resources = new T.Group();
      for (const prototype of prototypes.values()) resources.add(prototype);
      let includesConcrete = false;
      resources.traverse(object => {
        if (object instanceof T.Mesh && object.material === concrete) includesConcrete = true;
      });
      disposeObjectTree(resources);
      if (concrete && !includesConcrete) { concrete.map?.dispose(); concrete.dispose(); }
      prototypes.clear();
    },
  };
}
