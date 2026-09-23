import * as T from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ASSET_URLS } from '../../assets/registry.ts';
import { createConcreteMaterial, prepareConcreteUv } from '../three/cold-concrete.ts';
import { disposeObjectTree } from '../three/dispose.ts';
import { ELEVATED_RAIL, ELEVATED_RAIL_PERIOD, elevatedTrainX, sampleRailRoute, railSupportPoses } from './elevated-rail-layout.ts';
import { curveRailSpans } from './curved-rail-geometry.ts';
import { createRailCityDetails } from './rail-city-details.ts';

type ModelLoader = Pick<GLTFLoader, 'loadAsync'>;
type Placement = { x: number; y?: number; z?: number; rotation?: number; heightScale?: number };

/** Owns only this scenery's resources. The scene keeps ownership of its loader,
 * frame loop, shadow invalidation and navigation. No timers are added.
 * The optional atlas loader allows lifecycle tests without a browser decoder. */
export function createElevatedRail(
  scene: T.Scene,
  loader: ModelLoader,
  mobile: boolean,
  onError: (message: string) => void,
  onReady?: () => void,
  loadAtlas: () => Promise<T.Texture> = () => new T.TextureLoader().loadAsync(ASSET_URLS.buildingAtlas),
) {
  const root = new T.Group();
  root.name = 'Refuge / elevated railway';
  root.position.z = ELEVATED_RAIL.z;
  root.rotation.y = ELEVATED_RAIL.trackYaw;
  const train = new T.Group();
  train.name = 'Refuge / three-car transit';
  root.add(train);
  scene.add(root);

  let disposed = false;
  let loaded = false;
  let elapsed = 0;
  let source: T.Group | undefined;
  let atlas: T.Texture | undefined;
  let concrete: T.MeshStandardMaterial | undefined;
  const geometries = new Set<T.BufferGeometry>();
  const instances = new Set<T.InstancedMesh>();
  const rollingStock: { mesh: T.InstancedMesh; placements: readonly Placement[] }[] = [];
  let couplers: T.InstancedMesh | undefined;
  let couplerMaterial: T.MeshStandardMaterial | undefined;
  let cityDetails: ReturnType<typeof createRailCityDetails> | undefined;
  let lastDistance = NaN;
  const leadLights = new T.Group();
  leadLights.name = 'Train / headlight rig';
  train.add(leadLights);
  // Emissive glass/strips are baked into the Blender kit. One shadow-free
  // headlight also lights the next section of track instead of just glowing.
  const headlight = new T.SpotLight(0xccecff, mobile ? 12 : 28, 24, .35, .55, 1.6);
  headlight.position.set(4.1, 1.08, 0);
  headlight.target.position.set(17, -.35, 0);
  leadLights.add(headlight, headlight.target);
  const carPosition = new T.Vector3();
  const carRotation = new T.Quaternion();
  const carScale = new T.Vector3(1, 1, 1);
  const carMatrix = new T.Matrix4();
  const upAxis = new T.Vector3(0, 1, 0);
  const couplingA = new T.Vector3(), couplingB = new T.Vector3();

  function coachPose(distance: number, rear = false) {
    // Both bogies follow the route; their chord keeps a rigid coach centred
    // over the rails while its neighbours articulate independently.
    const back = sampleRailRoute(distance - (rear ? 2.6 : 2.9));
    const front = sampleRailRoute(distance + (rear ? 2.9 : 2.6));
    const weight = (rear ? 2.6 : 2.9) / 5.5;
    carPosition.set(back.x + (front.x - back.x) * weight, ELEVATED_RAIL.trainY,
      back.z + (front.z - back.z) * weight);
    carRotation.setFromAxisAngle(upAxis, -Math.atan2(front.z - back.z, front.x - back.x) + (rear ? Math.PI : 0));
    return carMatrix.compose(carPosition, carRotation, carScale);
  }

  function placeTrain(distance: number) {
    for (const { mesh, placements } of rollingStock) {
      for (let index = 0; index < placements.length; index++) {
        const placement = placements[index];
        mesh.setMatrixAt(index, coachPose(distance + placement.x, placement.rotation === Math.PI));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
    coachPose(distance).decompose(leadLights.position, leadLights.quaternion, leadLights.scale);
    if (couplers) {
      for (let index = 0; index < 2; index++) {
        couplingA.set(-4.65, 1.6, 0).applyMatrix4(coachPose(distance - index * ELEVATED_RAIL.carSpacing));
        couplingB.set(index === 1 ? -4.65 : 4.65, 1.6, 0)
          .applyMatrix4(coachPose(distance - (index + 1) * ELEVATED_RAIL.carSpacing, index === 1));
        carPosition.copy(couplingA).add(couplingB).multiplyScalar(.5);
        carRotation.setFromAxisAngle(upAxis, -Math.atan2(couplingB.z - couplingA.z, couplingB.x - couplingA.x));
        carScale.set(couplingA.distanceTo(couplingB), 1, 1);
        couplers.setMatrixAt(index, carMatrix.compose(carPosition, carRotation, carScale));
        carScale.set(1, 1, 1);
      }
      couplers.instanceMatrix.needsUpdate = true;
      couplers.computeBoundingBox();
      couplers.computeBoundingSphere();
    }
    lastDistance = distance;
  }

  function release() {
    root.removeFromParent();
    cityDetails?.dispose();
    cityDetails = undefined;
    rollingStock.length = 0;
    couplers = undefined;
    couplerMaterial?.dispose();
    couplerMaterial = undefined;
    headlight.dispose();
    for (const mesh of instances) mesh.dispose();
    instances.clear();
    for (const geometry of geometries) geometry.dispose();
    geometries.clear();
    if (source) disposeObjectTree(source);
    source = undefined;
    concrete?.dispose();
    concrete = undefined;
    atlas?.dispose();
    atlas = undefined;
    root.clear();
    loaded = false;
  }

  function addInstances(prototype: T.Object3D, parent: T.Group, placements: readonly Placement[], heightScale = 1, curved = false) {
    const inverseRoot = prototype.matrixWorld.clone().invert();
    const matrix = new T.Matrix4();
    const position = new T.Vector3();
    const rotation = new T.Quaternion();
    const up = new T.Vector3(0, 1, 0);
    const scale = new T.Vector3(1, 1, 1);
    prototype.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      // Bake local transforms before projecting concrete UVs so a tall pier
      // receives the same texel density as the existing balcony buildings.
      let geometry = object.geometry.clone();
      geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld));
      // Shorten grounded columns before projecting metric concrete UVs. The
      // deck and rolling stock retain their original proportions.
      if (heightScale !== 1) geometry.scale(1, heightScale, 1);
      const originals = Array.isArray(object.material) ? object.material : [object.material];
      const usesConcrete = originals.some(material => material.name.startsWith('CBRail_Concrete'));
      if (usesConcrete && concrete) prepareConcreteUv(geometry, 0, 0, 0);
      const materials = originals.map(material =>
        material.name.startsWith('CBRail_Concrete') && concrete ? concrete : material);
      const material = Array.isArray(object.material) ? materials : materials[0];
      if (curved) {
        const warped = curveRailSpans(geometry, ELEVATED_RAIL.deckCentres, ELEVATED_RAIL.deckY, sampleRailRoute);
        geometry.dispose();
        geometry = warped;
        geometries.add(geometry);
        const mesh = new T.Mesh(geometry, material);
        mesh.name = `${prototype.name} / ${object.name}`;
        mesh.castShadow = !mobile && parent !== train;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        parent.add(mesh);
        return;
      }
      geometries.add(geometry);
      const mesh = new T.InstancedMesh(geometry, material, placements.length);
      instances.add(mesh);
      mesh.name = `${prototype.name} / ${object.name}`;
      mesh.castShadow = !mobile && parent !== train;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      for (let index = 0; index < placements.length; index++) {
        const placement = placements[index];
        position.set(placement.x, placement.y ?? 0, placement.z ?? 0);
        rotation.setFromAxisAngle(up, placement.rotation ?? 0);
        scale.set(1, placement.heightScale ?? 1, 1);
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(index, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      parent.add(mesh);
      if (parent === train) {
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        rollingStock.push({ mesh, placements });
      }
    });
  }

  const ready = loader.loadAsync(`${ASSET_URLS.elevatedRail}?v=20260918-arc2`).then(async ({ scene: model }) => {
    if (disposed) { disposeObjectTree(model); return; }
    source = model;
    const names = ['RailDeck', 'RailPier', 'TrainCar', 'TrainMiddle'] as const;
    const modules = names.map(name => {
      const prototype = model.getObjectByName(name);
      if (!prototype) throw new Error(`Missing Blender module: ${name}`);
      return prototype;
    });
    const texture = await loadAtlas();
    if (disposed) { texture.dispose(); return; }
    atlas = texture;
    atlas.colorSpace = T.SRGBColorSpace;
    atlas.anisotropy = mobile ? 2 : 4;
    concrete = createConcreteMaterial(atlas);
    concrete.vertexColors = false;
    concrete.color.setHex(0xb5b5b5).multiplyScalar(.75);
    model.updateMatrixWorld(true);
    model.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) {
          if (value instanceof T.Texture) value.anisotropy = mobile ? 2 : 4;
        }
      }
    });
    const [deck, pier, cab, middle] = modules;
    addInstances(deck, root, [], 1, true);
    addInstances(pier, root, railSupportPoses().map(pose => ({
      x: pose.x, y: pose.y, z: pose.z, rotation: pose.yaw,
      heightScale: (ELEVATED_RAIL.deckY - 1.1 - pose.y) / (ELEVATED_RAIL.deckY - 1.1),
    })),
    (ELEVATED_RAIL.deckY - 1.1) / new T.Box3().setFromObject(pier).getSize(new T.Vector3()).y);
    addInstances(cab, train, [
      { x: 0 },
      { x: -2 * ELEVATED_RAIL.carSpacing, rotation: Math.PI },
    ]);
    addInstances(middle, train, [{ x: -ELEVATED_RAIL.carSpacing }]);
    const ribs = Array.from({ length: 7 }, (_, index) =>
      new T.BoxGeometry(.1, 2.08, 2.08).translate(-.45 + index * .15, 0, 0));
    const bellows = mergeGeometries(ribs)!;
    ribs.forEach(geometry => geometry.dispose());
    geometries.add(bellows);
    couplerMaterial = new T.MeshStandardMaterial({ color: 0x182127, roughness: .9, metalness: .15 });
    couplers = new T.InstancedMesh(bellows, couplerMaterial, 2);
    couplers.name = 'Train / articulated bellows';
    couplers.instanceMatrix.setUsage(T.DynamicDrawUsage);
    instances.add(couplers);
    train.add(couplers);
    placeTrain(ELEVATED_RAIL.initialX);
    cityDetails = createRailCityDetails(root, mobile);
    loaded = true;
  }).catch((error: unknown) => {
    release();
    if (!disposed) onError(`Elevated railway unavailable: ${error instanceof Error ? error.message : 'asset loading failed'}. The refuge remains playable.`);
  }).finally(() => {
    if (!disposed) onReady?.();
  });

  return {
    root,
    ready,
    /** Returns true when shadows may need updating. The scene may throttle it. */
    seek(seconds: number) { elapsed = Math.max(0, seconds) % ELEVATED_RAIL_PERIOD; },
    update(dt: number, reducedMotion: boolean): boolean {
      if (disposed || !loaded) return false;
      if (!reducedMotion && Number.isFinite(dt) && dt > 0) {
        elapsed = (elapsed + dt) % ELEVATED_RAIL_PERIOD;
      }
      const distance = elevatedTrainX(elapsed, reducedMotion);
      if (distance === lastDistance) return false;
      placeTrain(distance);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
    },
  };
}
