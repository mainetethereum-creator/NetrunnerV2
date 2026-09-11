import {AUTHORED_LANDSCAPE} from './landscape-authored.ts';
import type {Point,Rect} from './config.ts';
export type LandscapePatch={id:string;name:string;x:number;z:number;radius:number;soil:string;moss:number;moisture:number;cracks:number;density:number;height:number;curl:number;wind:number;mound:number;scale:number;relief:number;seed:number};
export const landscapeDefaults=():LandscapePatch[]=>AUTHORED_LANDSCAPE.map(p=>({...p}));

const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function landscapeWeight(p:Point,patch:LandscapePatch,clearance=landscapeClearance(p)){return (1-smooth(.65,1,Math.hypot(p.x-patch.x,p.z-patch.z)/patch.radius))*clearance;}
export function landscapeClearance(p:Point,protectedRects:readonly Rect[]=[] ){let w=smooth(6.3,8,Math.abs(p.z-36));for(const r of protectedRects){const d=Math.hypot(Math.max(0,Math.abs(p.x-r.x)-r.w/2),Math.max(0,Math.abs(p.z-r.z)-r.d/2));w=Math.min(w,smooth(.8,2.5,d));if(w===0)break;}return w;}
const hash=(x:number,z:number)=>{const f=Math.sin(x*127.1+z*311.7)*43758.5453;return f-Math.floor(f);};
function noise(x:number,z:number){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return ((1-u)*hash(a,b)+u*hash(a+1,b))*(1-v)+((1-u)*hash(a,b+1)+u*hash(a+1,b+1))*v;}
function fbm(x:number,z:number){let v=0,a=.5;for(let i=0;i<5;i++){v+=a*noise(x,z);x*=2;z*=2;a*=.5;}return v;}
// Upstream broad FBM mound × fine drift formula, CPU evaluated for collision and
// mesh alike. Value noise replaces simplex here; the fragment/grass retain simplex.
export function landscapeDisplacement(p:Point,clearance?:number,patches:readonly LandscapePatch[]=landscapeDefaults()){let h=0;for(const a of patches){if(a.mound===0)continue;const w=landscapeWeight(p,a,clearance);if(!w)continue;const base=fbm(p.x*a.scale+a.seed,p.z*a.scale+a.seed),drift=fbm(p.x*.8+a.seed*.5,p.z*.8+a.seed*.5);h+=w*a.mound*base*(1-.4*a.relief+.4*a.relief*drift);}return h;}

export const landscapeRanges={x:[0,144,.25],z:[0,72,.25],radius:[2,18,.25],moss:[0,1,.01],moisture:[0,1,.01],cracks:[0,1,.01],density:[0,1,.01],height:[.05,1.4,.01],curl:[0,2.8,.01],wind:[0,.7,.01],mound:[0,1.5,.01],scale:[.02,.8,.01],relief:[0,2,.01],seed:[0,50,.1]} as const;
export function sanitizeLandscape(value:unknown):LandscapePatch[]{if(!Array.isArray(value)||!value.length||value.length>12)throw Error('Ожидается 1–12 участков');return value.map((raw,i)=>{const d=landscapeDefaults()[0],p={...d,id:`soil-${i}`,name:typeof raw?.name==='string'?raw.name.slice(0,60):`Участок ${i+1}`};for(const [key,[min,max]] of Object.entries(landscapeRanges)){const n=raw?.[key];if(typeof n!=='number'||!Number.isFinite(n))throw Error('Некорректные параметры');Object.assign(p,{[key]:Math.max(min,Math.min(max,n))});}p.soil=/^#[\da-f]{6}$/i.test(raw?.soil)?raw.soil:d.soil;return p;});}

/** Scene-owned landscape. Runtime starts from authored config; MASTER replaces only this instance. */
export function createLandscapeState(rects:readonly Rect[], initial=landscapeDefaults()) {
 let patches=initial.map(p=>({...p})),revision=0;let pads=rects.map(r=>({...r}));
 const clearance=(p:Point)=>landscapeClearance(p,pads);
 return {get patches(){return patches;},get revision(){return revision;},clearance,
 setEditorPads(extra:readonly Rect[]){pads=[...rects.map(r=>({...r})),...extra.map(r=>({...r}))];revision++;},
 displacement:(p:Point,c=clearance(p))=>landscapeDisplacement(p,c,patches),
 replace(next:LandscapePatch[]){patches=next.map(p=>({...p}));revision++;}};
}
export type LandscapeState=ReturnType<typeof createLandscapeState>;
