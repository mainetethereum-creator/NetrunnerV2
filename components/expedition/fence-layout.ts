import type {Point,Rect} from './config.ts';

export const FENCE_IDS=['modular-fence','concrete-security-fence','powered-mesh-fence'] as const;
export type FenceId=typeof FENCE_IDS[number];
export const isFence=(id:string):id is FenceId=>(FENCE_IDS as readonly string[]).includes(id);
export const fenceLength=(n=3)=>Math.min(24,Math.max(3,Math.round((Number.isFinite(n)?n:3)/3)*3));
type Placement=Point & {asset:string;rotation:number;length?:number};
export function snapFence(point:Point,rotation:number,length:number,instances:readonly Placement[]):Point{
  const p={...point},a=rotation*Math.PI/180,half=fenceLength(length)/2;
  let best=.65;
  for(const item of instances){
    if(!isFence(item.asset))continue;
    const b=item.rotation*Math.PI/180,l=fenceLength(item.length)/2;
    for(const end of [-1,1])for(const side of [-1,1]){
      const x=item.x+end*Math.cos(b)*l-side*Math.cos(a)*half;
      const z=item.z-end*Math.sin(b)*l+side*Math.sin(a)*half;
      const d=Math.hypot(x-point.x,z-point.z);
      if(d<best){best=d;p.x=x;p.z=z;}
    }
  }
  return p;
}
/** Short rotated AABBs follow the wall instead of blocking its whole diagonal
 * bounding box. Pier feet use their real footprint, including endpoint posts. */
export function fenceColliders(item:Placement):Rect[]{
  if(!isFence(item.asset))return [];
  const length=fenceLength(item.length),a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const solid=item.asset==='concrete-security-fence',powered=item.asset==='powered-mesh-fence';
  const panelDepth=solid?.34:powered?.32:.4,pierWidth=solid?.61:powered?.71:.58,pierDepth=solid?.92:powered?.91:.62;
  const rect=(x:number,w:number,d:number):Rect=>({x:item.x+x*c,z:item.z-x*s,w:Math.abs(c)*w+Math.abs(s)*d,d:Math.abs(s)*w+Math.abs(c)*d});
  const result:Rect[]=[];
  for(let x=-length/2+.125;x<length/2;x+=.25)result.push(rect(x,.25,panelDepth));
  for(let x=-length/2;x<=length/2;x+=3)result.push(rect(x,pierWidth,pierDepth));
  return result;
}
