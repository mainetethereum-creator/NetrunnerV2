// Shared by rendering and collision: compositions stay off the highway and POI approaches.
export const BRICK_WALLS=[{x:18,z:27,w:9,d:.55},{x:34,z:51,w:11,d:.55},{x:62,z:19,w:.55,d:10},{x:79,z:56,w:10,d:.55},{x:114,z:15,w:9,d:.55}];
export const WRECKS=[{x:19,z:41,w:4.6,d:2.2},{x:69,z:45,w:4.6,d:2.2}];
export const FIRE_BARRELS=[{x:13,z:29},{x:33,z:23},{x:49,z:47},{x:59,z:14},{x:79,z:45},{x:94,z:27},{x:115,z:49},{x:128,z:56}];
// Lightweight perimeter dressing: short fragments keep sight-lines open while
// breaking up the engineered grid with recognizable expedition obstacles.
export const MESH_FENCES=[{x:27,z:34,w:8,d:.12,turn:0},{x:73,z:28,w:7,d:.12,turn:0},{x:101,z:51,w:8,d:.12,turn:0},{x:53,z:16,w:.12,d:7,turn:0}];
export const BARRIERS=[{x:39,z:39,turn:-.08},{x:87,z:19,turn:.16},{x:121,z:34,turn:-.12},{x:16,z:55,turn:.08}];
export const DRESSING_COLLIDERS=[...BRICK_WALLS,...WRECKS,...MESH_FENCES.map(p=>({...p})),...BARRIERS.map(p=>({x:p.x,z:p.z,w:1.8,d:.8})),...FIRE_BARRELS.map(p=>({...p,w:.9,d:.9}))];
