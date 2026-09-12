import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CYBER_BUILDING_PROPS,createCyberBuildingLibrary,type CyberBuildingId} from './cyber-buildings';
import {createConcreteMaterial,prepareConcreteUv} from './cyber-concrete.ts';

export const BUILDING_PROPS=[
 ...CYBER_BUILDING_PROPS,
 {id:'building-workshop',name:'Здание · старая мастерская',category:'Здания',description:'Два этажа · облупленная штукатурка, гараж и терраса · 9 × 7 м'},
 {id:'building-stack',name:'Здание · неоновый жилой блок',category:'Здания',description:'Пять жилых уровней над мастерской · резервуары, кабели и опоры'},
 {id:'building-home2',name:'Здание · узкий дом с балконами',category:'Здания',description:'Три этажа · тёплые окна, бетонные балконы и голубой неон'},
 {id:'building-ruin',name:'Здание · разрушенная высотка',category:'Здания',description:'14 этажей · открытые перекрытия, рваные стены и обломки · 42 м'},
 {id:'building-courtyard',name:'Здание · городской техноблок',category:'Здания',description:'Ступенчатые объёмы · лоджия, лестницы и красный торговый автомат'},
 {id:'building-tokyo',name:'Здание · Токио, старая лавка',category:'Здания',description:'Наклонная металлическая оболочка · вывески, трубы и фонари'},
 {id:'building-tenement',name:'Здание · угловой доходный дом',category:'Здания',description:'Шесть этажей · пожарные лестницы, боковые балконы и витрины'},
] as const;
export type BuildingPropId=typeof BUILDING_PROPS[number]['id'];

/** Reference-built metre-scale exterior models; no world placement is performed here.
 * Prototypes are lazy, indexed and batched per material; placements share GPU resources. */
export function createBuildingLibrary(anisotropy=4,ready?:()=>void){
 const textures:T.Texture[]=[],materials:T.MeshStandardMaterial[]=[];
 let disposed=false;
 const atlasMaps:T.Texture[]=[];
 const atlas=new T.TextureLoader().load('/game/props/salvage/building-atlas.webp',loaded=>{if(disposed)return;atlasMaps.forEach(t=>{t.source=loaded.source;t.needsUpdate=true;});ready?.();});atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=Math.min(8,anisotropy);
 const cyber=createCyberBuildingLibrary(atlas);
 const atlasTint=[0xa5a49d,0x999b96,0x8e918d,0x7f8584,0x8c907f,0x8b8780,0x89979b,0xffffff,0x706d67];
 // Replace the existing concrete bucket in place. All other atlas tiles keep
 // their authored material, and concrete borrows the one full-atlas texture.
 const concrete=createConcreteMaterial(atlas);concrete.vertexColors=false;concrete.color.setHex(0xb5b5b5);materials.push(concrete);
 for(let i=1;i<9;i++){const map=new T.Texture();map.colorSpace=atlas.colorSpace;map.repeat.set(.329,.329);map.offset.set((i%3)/3+.002,(2-Math.floor(i/3))/3+.002);map.anisotropy=Math.min(8,anisotropy);textures.push(map);atlasMaps.push(map);materials.push(new T.MeshStandardMaterial({map,color:atlasTint[i],bumpMap:map,bumpScale:i<3?.025:.012,roughness:i===6?.38:.88,metalness:i===3||i===4?.5:0,...(i===7?{emissive:0xffa13e,emissiveMap:map,emissiveIntensity:.75}:{})}));}
 const mat=(p:T.MeshStandardMaterialParameters)=>{materials.push(new T.MeshStandardMaterial(p));return materials.length-1;};
 const iron=mat({map:materials[3].map,color:0x555c60,roughness:.8,metalness:.6});
 const cyan=mat({color:0x7eeaff,emissive:0x08cfff,emissiveIntensity:2.5,roughness:.3});
 const amber=mat({color:0xffd597,emissive:0xff830d,emissiveIntensity:2,roughness:.4});
 const olive=mat({map:materials[4].map,color:0x8c9875,roughness:.85,metalness:.35});
 const red=mat({map:materials[3].map,color:0xbf3434,roughness:.8});
 const cache=new Map<BuildingPropId,T.Group>();
 function sign(text:string,bg:string,fg:string){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.strokeStyle=fg;ctx.lineWidth=5;ctx.strokeRect(6,6,500,116);ctx.fillStyle=fg;ctx.font='bold 68px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,88,480);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.push(t);return mat({map:t,roughness:.8});}
 const tokyo=sign('東京本通','#b63122','#f3d76e'),hotel=sign('HOTEL','#742b29','#d1c4ac'),market=sign('24 OPEN','#344a43','#bbd8a9');
 function build(id:BuildingPropId){
 const buckets=new Map<number,T.BufferGeometry[]>();let transform=new T.Matrix4();
 const add=(g:T.BufferGeometry,m:number,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{if(m===0)prepareConcreteUv(g,x,y,z);g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1)));g.applyMatrix4(transform);const a=buckets.get(m)??[];a.push(g);buckets.set(m,a);};
 const box=(w:number,h:number,d:number,m:number,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>add(new T.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz);
 const cyl=(r:number,h:number,m:number,x=0,y=0,z=0,rx=0,rz=0,n=12)=>add(new T.CylinderGeometry(r,r,h,n),m,x,y,z,rx,0,rz);
 const line=(a:number[],b:number[],r=.025,m=iron)=>{const va=new T.Vector3().fromArray(a),vb=new T.Vector3().fromArray(b),g=new T.CylinderGeometry(r,r,va.distanceTo(vb),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),vb.clone().sub(va).normalize()));const mid=va.add(vb).multiplyScalar(.5);add(g,m,mid.x,mid.y,mid.z);};
 const face=(x:number,z:number,angle:number,fn:()=>void)=>{const old=transform;transform=new T.Matrix4().makeRotationY(angle);transform.setPosition(x,0,z);fn();transform=old;};
 const panel=(w:number,h:number,m:number,x:number,y:number,z:number)=>add(new T.PlaneGeometry(w,h),m,x,y,z);
 function window(x:number,y:number,z:number,w=1.15,h=1.65,lit=false,bars=false){
  // Glazing sits behind deep masonry reveals and two distinct sash layers.
  box(w+.24,h+.24,.06,5,x,y,z);box(w,h,.025,lit?7:6,x,y,z+.045);
  for(const dx of [-w/2-.07,w/2+.07])box(.14,h+.28,.32,0,x+dx,y,z+.15);
  for(const dy of [-h/2-.07,h/2+.07])box(w+.28,.14,.32,0,x,y+dy,z+.15);
  for(const dx of [-w/2,0,w/2])box(.045,h,.085,iron,x+dx,y,z+.13);
  for(const dy of [-h/2,h*.21,h/2])box(w,.055,.085,iron,x,y+dy,z+.13);
  box(w+.38,.09,.43,0,x,y-h/2-.13,z+.17);box(w+.27,.035,.38,iron,x,y+h/2+.155,z+.16);
  if(lit){box(w*.15,h-.12,.025,3,x-w*.37,y,z+.072);box(w*.2,h-.12,.025,3,x+w*.34,y,z+.072);}
  if(bars){for(let j=1;j<5;j++)box(w,.055,.1,iron,x,y-h/2+j*h/5,z+.34,-.2);for(const dx of [-w/2,w/2])box(.035,h,.13,iron,x+dx,y,z+.29);}
 }
 function door(x:number,z:number,base=0){
  box(1.3,2.42,.06,5,x,base+1.21,z);box(.99,2.18,.045,3,x,base+1.15,z+.065);
  for(const dx of [-.6,.6])box(.15,2.4,.34,0,x+dx,base+1.2,z+.17);box(1.35,.15,.34,0,x,base+2.38,z+.17);
  for(const y of [.27,1.4]){box(.78,y<1?.25:.95,.025,iron,x,base+y,z+.103);box(.7,y<1?.18:.86,.025,3,x,base+y,z+.121);}
  box(.055,.3,.055,4,x+.35,base+1.14,z+.17);for(const y of [.42,1.95])box(.06,.13,.07,iron,x-.49,base+y,z+.13);
  box(1.4,.13,.6,0,x,base+.065,z+.23);box(.24,.3,.16,iron,x+.86,base+1.35,z+.15);box(.15,.12,.03,4,x+.86,base+1.4,z+.25);
 } function shutter(x:number,z:number,w:number,h:number,base=0){box(w+.2,h+.14,.14,iron,x,base+h/2,z);box(w,h,.08,4,x,base+h/2,z+.1);for(let j=0;j<h/.13;j++)box(w,.022,.055,iron,x,base+.065+j*.13,z+.17);box(w+.35,.23,.32,3,x,base+h+.1,z+.07);}
 function neon(x:number,y:number,z:number,h=1.5){box(.3,h+.25,.18,iron,x,y,z);box(.085,h,.045,cyan,x,y,z+.12);}
 function ac(x:number,y:number,z:number){box(.86,.63,.43,0,x,y,z);cyl(.245,.04,iron,x,y,z+.24,Math.PI/2,0,20);add(new T.TorusGeometry(.22,.018,5,20),4,x,y,z+.27);for(let k=0;k<5;k++){const a=k*Math.PI*2/5;box(.07,.34,.02,4,x,y,z+.27,0,0,a);}for(let j=0;j<6;j++)box(.028,.49,.018,iron,x-.37+j*.037,y,z+.225);box(.64,.055,.06,iron,x,y-.36,z);}
 function rail(w:number,x:number,y:number,z:number){for(const h of [.42,.95])box(w,.045,.045,iron,x,y+h,z);for(let j=0;j<=Math.ceil(w/.45);j++)box(.032,.95,.032,iron,x-w/2+j*w/Math.ceil(w/.45),y+.475,z);}
 function roof(w:number,d:number,h:number,x=0,z=0){box(w+.2,.18,d+.2,0,x,h,z);box(w-.2,.04,d-.2,5,x,h+.12,z);for(const sx of [-1,1]){box(.14,.45,d+.2,0,x+sx*w/2,h+.3,z);box(.24,.065,d+.3,4,x+sx*w/2,h+.55,z);}for(const sz of [-1,1]){box(w,.45,.14,0,x,h+.3,z+sz*d/2);box(w+.3,.065,.24,4,x,h+.55,z+sz*d/2);}for(let j=1;j<Math.floor(w/1.4);j++)box(.018,.018,d-.35,iron,x-w/2+j*1.4,h+.15,z);box(.7,.08,.8,iron,x+w*.23,h+.17,z-d*.2);box(.56,.035,.66,4,x+w*.23,h+.23,z-d*.2);} function tank(x:number,y:number,z:number,r=.7,h=1.5){cyl(r,h,iron,x,y+h/2,z,0,0,24);for(const dy of [.06,h*.36,h*.7,h-.04])add(new T.TorusGeometry(r+.015,.026,6,24),4,x,y+dy,z,Math.PI/2);cyl(r+.045,.06,4,x,y+h,z,0,0,24);}
 function pipe(x:number,z:number,h:number){cyl(.065,h,iron,x,h/2,z);for(let y=.4;y<h;y+=1.3)box(.22,.065,.2,3,x,y,z);}
 function facade(w:number,h:number,floors:number,cols:number,wall=0,lit=false){const fh=h/floors,cw=w/cols;for(let f=0;f<floors;f++){box(w,.18,.3,wall,0,f*fh+.09,0);for(let c=0;c<cols;c++){const x=-w/2+cw*(c+.5);box(cw,fh,.28,wall,x,f*fh+fh/2,0);window(x,f*fh+fh*.59,.18,Math.min(1.4,cw*.59),fh*.52,lit&&(f+c)%3!==0,lit);}}}
 function cable(points:number[][]){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3().fromArray(p)));add(new T.TubeGeometry(curve,20,.037,6,false),iron);}
 function ladder(x:number,z:number,y:number,h:number){for(const dx of [-.34,.34])cyl(.026,h,iron,x+dx,y+h/2,z);for(let i=0;i<h/.29;i++)box(.7,.035,.035,iron,x,y+i*.29,z);}
 if(id==='building-workshop'){
 box(9,.18,7,0,0,.09);box(9,6.5,7,0,0,3.35);for(const s of [-1,1])face(0,s*3.5,s<0?Math.PI:0,()=>{for(const x of [-4.35,-1.5,1.5,4.35])box(.3,6.6,.35,1,x,3.4,.12);box(9,.42,.35,1,0,3.65,.12);for(const x of [-3,-.85,1.2,3.25])window(x,5.05,.17,.95,1.65);box(9,.15,.48,0,0,3.35,.15);});
 shutter(-2.8,3.68,2.2,2.65,.18);door(1.15,3.68,.18);for(const x of [-2.8,.05,2.95]){window(x,3.02,3.7,2.3,.35);}
 for(const s of [-1,1])face(s*4.5,0,s*Math.PI/2,()=>{window(-1.65,5.05,.18,1,1.65);window(1.75,5.05,.18,.6,.85);for(const z of [-3.3,0,3.3])box(.28,6.45,.3,1,z,3.4,.1);box(7,.43,.35,1,0,3.65,.12);});
 roof(9,7,6.7);for(const z of [-3.5,3.5]){for(const x of [-4.45,-2.25,0,2.25,4.45])box(.42,1.05,.42,1,x,7.25,z);line([-4.5,7.65,z],[4.5,7.65,z],.035,3);}box(3.3,1.8,2.7,0,-1,7.65,-.65);box(3.6,.17,3,0,-1,8.62,-.65);door(-1,.72,6.7);
 }
 if(id==='building-home2'){
 box(6.4,.16,6.2,0,0,.08);box(5.2,9.3,4.8,0,0,4.75);face(0,2.4,0,()=>{facade(5.2,9.3,3,4,0,true);door(.7,.3,.16);for(const y of [3.2,6.3,9.4]){box(5.7,.2,1.35,0,0,y,.6);box(5.7,.72,.18,0,0,y+.45,1.22);for(const x of [-2.76,2.76])box(.18,.72,1.3,0,x,y+.45,.63);box(.8,.06,.13,amber,-1,y-.12,.64);}for(const y of [4.9,8])ac(-.15,y,.48);neon(2.5,1.65,.23);});
 roof(5.2,4.8,9.45);box(3.4,1.1,2.6,0,.6,10,-.5);tank(-1.5,9.55,-1.3,.52,1.1);face(2.6,0,Math.PI/2,()=>{for(const x of [-1.4,0,1.4]){cyl(.42,.13,iron,x,9.92,.17,Math.PI/2,0,24);for(let j=0;j<6;j++)box(.64,.04,.09,4,x,9.67+j*.1,.26);}pipe(1.5,.28,9.6);ac(-.8,6.9,.22);neon(-1.9,8.7,.25);neon(1.85,2.3,.26,1.2);});
 }
 if(id==='building-stack'){
 box(11,.2,9,0,0,.1);box(7.7,3.3,6.5,0,-.7,1.85,.6);for(const x of [-3.25,-.65,1.95])shutter(x,3.9,2.25,2.9,.2);
 for(const x of [-4.1,4.1])for(const z of [-3.2,3.2]){box(.5,5.4,.5,0,x,2.9,z);for(const dx of [-1,1])line([x,4.1,z],[x+dx*.65,4.85,z],.11);}
 box(10.5,.35,8,0,0,5.05);box(7.8,13.1,6.5,0,-.8,11.7,-.4);
 for(const s of [-1,1])face(-.8,s<0?-3.65:2.87,s<0?Math.PI:0,()=>{for(let f=0;f<5;f++){const y=6.5+f*2.55;for(const x of [-2.9,-.95,1,2.9])window(x,y,.2,1.3,1.55,(f+Math.round(x))%3!==0,true);box(7.9,.23,.38,0,0,y-1.05,.1);}for(const x of [-3.8,-1.8,1.8,3.8])box(.18,13.3,.2,0,x,11.7,.22);pipe(-1.55,.42,18);neon(-1.5,16.9,.45,1.85);});
 face(-4.7,-.4,-Math.PI/2,()=>{for(let f=0;f<4;f++){const y=8.2+f*2.55;window(0,y,.35,3.4,1.6,true,true);box(4.2,.65,.9,0,0,y-1,.3);for(const x of [-2.05,2.05])box(.14,2,.8,0,x,y,.3);}});
 for(const y of [10.2,11.3])ac(2.65,y,3.15);neon(-4.35,2,3.95);neon(4.1,2.3,3.5);roof(7.8,6.5,18.35,-.8,-.4);tank(-2,18.5,-.8,1.05,2.15);tank(.5,18.5,-1.9,.7,1.35);box(1.5,.9,1.25,0,1.4,18.9,1);pipe(4.3,2.6,10.2);neon(4.3,9.6,2.76,1.3);for(const dy of [0,.35,.7])cable([[2.7,14-dy,3.1],[3.4,10.6-dy,3.2],[4.3,10.1-dy,2.6]]);
 for(const x of [-3.2,-.7,1.8]){box(2.45,.12,.8,3,x,3.65,4.15,.24);box(.8,.06,.1,amber,x,3.5,4.42);}rail(10,0,5.24,3.86);
 }
 if(id==='building-ruin'){
  const w=15,d=9,fh=3;
 // Discrete wall piers and lintels leave genuine open windows and torn floor edges.
 for(let f=0;f<14;f++){const y=f*fh;box(w-(f%5===0?1.3:0),.18,d,0,f%5===0?.65:0,y+.09);for(const s of [-1,1])face(0,s*d/2,s<0?Math.PI:0,()=>{for(let c=0;c<5;c++){const x=-6+c*3,broken=(c===0&&f>2&&f%4!==1)||(c===4&&f>3&&f<8);if(!broken){box(2.86,.95,.28,2,x,y+.63);box(2.86,.58,.28,2,x,y+2.71);box(.72,1.7,.28,2,x-1.07,y+1.85);box(.55,1.7,.28,2,x+1.15,y+1.85);}else{box(1.1,.48,.3,2,x+.8,y+.48,0,0,0,.13);for(let r=0;r<3;r++)line([x-.8+r*.32,y+.12,0],[x-.7+r*.32,y+.9+(r%2)*.4,.14],.018,3);}box(.16,3,.38,0,x+1.44,y+1.5,.03);}box(w,.14,.39,0,0,y+2.96,.02);});
 for(const s of [-1,1])face(s*w/2,0,s*Math.PI/2,()=>{for(let c=0;c<3;c++){const x=-3+c*3;if((f+c)%5!==0){box(2.85,1.15,.27,2,x,y+.7);box(2.85,.5,.27,2,x,y+2.75);box(.55,1.8,.27,2,x-1.15,y+1.8);}box(.2,3,.35,0,x+1.4,y+1.5);} });
 box(.22,3,d-.5,0,-2.2,y+1.5);box(.22,3,d-.5,0,2.4,y+1.5);if(f%3===1)ac(2.4,y+1.65,4.65);
 }
 for(let j=0;j<34;j++){const a=j*2.399,r=7+(j%4)*1.15,x=Math.cos(a)*r,z=Math.sin(a)*(4+j%3);add(new T.DodecahedronGeometry(.5+j%4*.26,0).scale(1.5,.5,1),8,x,.25+j%3*.15,z,j*.27,j*.83,.12);}
 for(const s of [-1,1]){box(5,.2,3.8,0,s*8,.95,1,.15,.3,s*.37);for(let j=0;j<5;j++)line([s*7,.4,j*.5],[s*9,1.1,j*.5],.02,3);}for(const x of [-5,5]){cyl(.055,1.4,iron,x,42.6,0);add(new T.SphereGeometry(.48,16,8,0,Math.PI*2,0,Math.PI/2),4,x,43.1,0,.9);}
 }
 if(id==='building-courtyard'){
 box(10,.16,8,0,0,.08);box(3,6.7,5.7,0,-2.9,3.5,-.35);box(3.4,8.3,5.7,0,2.5,4.3,-.35);box(2.3,3.1,4.8,olive,-.15,1.7,.1);roof(3,5.7,6.9,-2.9,-.35);roof(3.4,5.7,8.5,2.5,-.35);
 window(-2.9,5.9,2.53,2,.85);window(2.5,7.3,2.53,2.4,1.8);door(2.6,2.57,.16);shutter(-.3,2.56,1.45,2.5,.16);window(.7,2,2.58,.7,1.2);box(3.2,.22,2.2,0,-.25,3.25,2.1);box(3.35,.2,2.2,0,-.25,5.85,2.1);rail(3.1,-.25,3.35,3.2);for(const x of [-1.75,1.25])box(.1,2.45,.1,iron,x,4.55,3.12);window(-1,4.6,1.13,1.3,2,true,true);for(let j=0;j<10;j++)box(.055,2.45,.055,4,-1.7+j*.14,4.58,3.12);
 ladder(-3.9,2.7,.2,6.65);ladder(1.05,2.65,6.7,1.7);for(const x of [1.1,3.9])pipe(x,2.67,8.45);ac(2.65,5.5,2.76);cyl(.14,1.55,iron,2.7,9.15,-.9);cyl(.22,.08,4,2.7,9.93,-.9);
 face(4.2,-.3,Math.PI/2,()=>{for(const y of [2.1,6.5]){box(2.7,.92,.12,iron,0,y,.1);for(let j=0;j<8;j++)box(2.5,.035,.07,4,0,y-.35+j*.1,.2);}});
 box(.85,1.85,.65,red,-3.75,1.08,3.16);box(.61,.89,.025,6,-3.75,1.35,3.5);box(.5,.15,.04,iron,-3.75,.4,3.51);for(let j=0;j<4;j++)box(.07,.09,.04,amber,-3.44,.9+j*.14,3.52);panel(.55,.22,market,-3.75,1.88,3.505);neon(-1.78,1.7,2.7,.8);
 }
 if(id==='building-tokyo'){
 box(8.1,.12,6.9,0,0,.06);box(7,3,5.5,0,0,1.62);box(6.4,9.9,4.8,4,0,7.85,-.35);box(3.5,5,5,olive,-1.6,11.1,-.35);
 // Sloped sheet-metal shoulders give the reference its characteristic tapered silhouette.
 box(2.4,5.6,5.1,4,2.65,6.2,0,0,0,.17);box(4.7,4.5,.2,4,-.7,6.3,2.67,-.16);for(let j=0;j<18;j++)box(.035,4.5,.06,3,-2.9+j*.26,6.3,2.79,-.16);
 shutter(-.75,2.84,3.55,2.55,.12);door(2.25,2.84,.12);box(4.4,.13,1.15,3,-.65,3.27,3.19,.22);panel(3.9,.85,tokyo,-.65,4.05,3.04);panel(1.2,.33,tokyo,2.6,2.86,3.02);window(-.5,5.5,2.87,2.45,1.6);box(1.4,1.3,.43,olive,1.78,5.45,2.89);box(3.3,.7,.23,olive,-1.65,8.6,2.33);
 for(const x of [-3.2,3.2])pipe(x,2.83,12.7);for(const x of [2.45,2.67,2.9])cable([[x,12.6,2.5],[x,9.6,2.8],[x+.35,7.1,3],[x+.5,3.4,3]]);
 for(const y of [1.4,2.3,3.2])ac(-3.05,y,2.96);for(const x of [-2.3,-1.45,.3,1]){cyl(.16,.4,x>0?red:olive,x,2.85,3.61,0,0,14);line([x,3.3,3.61],[x,3.02,3.61],.012);}
 face(-3.5,0,-Math.PI/2,()=>{for(const y of [4.6,7.3,10.1]){window(0,y,.18,1.6,1.4);box(4.4,.18,.7,0,0,y-.85,.22);}pipe(1.9,.3,12);ac(-1.4,4,.35);});
 box(2.2,2.6,.22,iron,1.65,14.05,-.9);box(1.9,2.3,.08,3,1.65,14.05,-.75);for(let i=0;i<4;i++)cyl(.022,2.5+i*.6,iron,-2.7+i*.28,13.5+i*.3,-1.2);for(const y of [10,11.5])box(3.4,.15,.2,olive,-1.6,y,2.24);line([-3.1,12.8,2.43],[.1,9.5,2.43],.05,olive);add(new T.SphereGeometry(.45,20,10,0,Math.PI*2,0,Math.PI/2),4,-2.7,5.1,3.1,1.1);roof(6.4,4.8,12.85,0,-.35);
 }
 if(id==='building-tenement'){
 const w=12,d=8,h=18.6;box(w,h,d,1,0,h/2);for(const s of [-1,1])face(0,s*d/2,s<0?Math.PI:0,()=>{facade(w,h,6,5,1);for(let f=1;f<6;f++)box(w,.14,.36,0,0,f*3.1,.16);for(const x of [-5.7,-3.55,-1.15,1.15,3.55,5.7])for(let f=1;f<5;f++){box(.045,1.5,.05,0,x,f*3.1+1.8,.18);}for(let c=0;c<4;c++){box(2.75,2.65,.1,iron,-4.5+c*3,1.36,.19);window(-4.5+c*3,1.36,.27,2.5,2.4);} });
 for(const s of [-1,1])face(s*w/2,0,s*Math.PI/2,()=>{facade(d,h,6,3,1);for(let f=1;f<5;f++){const y=f*3.1;box(6.9,.12,1.04,iron,0,y,.45);rail(6.9,0,y+.06,.94);for(const x of [-3.42,3.42]){line([x,y+.08,.05],[x,y+.08,.98]);line([x,y+1,.05],[x,y+1,.98]);}}});
 for(let f=1;f<6;f++){const y=f*3.1;box(3.5,.12,1.1,iron,-2,y,4.56);rail(3.5,-2,y+.06,5.07);if(f<5){const x0=f%2?-3.4:-.6,x1=f%2?-.6:-3.4;for(let j=0;j<12;j++){const t=j/11;box(.57,.045,.65,iron,x0+(x1-x0)*t,y+t*3.1,4.66);}for(const z of [4.34,4.98]){line([x0,y,z],[x1,y+3.1,z],.045);line([x0,y+.88,z],[x1,y+3.98,z],.025);for(let j=0;j<6;j++){const t=j/5;line([x0+(x1-x0)*t,y+t*3.1,z],[x0+(x1-x0)*t,y+t*3.1+.88,z],.019);}}}}
 roof(w,d,h);box(4.4,2.6,3.1,1,3.7,17.3,2.5);roof(4.4,3.1,18.7,3.7,2.5);panel(.9,2.5,hotel,2.7,4.3,4.24);face(6,0,Math.PI/2,()=>panel(.9,2.5,hotel,2.8,4.3,.3));door(1.2,4.28);for(const y of [4.6,10.8])ac(4.8,y,4.3);
 }
 // Secondary architectural layers share existing materials and the same draw buckets.
 const bolt=(x:number,y:number,z:number)=>cyl(.025,.035,iron,x,y,z,Math.PI/2,0,6);
 const vent=(x:number,y:number,z:number,w=1,h=.65)=>{box(w+.12,h+.12,.12,iron,x,y,z);for(let j=0;j<Math.ceil(h/.09);j++)box(w,.045,.13,4,x,y-h/2+.04+j*.09,z+.07,-.3);};
 const seamGrid=(w:number,h:number,z:number,step=1.5)=>{for(let x=-w/2+step;x<w/2;x+=step)box(.018,h,.018,iron,x,h/2,z);for(let y=step;y<h;y+=step)box(w,.018,.018,iron,0,y,z);};
 const crate=(x:number,y:number,z:number)=>{box(.75,.6,.65,olive,x,y+.3,z);for(const dx of [-.27,.27]){box(.055,.66,.7,iron,x+dx,y+.3,z);}box(.77,.055,.68,iron,x,y+.58,z);};
 const brokenPanel=(points:number[][],depth:number,m:number,x:number,y:number,z:number,rx=0,ry=0,rz=0)=>{const shape=new T.Shape(points.map(p=>new T.Vector2(p[0],p[1])));add(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1}),m,x,y,z,rx,ry,rz);};
 if(id==='building-workshop'){
  for(const s of [-1,1])face(s*4.5,0,s*Math.PI/2,()=>{box(7,.14,.28,1,0,6.5,.22);for(const x of [-3.3,0,3.3]){box(.42,.25,.48,1,x,6.35,.16);}pipe(3,.24,6.7);});
  for(const z of [-3.5,3.5])for(const x of [-4.45,-2.25,0,2.25,4.45]){box(.5,.09,.5,1,x,7.8,z);for(const s of [-1,1])brokenPanel([[0,0],[.36,0],[.26,.1],[.18,.3],[0,.34]],.32,1,x+s*.19,7.05,z-.16,0,0,s<0?0:Math.PI/2);}
  for(let i=0;i<8;i++){box(.045,2.12,.045,3,.73+i*.12,1.43,3.99);for(const y of [.65,1.3,1.95])box(.9,.035,.035,3,1.15,y,4.01);}box(.7,.16,.18,iron,-2.8,2.85,3.96);box(.46,.055,.09,amber,-2.8,2.81,4.08);vent(3,1.3,3.6,.65,.42);ladder(3.8,-3.68,.2,6.6);cyl(.12,1.15,3,.2,7.32,-1.7);cyl(.18,.08,4,.2,7.93,-1.7);
 }
 if(id==='building-home2'){
  face(2.6,0,Math.PI/2,()=>{seamGrid(4.8,9.45,.025,1.55);for(const y of [3.15,6.3,9.42])box(4.8,.045,.05,iron,0,y,.04);for(const x of [-1.4,0,1.4])add(new T.TorusGeometry(.44,.045,6,24),4,x,9.92,.27);cable([[1.5,7.8,.33],[1.45,7.2,.47],[.6,6.5,.47],[.55,2.8,.35]]);vent(-1.7,2.8,.22,.55,.65);});
  for(const y of [3.2,6.3,9.4]){box(5.75,.075,.26,4,0,y+.82,3.62);for(const x of [-2.2,0,2.2]){box(.22,.09,.035,iron,x,y+.48,3.735);bolt(x-.065,y+.48,3.76);bolt(x+.065,y+.48,3.76);}for(const x of [-2.4,2.4])box(.18,.2,.8,0,x,y-.18,2.95);}
  neon(1.6,10.5,-1.8,.75);cyl(.022,1.1,iron,1.6,10.95,-1.85);vent(2,1.4,2.72,.55,1.65);box(.85,.11,.42,iron,.7,2.75,2.9);box(.65,.035,.1,amber,.7,2.68,3.02);ladder(-1.95,-2.6,6.6,3);
 }
 if(id==='building-stack'){
  face(3.1,-.4,Math.PI/2,()=>{for(let f=0;f<5;f++){const y=6.5+f*2.55;window(-1.8,y,.18,1.1,1.55,f%2===0,true);vent(1.65,y,.2,1.2,1.4);box(6.5,.15,.25,0,0,y-1.05,.1);}pipe(2.8,.3,18.4);});
  for(const x of [-4.6,-2.6,.9,3])for(let f=0;f<5;f++){const y=5.45+f*2.55;box(.29,.25,.075,3,x,y,3.19);bolt(x-.08,y,3.25);bolt(x+.08,y,3.25);}
  for(const x of [-4.1,4.1])for(const z of [-3.2,3.2]){box(.78,.16,.78,0,x,.3,z);box(.73,.12,.73,iron,x,4.93,z);for(const dx of [-.24,.24])bolt(x+dx,.39,z+.405);}
  for(let j=0;j<5;j++){crate(3.7,.2,-2+j*.74);if(j<2)crate(3.7,.81,-2+j*.74);}crate(-3.4,.2,4.08);crate(-3.4,.81,4.08);crate(-2.5,.2,4.08);crate(3.3,5.24,1.6);
  for(const x of [-2.9,-1.7,.1]){line([x,18.55,-.8],[x,18.55,1.4],.065);line([x,18.55,1.4],[x,17.5,1.4],.065);}ladder(-4.9,-2.4,5.2,13.25);vent(1.4,18.95,1.65,1.25,.55);rail(7,-.8,18.45,-3.62);for(const dy of [0,.23])cable([[-1.8,9.1,3.4],[-1.5,6,3.62],[.2,6.4,3.7],[1,8.5,3.5+dy]]);box(.7,1,.22,iron,3.2,1.3,3.98);vent(3.2,1.55,4.13,.5,.28);
 }
 if(id==='building-ruin'){
  for(let f=2;f<14;f++){const y=f*3;for(const s of [-1,1]){const x=s*7.1;brokenPanel([[0,0],[s*1.3,.12],[s*1,.35],[s*.5,.5],[s*.7,.7],[0,.52]],.8,0,x,y,-4.7);for(let j=0;j<4;j++){line([x-s*.4,y+.11,-4.3+j*.28],[x+s*(.5+j*.14),y+.03,-4.4+j*.28],.018,3);}if(f%3!==0){brokenPanel([[0,0],[s*.55,.1],[s*.4,.65],[s*.68,1],[s*.3,1.28],[0,1.65]],.3,2,x,y+.2,4.4);line([x,y+.2,4.6],[x+s*.15,y+1.85,4.62],.018,3);}}}
  for(let j=0;j<14;j++){const a=j*2.4,x=Math.cos(a)*8.2,z=Math.sin(a)*5.2;brokenPanel([[-1.4,-.5],[-.7,-.8],[.5,-.65],[1.4,-.1],[.75,.5],[-.6,.65]],.18,0,x,.45+(j%3)*.24,z,Math.PI/2+(j%4)*.15,j*.7,.2);for(let k=0;k<3;k++)line([x-.6+k*.4,.5,z],[x-.6+k*.4,.8,z+1.1],.016,3);}
  for(let j=0;j<35;j++){const a=j*2.4;box(.36,.16,.2,2,Math.cos(a)*(7+j%4),.12+(j%3)*.08,Math.sin(a)*(4+j%3),j*.2,j*.9,.16);}for(const x of [-6,-3,0,3,6]){line([x,41.7,-4.5],[x+.15,42.8,-4.6],.018,3);}for(let f=1;f<12;f+=3){box(1.7,.09,.8,0,-5.7,f*3+.7,2.6,0,0,.22);box(.8,.1,2.1,0,5.8,f*3+.5,-2.7,.15);}
 }
 if(id==='building-courtyard'){
  face(4.2,-.35,Math.PI/2,()=>{seamGrid(5.7,8.45,.02,1.65);for(const x of [-1,.1,1.1]){box(.22,.45,.18,olive,x,1.2,.16);line([x,.95,.2],[x,.2,.2],.025);}vent(1.7,4.4,.15,.45,.8);});
  face(-4.4,-.35,-Math.PI/2,()=>{seamGrid(5.7,6.9,.02,1.5);window(0,3.9,.18,2.2,1.1);pipe(2.4,.2,6.9);});
  for(const x of [-3.9,1.05])for(const y of [1,3,5,6.7])line([x-.34,y,2.53],[x-.34,y,2.78],.026);for(let j=0;j<6;j++)box(.025,2.7,.04,iron,-1.4+j*.32,1.55,2.54);for(const y of [.6,1.2,1.8,2.4])box(2.1,.025,.04,iron,-.25,y,2.54);
  box(1.1,.11,1.3,iron,-.25,5.99,1.8);for(let j=0;j<7;j++)box(.9,.04,.07,4,-.25,6.06,1.28+j*.16);box(.2,.55,.25,iron,-2.6,7.15,-1.3);cyl(.07,.55,4,-1.95,7.18,-1.3);box(.12,.7,.06,amber,-1.76,1.95,2.81);cable([[-2.8,5.9,2.75],[-2.5,3.6,2.85],[-1.8,3.25,2.87]]);for(let j=0;j<3;j++){box(.12,.22,.04,olive,-3.97+j*.21,1.48,3.53);box(.13,.018,.06,iron,-3.97+j*.21,1.32,3.53);}box(.12,.035,.05,4,-3.43,.83,3.54);
 }
 if(id==='building-tokyo'){
  for(const y of [4,5.4,6.8,8.2,9.6,11]){box(.8,.08,.12,iron,3.65,y,2.62);for(const x of [3.34,3.94])bolt(x,y,2.7);}for(const x of [-2.9,-2.6])cable([[x,11.7,2.4],[x,8.8,2.5],[x-.3,7.8,2.9],[x-.3,3.5,3.2]]);
  for(let i=0;i<9;i++){box(.13,.1,.09,amber,-2.35+i*.42,4.6,3.16);box(.13,.09,.09,olive,-2.35+i*.42,3.52,3.16);}box(4.2,.12,.32,olive,-.65,4.55,3.01);box(4.2,.12,.32,olive,-.65,3.55,3.01);for(const x of [-2.7,1.4])box(.12,1.12,.32,olive,x,4.04,3.01);
  for(const x of [-2.3,-1.45,.3,1]){for(const y of [2.66,3.04])cyl(.13,.055,iron,x,y,3.61,0,0,12);for(let j=0;j<8;j++){const a=j*Math.PI/4;line([x+Math.cos(a)*.15,2.7,3.61+Math.sin(a)*.15],[x+Math.cos(a)*.15,3,3.61+Math.sin(a)*.15],.007,3);}}
  for(const x of [.8,1.45,2.1,2.75]){line([x,14.8,-.7],[x,14.8,.3],.025);box(.17,.09,.2,4,x,14.75,.3);}vent(-1.3,9.2,2.36,1.7,.55);cyl(.43,.2,olive,-1.2,10,2.42,Math.PI/2,0,20);box(1.3,.08,.25,olive,-1.2,9.98,2.59);for(let j=0;j<5;j++)box(.02,2.6,.02,iron,1+j*.35,14.05,-.69);box(.45,.55,.3,0,2.2,3.8,3.08);vent(2.2,3.85,3.26,.3,.3);ladder(-3.7,-1.6,.2,5.7);
 }
 if(id==='building-tenement'){
  for(const s of [-1,1])face(0,s*4,s<0?Math.PI:0,()=>{box(12,.28,.46,1,0,15.65,.2);box(12.2,.12,.6,0,0,18.35,.22);for(const x of [-5.85,5.85])box(.27,18.5,.25,0,x,9.25,.1);for(let f=1;f<5;f++)for(const x of [-4.8,0,4.8]){box(1.3,.35,.035,0,x,f*3.1+.33,.18);for(let j=0;j<5;j++)box(.03,.27,.025,1,x-.48+j*.24,f*3.1+.33,.215);}for(let c=0;c<4;c++){const x=-4.5+c*3;box(2.8,.25,.24,3,x,2.83,.34);box(2.8,.19,.2,0,x,.15,.32);for(const dx of [-.8,0,.8])box(.04,2.25,.06,iron,x+dx,1.4,.49);}});
  for(let f=1;f<6;f++){const y=f*3.1;for(const x of [-3.45,-.55])line([x,y-.65,4.05],[x,y,4.98],.04);for(let j=0;j<12;j++)box(.024,.026,1.05,4,-3.65+j*.3,y+.09,4.55);}ladder(-2,5.12,.2,2.9);for(const s of [-1,1])face(s*6,0,s*Math.PI/2,()=>{for(let f=1;f<5;f++)for(const x of [-2.7,0,2.7])line([x,f*3.1-.5,.02],[x,f*3.1,.9],.035);pipe(-3.8,.22,18.5);});tank(-4,18.75,-2,.65,1.2);box(1.2,.55,1.3,0,.3,18.93,-2);cyl(.16,.8,iron,.3,19.55,-2);cyl(.24,.07,4,.3,19.96,-2);for(const x of [2.25,3.15])line([x,5.6,4.02],[x,5.6,4.3],.025);
 } const group=new T.Group();group.name=BUILDING_PROPS.find(a=>a.id===id)!.name;group.userData.units='metres';group.userData.referencePlayerHeight=1.85;
 for(const [m,gs]of buckets){const flat=gs.map(g=>g.index?g.toNonIndexed():g),merged=mergeGeometries(flat)!;const geometry=mergeVertices(merged);merged.dispose();flat.forEach((g,i)=>{if(g!==gs[i])g.dispose();});gs.forEach(g=>g.dispose());geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,materials[m]);mesh.castShadow=m!==cyan&&m!==amber;mesh.receiveShadow=true;group.add(mesh);}return group;
 }
 return {create(id:BuildingPropId){if(disposed)throw new Error('Building library is disposed');if(CYBER_BUILDING_PROPS.some(p=>p.id===id))return cyber.create(id as CyberBuildingId);let root=cache.get(id);if(!root){root=build(id);cache.set(id,root);}return root.clone(true);},dispose(){if(disposed)return;disposed=true;cyber.dispose();cache.forEach(g=>g.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();}));cache.clear();materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());atlas.dispose();}};
}
