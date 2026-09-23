import type { CinemaPose } from './capture-types';

export type CinemaShot = { name: string; location: 'base' | 'expedition'; start: number; duration: number; from: CinemaPose; to: CinemaPose; walk?: { from: [number, number]; to: [number, number] } };
const pose = (position: CinemaPose['position'], target: CinemaPose['target'], fov: number): CinemaPose => ({ position, target, fov });
export const CINEMA_SHOTS: CinemaShot[] = [
  { name: '01 · Canal / arrival', location: 'base', start: 0, duration: 6, from: pose([18,21,65],[5,2,18],48), to: pose([12,17,51],[3,3,15],48) },
  { name: '02 · Sakura / slow walk', location: 'base', start: 6, duration: 6, from: pose([0,9,44],[-6,2.5,26.5],50), to: pose([5,9,44.5],[-1,2.5,27],50), walk: { from: [-6,26.5], to: [-1,27] } },
  { name: '03 · Neon / slow walk', location: 'base', start: 12, duration: 5, from: pose([-7,7,11],[-12,2.7,-3],50), to: pose([-2,7,11],[-7,2.7,-3],50), walk: { from: [-12,-3], to: [-7,-3] } },
  { name: '04 · Skyline / metro', location: 'base', start: 17, duration: 5, from: pose([38,9,7],[24,6,-16],44), to: pose([31,10,3],[15,7,-17],44) },
  { name: '05 · Night train', location: 'base', start: 22, duration: 7, from: pose([18,41,-33],[24,11,-23],40), to: pose([53,36,-18],[53,10,-2],40) },
  { name: '06 · Beyond the wall', location: 'base', start: 29, duration: 7, from: pose([38,10,35],[48,1,25],40), to: pose([42,9,31],[50,1,22],40) },
  { name: '07 · Outlands / convoy', location: 'expedition', start: 36, duration: 6, from: pose([3,8,50],[20,4,26],52), to: pose([9,8,49],[23,4,24],52) },
  { name: '08 · CyberBase / nightfall', location: 'base', start: 42, duration: 6, from: pose([24,21,48],[8,5,6],48), to: pose([11,25,58],[6,5,6],48) },
];

export function shotPose(shot: CinemaShot, progress: number): CinemaPose {
  // Gentle acceleration/deceleration, with most of each shot in a continuous dolly.
  const u = Math.max(0, Math.min(1, progress));
  const t = shot.walk ? u : u * u * (3 - 2 * u);
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    position: shot.from.position.map((v, i) => mix(v, shot.to.position[i])) as CinemaPose['position'],
    target: shot.from.target.map((v, i) => mix(v, shot.to.target[i])) as CinemaPose['target'],
    fov: mix(shot.from.fov, shot.to.fov),
    actor: shot.walk ? { x: mix(shot.walk.from[0], shot.walk.to[0]), z: mix(shot.walk.from[1], shot.walk.to[1]), yaw: Math.atan2(shot.walk.to[0]-shot.walk.from[0], shot.walk.to[1]-shot.walk.from[1]), time: u * shot.duration, speed: Math.hypot(shot.walk.to[0]-shot.walk.from[0], shot.walk.to[1]-shot.walk.from[1]) / shot.duration } : undefined,
  };
}
