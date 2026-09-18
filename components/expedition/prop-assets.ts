import * as T from 'three';
import {REFERENCE_BUILDINGS,isReferenceBuilding} from '../../src/assets/reference-buildings.ts';
import {createReferenceBuildingLibrary} from '../../src/renderer/three/reference-building-library.ts';
import {BUILDING_PROPS,createBuildingLibrary,type BuildingPropId} from './building-props';
import {CITY_PROPS,createCityLibrary,type CityPropId} from './city-props';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export const PROP_ASSETS=[
 ...CITY_PROPS,
 ...BUILDING_PROPS,
 ...REFERENCE_BUILDINGS,
 {id:'barricade',name:'Баррикада · DANGER',category:'Ограждения',description:'Деревянные козлы · потёртая сигнальная доска'},
 {id:'blue-drum',name:'Бочка · синяя ржавая',category:'Ресурсы',description:'Стальной барабан · коррозия и усиленные обручи'},
 {id:'kerosene',name:'Бочки · KEROSENE',category:'Ресурсы',description:'Парные жёлтая и красная топливные бочки'},
 {id:'dumpster',name:'Контейнер · зелёный',category:'Детали',description:'Мусорный бак · рёбра крышки, ручки и колёса'},
 {id:'tire-pile',name:'Куча · шины и кирпич',category:'Детали',description:'Шины, доски, пустотелые блоки и обломки'},
 {id:'hydrant',name:'Гидрант · красный',category:'Детали',description:'Чугунный корпус · фланцы, болты и цепи'},
] as const;
export type PropId=typeof PROP_ASSETS[number]['id'];
export type PropInstance={id:string;asset:PropId;x:number;z:number;rotation:number;length?:number};
/** Shared geometries/materials: each prop is batched by material and reused across placements. */
export function createPropLibrary(anisotropy=4,onTextureReady?:()=>void){
 const references=createReferenceBuildingLibrary(anisotropy);
 const city=createCityLibrary(anisotropy,onTextureReady);
 const buildings=createBuildingLibrary(anisotropy,onTextureReady);
 const texture=new T.TextureLoader().load('/game/props/salvage/material-atlas.webp',loaded=>{maps.forEach(t=>{t.source=loaded.source;t.needsUpdate=true;});onTextureReady?.();});texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,anisotropy);
 const maps=Array.from({length:9},(_,i)=>{const t=new T.Texture();t.colorSpace=texture.colorSpace;t.anisotropy=texture.anisotropy;t.repeat.set(.328,.328);t.offset.set((i%3)/3+.002,(2-Math.floor(i/3))/3+.002);return t;});
 const materials=maps.map((map,i)=>new T.MeshStandardMaterial({map,roughness:[.94,.84,.73,.87,.98,.97,.79,.86,.84][i],metalness:[0,.55,.6,.48,0,0,.5,0,.7][i],bumpMap:map,bumpScale:i===5?.035:.012}));
 const decalTextures:T.Texture[]=[];
 function decal(text:string,color:string,bg:string){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=color;ctx.font='bold 80px monospace';ctx.textAlign='center';ctx.fillText(text,256,92);ctx.globalCompositeOperation='destination-out';for(let i=0;i<95;i++){ctx.fillRect((i*197)%512,(i*47)%128,2+i%12,1+i%3);}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;decalTextures.push(t);materials.push(new T.MeshStandardMaterial({map:t,transparent:true,roughness:.9,polygonOffset:true,polygonOffsetFactor:-2}));return materials.length-1;}
 const danger=decal('DANGER','#e1ded0','#8b2920'),fuel=decal('KEROSENE','#deded1','#00000000'),graffiti=decal('No Limit','#b8d7bf','#00000000');
 const dark=materials.length;materials.push(materials[7].clone());materials[dark].color.set('#555b59');materials[dark].metalness=.12;
 const brick=materials.length;materials.push(materials[5].clone());materials[brick].color.set('#916250');
 const caution=decal('CAUTION','#e8c454','#272722'),trash=decal('TRASH ONLY','#c8c9b6','#455548'),arrow=decal('This way →','#d6ad51','#00000000');
 const hazard=(()=>{const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d')!;ctx.beginPath();ctx.moveTo(128,12);ctx.lineTo(246,235);ctx.lineTo(10,235);ctx.closePath();ctx.fillStyle='#161a17';ctx.fill();ctx.beginPath();ctx.moveTo(128,34);ctx.lineTo(228,222);ctx.lineTo(28,222);ctx.closePath();ctx.fillStyle='#e5bc36';ctx.fill();ctx.fillStyle='#171b16';ctx.beginPath();ctx.moveTo(123,83);ctx.bezierCurveTo(158,117,121,125,159,133);ctx.bezierCurveTo(187,153,171,199,132,201);ctx.bezierCurveTo(81,202,68,155,98,128);ctx.bezierCurveTo(100,153,128,143,123,83);ctx.fill();ctx.fillStyle='#e5bc36';ctx.beginPath();ctx.moveTo(133,150);ctx.bezierCurveTo(152,182,142,194,127,190);ctx.bezierCurveTo(109,185,124,172,133,150);ctx.fill();const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;decalTextures.push(t);materials.push(new T.MeshStandardMaterial({map:t,transparent:true,roughness:.9,polygonOffset:true,polygonOffsetFactor:-2}));return materials.length-1;})();
 const prototypes=new Map<PropId,T.Group>();
 function build(id:PropId){const buckets=new Map<number,T.BufferGeometry[]>();
 function add(g:T.BufferGeometry,m:number,x=0,y=0,z=0,rx=0,ry=0,rz=0){const matrix=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1));g.applyMatrix4(matrix);const list=buckets.get(m)??[];list.push(g);buckets.set(m,list);}
 const box=(w:number,h:number,d:number,m:number,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>add(new T.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz);
 const cyl=(r:number,h:number,m:number,x=0,y=0,z=0,rx=0,rz=0,top=r,n=20)=>add(new T.CylinderGeometry(top,r,h,n),m,x,y,z,rx,0,rz);
 const torus=(r:number,t:number,m:number,x=0,y=0,z=0,rx=Math.PI/2,ry=0)=>add(new T.TorusGeometry(r,t,r<.06?5:6,r<.06?10:20),m,x,y,z,rx,ry);
 function drum(x:number,z:number,m:number){
 const profile=[new T.Vector2(0,0),new T.Vector2(.345,0),new T.Vector2(.36,.035),new T.Vector2(.35,.12),new T.Vector2(.348,.32),new T.Vector2(.356,.37),new T.Vector2(.345,.53),new T.Vector2(.351,.73),new T.Vector2(.36,.79),new T.Vector2(.345,1.04),new T.Vector2(.358,1.08),new T.Vector2(0,1.08)];
 add(new T.LatheGeometry(profile,24),m,x,.03,z);for(const y of [.06,.36,.78,1.1])torus(.357,.018,m===1?8:m,x,y,z);cyl(.343,.018,m,x,1.112,z);torus(.047,.011,8,x+.17,1.129,z+.07);cyl(.033,.014,8,x+.17,1.14,z+.07);torus(.022,.007,8,x-.16,1.13,z-.06);
 if(m!==1){const label=new T.CylinderGeometry(.361,.361,.14,32,1,true,-.94,1.88);add(label,fuel,x,.9,z);add(new T.PlaneGeometry(.23,.23),hazard,x,.55,z+.362);}
 }
 function tire(x:number,y:number,z:number,rx=Math.PI/2,ry=0){
 const shape=[new T.Vector2(.265,-.10),new T.Vector2(.29,-.137),new T.Vector2(.415,-.14),new T.Vector2(.5,-.086),new T.Vector2(.505,.078),new T.Vector2(.43,.136),new T.Vector2(.295,.135),new T.Vector2(.265,.1),new T.Vector2(.265,-.10)];
 add(new T.LatheGeometry(shape,24),4,x,y,z,rx-Math.PI/2,ry);
 for(const side of [-1,1]){const g=new T.TorusGeometry(.32,.008,4,24);g.translate(0,0,side*.131);add(g,4,x,y,z,rx,ry);}
 }
 function block(x:number,y:number,z:number,rz=0){const parts:T.BufferGeometry[]=[];for(const d of [-.15,.15])parts.push(new T.BoxGeometry(.58,.25,.07).translate(0,0,d));for(const w of [-.255,0,.255])parts.push(new T.BoxGeometry(.07,.25,.3).translate(w,0,0));const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());add(g,5,x,y,z,0,0,rz);}
 if(id==='barricade'){
 for(const x of [-.66,.66])for(const side of [-1,1])box(.1,1.7,.105,0,x,.84,side*.23,side*-.23);
 for(const side of [-1,1]){box(2,.34,.1,0,0,1.22,side*.35);box(2,.22,.095,0,0,.51,side*.2);box(1.96,.3,.013,dark,0,1.22,side*.409);for(let i=0;i<7;i++)box(.16,.285,.016,6,-.86+i*.285,1.22,side*.42,0,0,-.45);add(new T.PlaneGeometry(1.94,.205),danger,0,.51,side*.252,0,side<0?Math.PI:0);for(const x of [-.66,.66])for(const y of [.51,1.22])cyl(.016,.018,8,x,y,side*(y>.8?.433:.263),Math.PI/2,0,.016,8);}
 box(1.65,.07,.075,0,0,.35,.35);add(new T.PlaneGeometry(.25,.065),caution,.7,1.2,.434);
 }
 if(id==='blue-drum')drum(0,0,1);
 if(id==='kerosene'){drum(-.43,0,6);drum(.43,.05,2);}
 if(id==='dumpster'){
 box(2.05,1.18,1.14,3,0,.83,0);box(2.14,.09,1.22,8,0,1.4,0);box(2.12,.1,1.24,dark,0,1.48,0,-.045);for(let i=0;i<11;i++)box(.055,.055,1.18,dark,-.96+i*.192,1.56,0,-.045);for(const y of [.38,.78,1.28])box(2.09,.055,.025,8,0,y,.582);cyl(.025,2.19,8,0,1.25,.69,0,Math.PI/2);for(const x of [-.94,.94]){box(.14,.6,.08,3,x,1,.62);box(.27,.24,.4,3,x*1.15,.97,0);for(const z of [-.43,.43]){box(.065,.16,.06,8,x,.17,z);cyl(.085,.055,7,x,.08,z,Math.PI/2);}}add(new T.PlaneGeometry(1.3,.43),graffiti,.16,.85,.599,0,0,.11);add(new T.PlaneGeometry(.36,.09),caution,-.66,1.18,.603);add(new T.PlaneGeometry(.28,.1),trash,.73,1.17,.604);add(new T.PlaneGeometry(.7,.13),arrow,-.34,.48,.601,0,0,.05);
 for(const side of [-1,1]){for(const z of [-.21,.21])cyl(.018,.28,8,side*1.1,1.17,z,0,Math.PI/2);cyl(.018,.42,8,side*1.24,1.17,0,Math.PI/2);}
 for(let i=0;i<17;i++){const t=i/16;torus(.023,.006,8,-.54+.18*t,1.24-.3*Math.sin(t*Math.PI),.704,i%2?0:Math.PI/2);}

 }
 if(id==='tire-pile'){
 for(let i=0;i<5;i++)tire(.03,i*.23+.15,0,Math.PI/2+.025*(i%2));tire(.76,.19,.55);tire(.76,.43,.55);tire(-.68,.2,-.24,1.27,.1);tire(.64,.56,-.25,.12,.35);for(let i=0;i<4;i++)box(.14,1.3+i*.17,.055,0,-.4+i*.2,.7,.48,0,-.12,-.22+i*.12);block(.04,1.46,0,-.15);block(-.65,.22,.32);block(.8,.68,.6,.1);for(let i=0;i<19;i++)box(.18+i%3*.035,.1,.105, i%5===0?5:brick,-.62+(i*37%100)/90,.08+(i%3)*.055,.38+(i*19%70)/110,.12*(i%3),i*1.7,.1);cyl(.016,1.4,8,.42,.52,.42,0,-.7);
 }
 if(id==='hydrant'){
 // Only this small prop uses the lower round-detail density; drums remain unchanged.
 const body=(r:number,h:number,m:number,x=0,y=0,z=0,rx=0,rz=0,top=r,n=16)=>cyl(r,h,m,x,y,z,rx,rz,top,n);
 body(.25,.82,2,0,.72);body(.26,.35,2,0,.28);
 for(const y of [.09,.45,1.14,1.22]){body(y<.2?.36:.32,.065,2,0,y);torus(y<.2?.34:.31,.018,8,0,y+.035);}
 add(new T.SphereGeometry(.25,16,8,0,Math.PI*2,0,Math.PI/2).scale(1,1.13,1),2,0,1.25,0);
 body(.085,.08,8,0,1.55,0,0,0,.07,8);
 for(const x of [-.32,.32]){body(.12,.26,2,x,.9,0,0,Math.PI/2);body(.135,.045,8,x*1.36,.9,0,0,Math.PI/2);body(.07,.065,2,x*1.48,.9,0,0,Math.PI/2,.07,6);}
 body(.175,.2,2,0,.87,.27,Math.PI/2);body(.09,.08,8,0,.87,.4,Math.PI/2,0,.09,6);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;for(const y of [.16,1.16])body(.034,.05,8,Math.cos(a)*.275,y,Math.sin(a)*.275,0,0,.034,6);}
 // Keep every chain link and its smooth normals, with eight segments around each loop.
 for(const s of [-1,1])for(let i=0;i<22;i++){
  const t=i/21;
  add(new T.TorusGeometry(.026,.009,4,8),8,s*(.46*(1-t)),.87-.59*Math.sin(t*Math.PI)-.19*t,.02+.24*t,i%2?0:Math.PI/2,.2);
 }
 for(let i=0;i<6;i++){const a=i*Math.PI/3;box(.026,.27,.025,2,Math.cos(a)*.252,.3,Math.sin(a)*.252);}
 }
 const group=new T.Group();group.name=PROP_ASSETS.find(a=>a.id===id)!.name;for(const [m,gs]of buckets){const flat=gs.map(g=>g.index?g.toNonIndexed():g);const merged=mergeGeometries(flat)!;const geometry=mergeVertices(merged);merged.dispose();flat.forEach((g,i)=>{if(g!==gs[i])g.dispose();});const mesh=new T.Mesh(geometry,materials[m]);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}prototypes.set(id,group);return group;
 }
 return {prepare(id:PropId){return isReferenceBuilding(id)?references.prepare(id):Promise.resolve();},isReady(id:PropId){return !isReferenceBuilding(id)||references.isReady(id);},metrics(id:PropId,length=3){const root=isReferenceBuilding(id)?references.create(id):BUILDING_PROPS.some(a=>a.id===id)?buildings.create(id as BuildingPropId):CITY_PROPS.some(a=>a.id===id)?city.create(id as CityPropId,length):prototypes.get(id)??build(id);let triangles=0,geometryBytes=0,drawCalls=0;root.traverse(o=>{if(o instanceof T.Mesh){drawCalls++;const g=o.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;for(const a of Object.values(g.attributes) as T.BufferAttribute[])geometryBytes+=a.array.byteLength;if(g.index)geometryBytes+=g.index.array.byteLength;}});const size=new T.Box3().setFromObject(root).getSize(new T.Vector3());if(id==='hydrant')size.multiplyScalar(.75);return {id,triangles,geometryBytes,drawCalls,width:size.x,height:size.y,depth:size.z};},create(id:PropId,length=3){if(isReferenceBuilding(id))return references.create(id);if(BUILDING_PROPS.some(a=>a.id===id))return buildings.create(id as BuildingPropId);if(CITY_PROPS.some(a=>a.id===id))return city.create(id as CityPropId,length);const model=(prototypes.get(id)??build(id)).clone(true);if(id==='hydrant')model.scale.setScalar(.75);return model;},dispose(){references.dispose();city.dispose();buildings.dispose();for(const root of prototypes.values())root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});materials.forEach(m=>m.dispose());maps.forEach(t=>t.dispose());texture.dispose();decalTextures.forEach(t=>t.dispose());}};
}
