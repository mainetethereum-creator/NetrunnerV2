/** The forest crossing remains closed; this extension is scenery outside Base navigation. */
export const CANAL = {
  west:-68,east:48,north:34.35,south:48.35,waterY:-1.70,
  bridgeX:19,bridgeZ:41.1,gateZ:33.9,forestOpen:false,
} as const;
export const CANAL_LANTERNS=Array.from({length:13},(_,i)=>({x:-46+i*7.5,z:34.0}));
export const CANAL_NEAR_LANTERNS=Array.from({length:9},(_,i)=>({x:-44+i*11,z:49}));
export const BRIDGE_LANTERNS=[
  {x:16.75,z:33.9,y:1.6},{x:21.25,z:33.9,y:1.6},
  {x:16.85,z:46.8,y:.98},{x:21.15,z:46.8,y:.98},
] as const;
export const CANAL_SOLIDS=[
  {x:CANAL.bridgeX,z:CANAL.gateZ,w:4.75,d:.45},
  {x:CANAL.bridgeX+4.0,z:34.55,w:3.7,d:3.6},
] as const;
