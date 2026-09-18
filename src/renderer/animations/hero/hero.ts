import * as THREE from "three";
import { PoseController } from "./pose-controller.ts";

export type HeroAsset = { animations: THREE.AnimationClip[]; scene: THREE.Object3D };
export type HeroLoader = { loadAsync(url: string): Promise<HeroAsset> };
export type HeroAnimator = { mixer: THREE.AnimationMixer; readonly locomotionBlend: number; update(dt: number, walking: boolean, combatWeight: number): void };

export async function loadHero(loader: HeroLoader, url: string, setupMaterial: (mesh: THREE.Mesh) => void): Promise<HeroAsset> {
  const asset = await loader.loadAsync(url), root = asset.scene;
  root.updateMatrixWorld(true);
  root.scale.multiplyScalar(1.85 / new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y);
  root.updateMatrixWorld(true);
  root.position.y -= new THREE.Box3().setFromObject(root).min.y;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
    setupMaterial(mesh);
  });
  return asset;
}

export function createHeroAnimator(root: THREE.Object3D, animations: THREE.AnimationClip[], options: { idle: "clip-or-pose" | "pose"; run: RegExp }): HeroAnimator {
  const mixer = new THREE.AnimationMixer(root);
  let blend = 0, pose: PoseController | null = null;
  let idleAction: THREE.AnimationAction | null = null, runAction: THREE.AnimationAction | null = null;
  const idle = options.idle === "clip-or-pose" ? animations.find((clip) => /idle/i.test(clip.name)) : undefined;
  if (idle) idleAction = mixer.clipAction(idle).play();
  else { pose = new PoseController(root); pose.buildIdle(root); }
  const run = animations.find((clip) => options.run.test(clip.name));
  if (run) {
    const inPlace = run.clone();
    for (const track of inPlace.tracks) if (/hips\.position$/i.test(track.name)) for (let index = 0; index < track.values.length; index += 3) { track.values[index] = track.values[0]; track.values[index + 2] = track.values[2]; }
    runAction = mixer.clipAction(inPlace).setEffectiveWeight(0).play();
  }
  return { mixer, get locomotionBlend() { return blend; }, update(dt, walking, combatWeight) {
    blend = THREE.MathUtils.damp(blend, walking ? 1 : 0, 16, dt);
    runAction?.setEffectiveWeight(blend * (1 - combatWeight));
    idleAction?.setEffectiveWeight((1 - blend) * (1 - combatWeight));
    mixer.update(dt); pose?.apply((1 - blend) * (1 - combatWeight));
  } };
}
