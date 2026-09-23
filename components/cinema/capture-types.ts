import type * as T from 'three';

/** Development-only movie capture. Nothing writes camera or map storage. */
export type CinemaPose = { position: [number, number, number]; target: [number, number, number]; fov: number; actor?: { x: number; z: number; yaw: number; time: number; speed: number; animate?: (time: number) => void } };
export type CinemaCapture = {
  scene: T.Scene;
  character?: T.Object3D;
  ready(): boolean;
  prepare(width: number, height: number): void;
  frame(pose: CinemaPose, seconds: number, dt: number): HTMLCanvasElement;
};
export type CinemaHook = (capture: CinemaCapture) => void;
