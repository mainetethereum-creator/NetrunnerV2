import * as T from 'three';
import { REFERENCE_BUILDINGS, type ReferenceBuildingId } from '../../assets/reference-buildings.ts';
import { createGltfLoader } from './gltf-loader.ts';
import { disposeObjectTree } from './dispose.ts';
import { ASSET_URLS } from '../../assets/registry.ts';
import { createConcreteMaterial, prepareConcreteUv } from './cold-concrete.ts';
import { attachGardenSign } from './garden-facade-sign.ts';

type LoadModel = (url: string) => Promise<{ scene: T.Group }>;
const KTX2_FACADE_IDS = new Set<ReferenceBuildingId>([
  'building-japanese-cafe','building-glass-corner','building-japanese-parts-shop',
  'building-wallet-tower','building-cyberbase-tower','building-media-tower',
  'building-slender-glass','building-slender-terrace','building-corner-chamfer','building-corner-rounded',
]);

/** Explicit asynchronous preparation keeps placement/ghost/undo synchronous.
 * Each library owns its loaded resources; placements share those resources.
 * No placeholder geometry, timers, lights or background catalogue preload.
 */
export function createReferenceBuildingLibrary(anisotropy = 4, load?: LoadModel,
  loadAtlas: () => Promise<T.Texture> = () => new T.TextureLoader().loadAsync(ASSET_URLS.buildingAtlas),
  loadSign: () => Promise<T.Texture> = () => new T.TextureLoader().loadAsync(ASSET_URLS.sakuraSign),
  gardenSigns = false,
  loadSurface?: () => Promise<T.Texture>) {
  const prototypes = new Map<ReferenceBuildingId, T.Group>();
  const pending = new Map<ReferenceBuildingId, Promise<void>>();
  let disposed = false;
  let concrete: T.MeshStandardMaterial | undefined;
  let concretePending: Promise<T.MeshStandardMaterial> | undefined;
  let gardenSign: Promise<T.MeshStandardMaterial> | undefined;
  let surface: T.Texture | undefined;
  let surfacePending: Promise<T.Texture> | undefined;
  const signedBuildings=new Set(['building-corner-chamfer','building-corner-rounded','building-urban-office']);
  function disposeUnprepared(scene:T.Group) {
    // Concrete already belongs to the library while a sign is still loading.
    scene.traverse(object=>{
      if(object instanceof T.Mesh && object.material===concrete)object.material=[];
    });
    disposeObjectTree(scene);
  }
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
  function prepareSurface() {
    if (!loadSurface) return Promise.reject(new Error('Shared building surface is unavailable'));
    surfacePending ??= loadSurface().then(texture => {
      if (disposed) { texture.dispose(); throw new Error('Reference building library disposed'); }
      texture.name = 'surface/shared';
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = Math.min(8, Math.max(1, anisotropy));
      surface = texture;
      return texture;
    }).catch(error => { surfacePending = undefined; throw error; });
    return surfacePending;
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
    const sourceUrl=`${asset.url}?v=20260919-outskirts-3`;
    const optimizedUrl=`${asset.url.replace(/\.glb$/, '-ktx2.glb')}?v=20260921-1`;
    const request=loadSurface && KTX2_FACADE_IDS.has(id)
      ? loadModel(optimizedUrl).catch(error=>{console.warn(`KTX2 facade unavailable for ${id}; using source GLB.`,error);return loadModel(sourceUrl);})
      : loadModel(sourceUrl);
    const promise = request.then(async ({ scene }) => {
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
      const surfaceMaterials = new Set<T.MeshStandardMaterial>();
      scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof T.MeshStandardMaterial && material.map?.name === 'surface') surfaceMaterials.add(material);
        }
      });
      if (surfaceMaterials.size && loadSurface) {
        try {
          const replacement = await prepareSurface();
          const oldTextures = new Set<T.Texture>();
          for (const material of surfaceMaterials) {
            if (material.map && material.map !== replacement) oldTextures.add(material.map);
            material.map = replacement;
            material.needsUpdate = true;
          }
          scene.traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              for (const value of Object.values(material)) if (value instanceof T.Texture) oldTextures.delete(value);
            }
          });
          oldTextures.forEach(texture => texture.dispose());
        } catch (error) {
          // Keep the embedded JPEG maps as the compatibility fallback.
          console.warn('Shared KTX2 building surface unavailable; keeping embedded maps.', error);
        }
      }
      if (gardenSigns && signedBuildings.has(id) && new T.Box3().setFromObject(scene).max.y>6) {
        gardenSign ??= loadSign().then(map=>{
          if(disposed) {map.dispose();throw new Error('Reference building library disposed');}
          map.colorSpace=T.SRGBColorSpace;map.anisotropy=anisotropy;
          return new T.MeshStandardMaterial({map,emissiveMap:map,emissive:0xffffff,emissiveIntensity:2.2,roughness:.35,metalness:.25});
        });
        let sign:T.MeshStandardMaterial;
        try {sign=await gardenSign;} catch(error) {gardenSign=undefined;disposeUnprepared(scene);throw error;}
        if(disposed) {disposeUnprepared(scene);throw new Error('Reference building library disposed');}
        attachGardenSign(scene,sign);
      }
      scene.name = asset.name;
      scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!(material instanceof T.MeshStandardMaterial) || !gardenSigns) continue;
          // Base-only facade lighting: retain the approved artwork while making
          // the media, trim and occupied windows legible in rain and Lite mode.
          if (material.name.endsWith('_ApprovedMedia')) material.emissiveIntensity = 1.08;
          else if (material.name.endsWith('_Neon')) material.emissiveIntensity = 1.65;
          else if (material.name.endsWith('_WarmLight')) material.emissiveIntensity = .72;
        }
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
      let includesSurface = false;
      resources.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material === concrete) includesConcrete = true;
          if (material instanceof T.MeshStandardMaterial && material.map === surface) includesSurface = true;
        }
      });
      disposeObjectTree(resources);
      if (concrete && !includesConcrete) { concrete.map?.dispose(); concrete.dispose(); }
      if (surface && !includesSurface) surface.dispose();
      prototypes.clear();
    },
  };
}
