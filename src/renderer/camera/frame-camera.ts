import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type FrameCameraMode = 'follow' | 'free' | 'fixed';
export const FRAME_CAMERA_KEY = 'cyberbase.base.camera-frame.v1';
export const FRAME_CAMERA_PRESET_2_KEY = 'cyberbase.base.camera-preset-2.v1';
type Frame = { version: 1; position: number[]; target: number[]; anchor: number[] };
// Legacy world-space frames were saved on Base, whose initial body pivot is here.
const LEGACY_ANCHOR = [0, 1.05, 5];
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function parseCameraFrame(text: string | null): Frame | null {
  try {
    const value = JSON.parse(text ?? 'null');
    const vector = (v: unknown): v is number[] => Array.isArray(v) && v.length === 3
      && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000);
    if (value?.version !== 1 || !vector(value.position) || !vector(value.target)) return null;
    if (value.anchor !== undefined && !vector(value.anchor)) return null;
    const distance = new T.Vector3().fromArray(value.position).distanceTo(new T.Vector3().fromArray(value.target));
    if (distance < 4 || distance > 101 || value.position[1] < .2) return null;
    return { version: 1, position: value.position, target: value.target, anchor: value.anchor ?? LEGACY_ANCHOR };
  } catch { return null; }
}

/** Manual framing is opt-in; the existing follow rig remains the default. */
export function createFrameCamera(camera: T.PerspectiveCamera, canvas: HTMLElement,
  storage?: Storage, makeControls = (c: T.PerspectiveCamera, el: HTMLElement) => new OrbitControls(c, el),
  initialAnchor = new T.Vector3().fromArray(LEGACY_ANCHOR)) {
  const controls = makeControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = false;
  controls.minDistance = 4; controls.maxDistance = 100;
  controls.minPolarAngle = .15; controls.maxPolarAngle = Math.PI / 2 - .08;
  controls.screenSpacePanning = true;
  const minTarget = new T.Vector3(-80, .1, -80), maxTarget = new T.Vector3(80, 25, 80);
  let mode: FrameCameraMode = 'follow';
  const anchor = initialAnchor.clone(), positionOffset = new T.Vector3(), targetOffset = new T.Vector3();
  const cameraOffset = new T.Vector3();
  const serializeFrame = () => JSON.stringify({
    version: 1,
    position: camera.position.toArray(),
    target: controls.target.toArray(),
    anchor: anchor.toArray(),
  });
  const captureOffsets = () => {
    positionOffset.copy(camera.position).sub(anchor);
    targetOffset.copy(controls.target).sub(anchor);
  };
  const place = (pivot: T.Vector3) => {
    if (mode !== 'fixed') return;
    anchor.copy(pivot);
    camera.position.copy(anchor).add(positionOffset);
    controls.target.copy(anchor).add(targetOffset);
    camera.lookAt(controls.target);
  };
  try {
    const saved = parseCameraFrame(storage?.getItem(FRAME_CAMERA_KEY) ?? null);
    if (saved) {
      anchor.fromArray(saved.anchor);
      camera.position.fromArray(saved.position); controls.target.fromArray(saved.target);
      captureOffsets(); mode = 'fixed'; place(initialAnchor);
      // Preserve the owner's first fixed composition as a durable secondary
      // standard. Later camera edits keep updating FRAME_CAMERA_KEY only.
      if (!parseCameraFrame(storage?.getItem(FRAME_CAMERA_PRESET_2_KEY) ?? null)) {
        storage?.setItem(FRAME_CAMERA_PRESET_2_KEY, JSON.stringify(saved));
      }
    }
  } catch { /* Storage can be unavailable; framing still works for this visit. */ }
  return {
    get mode() { return mode; },
    get azimuth() {
      return mode === 'fixed'
        ? Math.atan2(positionOffset.x - targetOffset.x, positionOffset.z - targetOffset.z)
        : Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    },
    start(target: T.Vector3) {
      anchor.copy(target);
      if (mode === 'follow') controls.target.copy(target);
      mode = 'free'; controls.enabled = true; controls.update();
    },
    /** Button-accessible dolly for mice whose wheel is unavailable. Positive
     * values move away from the target; negative values move closer. */
    zoomBy(delta: number) {
      if (mode !== 'free' || !Number.isFinite(delta)) return;
      cameraOffset.copy(camera.position).sub(controls.target);
      const distance = cameraOffset.length();
      if (distance < Number.EPSILON) return;
      cameraOffset.setLength(T.MathUtils.clamp(distance + delta, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(cameraOffset);
      controls.update();
    },
    fix(pivot = anchor) {
      if (mode !== 'free') return true;
      mode = 'fixed'; controls.enabled = false;
      anchor.copy(pivot); captureOffsets();
      try {
        storage?.setItem(FRAME_CAMERA_KEY, serializeFrame());
        return !!storage;
      } catch { return false; }
    },
    savePreset2() {
      if (mode !== 'fixed') return false;
      try {
        storage?.setItem(FRAME_CAMERA_PRESET_2_KEY, serializeFrame());
        return !!storage;
      } catch { return false; }
    },
    restorePreset2(pivot = anchor) {
      try {
        const saved = parseCameraFrame(storage?.getItem(FRAME_CAMERA_PRESET_2_KEY) ?? null);
        if (!saved) return false;
        anchor.fromArray(saved.anchor);
        camera.position.fromArray(saved.position); controls.target.fromArray(saved.target);
        captureOffsets(); mode = 'fixed'; controls.enabled = false;
        place(pivot);
        storage?.setItem(FRAME_CAMERA_KEY, JSON.stringify(saved));
        return true;
      } catch { return false; }
    },
    follow() {
      mode = 'follow'; controls.enabled = false;
      try { storage?.removeItem(FRAME_CAMERA_KEY); } catch { /* Session reset still works. */ }
    },
    place,
    update(interactive: boolean) {
      controls.enabled = mode === 'free' && interactive;
      if (controls.enabled) {
        controls.target.clamp(minTarget, maxTarget);
        controls.update();
      }
    },
    dispose() { controls.dispose(); },
  };
}
