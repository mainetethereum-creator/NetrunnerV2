import * as T from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSET_URLS } from '../../assets/registry.ts';
import { disposeObjectTree } from '../three/dispose.ts';
import { ELEVATED_RAIL, RAIL_FORK, railSupportPoses, sampleRailRoute } from './elevated-rail-layout.ts';
import { eastGroundHeight } from './east-district-layout.ts';

/** One authored union slab makes the live and closed legs of the Y switch meet.
 * The train samples only the intact route. All remnants are non-walkable scenery. */
export function createRailRuins(
  parent: T.Scene,
  loader: Pick<GLTFLoader, 'loadAsync'>,
  mobile: boolean,
  onError: (message: string) => void,
) {
  const root = new T.Group();
  root.name = 'Railway / ruined southern branch';
  parent.add(root);
  // Sources retain ownership of every geometry and material shared by instances.
  const owned = new T.Group();
  let disposed = false;
  const ready = loader.loadAsync(`${ASSET_URLS.railRuins}?v=20260920-2`).then(gltf => {
    if (disposed) { disposeObjectTree(gltf.scene); return; }
    owned.add(gltf.scene);
    gltf.scene.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof T.MeshStandardMaterial)) continue;
        material.envMapIntensity = .5;
        for (const texture of [material.map, material.normalMap]) {
          if (texture) texture.anisotropy = mobile ? 2 : 4;
        }
        if (material.name === 'RailRuin_Concrete') {
          material.color.setHex(0xb5b5b5).multiplyScalar(.75);
          material.normalScale.setScalar(.4);
        }
        if (material.name === 'RailRuin_Alloy') material.color.setRGB(.32,.38,.39);
        if (material.name === 'RailRuin_Rust') material.color.setRGB(.29,.13,.07);
      }
    });
    type Placement = { x: number; y: number; z: number; yaw: number };
    const dummy = new T.Object3D();
    const matrix = new T.Matrix4();
    function instances(name: string, placements: Placement[]) {
      const source = gltf.scene.getObjectByName(name);
      if (!source) throw new Error(`Missing railway ruin: ${name}`);
      source.updateWorldMatrix(true, true);
      const inverse = source.matrixWorld.clone().invert();
      source.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const local = inverse.clone().multiply(object.matrixWorld);
        const mesh = new T.InstancedMesh(object.geometry, object.material, placements.length);
        mesh.name = `Rail ruins / ${object.name}`;
        mesh.castShadow = !mobile;
        mesh.receiveShadow = true;
        placements.forEach((placement, index) => {
          dummy.position.set(placement.x, placement.y, placement.z);
          dummy.rotation.set(0, placement.yaw, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(index, matrix.multiplyMatrices(dummy.matrix, local));
        });
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        root.add(mesh);
      });
    }
    const approach = sampleRailRoute(RAIL_FORK.start);
    instances('RailJunction', [{ ...approach, y: ELEVATED_RAIL.deckY }]);
    const remnants = railSupportPoses().filter(p => p.abandoned && p.distance > RAIL_FORK.brokenEnd);
    instances('RuinedPierCap', remnants.map(p => ({ ...p, y: ELEVATED_RAIL.deckY - 1.1 })));
    instances('RailCrashDebris', remnants.map(p => {
      const x = p.x - 2.3;
      const z = p.z + 2;
      return { x, z, y: eastGroundHeight(x, z), yaw: p.yaw + .2 };
    }));
  }).catch(error => {
    if (disposed) return;
    console.error('Railway junction load failed', error);
    onError('Не удалось загрузить развилку эстакады. Перезагрузите страницу.');
  });
  return {
    root,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      parent.remove(root);
      root.add(owned);
      root.traverse(object => { if (object instanceof T.InstancedMesh) object.dispose(); });
      disposeObjectTree(root);
      root.clear();
    },
  };
}
