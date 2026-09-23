import * as T from 'three';
import { ASSET_URLS } from '../../src/assets/registry.ts';

/** Retargeted Mixamo motion, loaded only by the development capture page. */
export async function createCinemaWalk(root: T.Object3D) {
  const response = await fetch(ASSET_URLS.cinemaWalk);
  if (!response.ok) throw new Error('Mixamo walking animation failed to load');
  const data = await response.json() as { stride: number; clip: Parameters<typeof T.AnimationClip.parse>[0] };
  const clip = T.AnimationClip.parse(data.clip);
  const mixer = new T.AnimationMixer(root);
  mixer.clipAction(clip).play();
  const hips = root.getObjectByName('mixamorigHips');
  if (!hips) throw new Error('Character skeleton does not match Mixamo walk');
  root.updateWorldMatrix(true, true);
  const worldScale = hips.getWorldScale(new T.Vector3()).y;
  const stride = data.stride * worldScale;
  return {
    apply(time: number, speed: number) {
      mixer.setTime(time * speed * clip.duration / stride);
      root.updateMatrixWorld(true);
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(root); },
  };
}
