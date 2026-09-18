import * as T from 'three';
import {SECURITY_FENCE_PROPS,createSecurityFenceLibrary,type SecurityFenceId} from './security-fences';
import {isFence,fenceLength} from './fence-layout';
export {isFence,fenceLength} from './fence-layout';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const CITY_PROPS=[
 ...SECURITY_FENCE_PROPS,
 {id:'stop-sign',name:'Знак · STOP',category:'Детали',description:'Ржавый восьмиугольник · перфорированная стойка · 2,6 м'},
 {id:'tires',name:'Шины · стопка',category:'Детали',description:'Шесть старых покрышек · рельефный протектор и боковины'},
 {id:'utility-building',name:'Здание · технический блок',category:'Здания',description:'4 × 3,6 м · дверь, площадка, лестница и вентиляция'},
 {id:'garbage-bags',name:'Мусор · чёрные мешки',category:'Детали',description:'Шесть завязанных мешков · складки глянцевого пластика'},
 {id:'campfire',name:'Костёр · поленья',category:'Детали',description:'Обугленные поленья · угли и объёмные языки огня'},
 {id:'shipping-container',name:'Контейнер · грузовой 20 ft',category:'Ресурсы',description:'6,06 × 2,44 × 2,59 м · гофры, запоры и угловые фитинги'},
 {id:'electrical-cabinet',name:'Шкаф · электрощитовая',category:'Детали',description:'Три секции · счётчики, жалюзи и предупреждения'},
 {id:'bus-shelter',name:'Остановка · павильон',category:'Детали',description:'Изогнутая крыша · грязное стекло, скамья и расписание'},
 {id:'modular-fence',name:'Забор · кирпич и пики',category:'Ограждения',description:'Модуль 3 м · длина 3–24 м · привязка концов при размещении'},
] as const;
export type CityPropId=typeof CITY_PROPS[number]['id'];

/** Animate only the flame meshes; geometry and materials remain shared between placements. */
export function animateCityProps(root:T.Object3D,time:number){root.traverse(o=>{if(o.userData.fireLayer){const phase=o.userData.fireLayer; o.scale.y=1+.13*Math.sin(time*8+phase)+.05*Math.sin(time*19+phase);o.rotation.y=.08*Math.sin(time*4+phase);o.scale.x=1+.07*Math.sin(time*6+phase);o.scale.z=1+.06*Math.cos(time*7+phase);}});}

/** Geometry and generated surface maps are shared by all user placements. Metres are world units. */
export function createCityLibrary(anisotropy:number,ready?:()=>void){
 const atlasMaps:T.Texture[]=[];
 const atlas=new T.TextureLoader().load('/game/props/salvage/city-atlas.webp',loaded=>{atlasMaps.forEach(t=>{t.source=loaded.source;t.needsUpdate=true;});ready?.();});atlas.colorSpace=T.SRGBColorSpace;
 const textures:T.Texture[]=[];
 // Keep generated materials on inert placeholder textures until the atlas has
 // image data. This avoids Three.js trying to upload an incomplete loader
 // texture when MASTER renders a preview immediately after opening.
 const securityAtlas=new T.Texture();securityAtlas.colorSpace=atlas.colorSpace;securityAtlas.anisotropy=Math.min(8,anisotropy);textures.push(securityAtlas);atlasMaps.push(securityAtlas);
 const security=createSecurityFenceLibrary(securityAtlas);
 const mats:T.MeshStandardMaterial[]=Array.from({length:9},(_,i)=>{const map=new T.Texture();map.colorSpace=atlas.colorSpace;map.repeat.set(.329,.329);map.offset.set(i%3/3+.002,(2-Math.floor(i/3))/3+.002);map.anisotropy=Math.min(8,anisotropy);textures.push(map);atlasMaps.push(map);return new T.MeshStandardMaterial({map,bumpMap:map,bumpScale:i===1?.045:.015,roughness:[.83,.98,.96,.29,.96,.7,.83,.98,.56][i],metalness:[.5,0,0,.05,0,.65,.4,0,.1][i]});});
 mats[5].side=T.DoubleSide;
 const material=(p:T.MeshStandardMaterialParameters)=>{mats.push(new T.MeshStandardMaterial(p));return mats.length-1;};
 const iron=material({map:mats[5].map,color:'#45433d',metalness:.7,roughness:.8}),cream=material({map:mats[1].map,color:'#e9dfbd',roughness:.9}),red=material({map:mats[0].map,color:'#ed5552',roughness:.8}),rubber=4;
 const glass=material({map:mats[8].map,transparent:true,opacity:.35,roughness:.45,metalness:.1,side:T.DoubleSide,depthWrite:false});
 const ember=material({map:mats[7].map,emissive:'#e94105',emissiveIntensity:1.4,roughness:.9});
 const flame=material({vertexColors:true,color:'#ff8d15',emissive:'#ff6b00',emissiveIntensity:2.8,transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide});
 const core=material({vertexColors:true,color:'#ffe48c',emissive:'#ffcd48',emissiveIntensity:3,transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide});
 function label(lines:string[],bg:string,fg:string){const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d')!;x.fillStyle=bg;x.fillRect(0,0,512,512);x.strokeStyle=fg;x.lineWidth=10;if(lines.length>1)x.strokeRect(10,10,492,492);x.fillStyle=fg;x.textAlign='center';lines.forEach((s,i)=>{x.font=`bold ${lines.length===1?142:i===0?76:48}px sans-serif`;x.fillText(s,256,lines.length===1?308:105+i*98,480);});const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.push(t);return material({map:t,roughness:.9,transparent:true,polygonOffset:true,polygonOffsetFactor:-2});}
 const stop=label(['STOP'],'#00000000','#eee7d4'),voltage=label(['⚡','ОПАСНО','380 V'],'#dccb91','#1c211f'),serial=label(['NETU 204819','22G1','MAX 30 480 KG'],'#00000000','#d4cfbc'),poster=label(['AD SPACE','AVAILABLE','CITY TRANSIT'],'#444c48','#d6d6c7'),route=label(['BUS 07','06:00 — 23:00','10 · 25 · 40 · 55'],'#d9dcd0','#345753'),tag=label(['NO FUTURE'],'#00000000','#d0c8ae');
 const cache=new Map<string,T.Group>();
 function build(id:CityPropId,length:number){const buckets=new Map<number,T.BufferGeometry[]>();
 const add=(g:T.BufferGeometry,m:number,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1)));const a=buckets.get(m)??[];a.push(g);buckets.set(m,a);};
 const box=(w:number,h:number,d:number,m:number,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>add(new T.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz);
 const cyl=(r:number,h:number,m:number,x=0,y=0,z=0,rx=0,rz=0,rt=r,n=16)=>add(new T.CylinderGeometry(rt,r,h,n),m,x,y,z,rx,0,rz);
 const line=(a:number[],b:number[],r:number,m:number)=>{const va=new T.Vector3().fromArray(a),vb=new T.Vector3().fromArray(b),g=new T.CylinderGeometry(r,r,va.distanceTo(vb),10);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),vb.clone().sub(va).normalize()));const mid=va.add(vb).multiplyScalar(.5);g.translate(mid.x,mid.y,mid.z);add(g,m);};
 const panel=(w:number,h:number,m:number,x:number,y:number,z:number,ry=0)=>add(new T.PlaneGeometry(w,h),m,x,y,z,0,ry);
 const bolt=(x:number,y:number,z:number)=>cyl(.023,.026,5,x,y,z,Math.PI/2,0,.023,6);
 if(id==='stop-sign'){
  box(.075,2.55,.05,5,0,1.275);for(let i=0;i<19;i++)cyl(.009,.054,iron,0,.2+i*.105,.006,Math.PI/2,0,.009,8);
  const signBack=new T.CylinderGeometry(.56,.56,.036,8);signBack.rotateY(Math.PI/8);add(signBack,cream,0,2.13,0,Math.PI/2);
  const signFace=new T.CylinderGeometry(.511,.511,.041,8);signFace.rotateY(Math.PI/8);add(signFace,red,0,2.13,.012,Math.PI/2);panel(.88,1.12,stop,0,2.13,.038);bolt(0,2.53,.045);bolt(0,1.73,.045);box(.23,.055,.23,iron,0,.025);
 }
 function tire(x:number,y:number,z:number,tilt=0,turn=0){
  const profile=[new T.Vector2(.23,-.13),new T.Vector2(.28,-.16),new T.Vector2(.4,-.15),new T.Vector2(.47,-.09),new T.Vector2(.475,.09),new T.Vector2(.4,.15),new T.Vector2(.28,.16),new T.Vector2(.23,.13),new T.Vector2(.23,-.13)];
  const transform=new T.Matrix4().makeRotationZ(tilt).premultiply(new T.Matrix4().makeRotationY(turn));transform.setPosition(x,y,z);
  const part=(geo:T.BufferGeometry)=>{geo.applyMatrix4(transform);add(geo,rubber);};
  // Smooth lathed sidewalls keep the silhouette; tiny tread repeats need fewer faces.
  part(new T.LatheGeometry(profile,20));
  for(const s of [-1,1]){const ring=new T.TorusGeometry(.29,.012,5,20);ring.rotateX(Math.PI/2);ring.translate(0,s*.146,0);part(ring);}
  for(let i=0;i<24;i++)for(const side of [-1,1]){const a=i*Math.PI/12;const t=new T.BoxGeometry(.034,.13,.014);t.rotateZ(side*.45);t.translate(0,side*.068,.476);t.rotateY(a);part(t);}
 }
 if(id==='tires'){for(let i=0;i<4;i++)tire(-.22,.17+i*.29,0,.025*(i%2),i*.3);tire(.58,.51,.45,1.12,.35);tire(-.45,.17,.65,.08);}
 if(id==='utility-building'){
 for(const x of [-1.65,1.65]){box(.13,.15,.15,5,x,3.05,1.86);cyl(.07,.06,cream,x,3,1.94,Math.PI/2);}
 for(const z of [-1.25,-.6])add(new T.TorusGeometry(.16,.035,8,14,Math.PI/2),iron,1.99,3.66,z);

  box(4,3.25,3.6,1,0,1.75);box(4.12,.22,3.72,1,0,.16);box(4.3,.15,3.9,1,0,3.45);box(3.96,.06,3.56,5,0,3.55);
  for(const x of [-2.07,2.07])box(.13,.17,3.9,1,x,3.6);for(const z of [-1.88,1.88])box(4.2,.17,.13,1,0,3.6,z);
  box(1.12,2.24,.09,iron,.1,1.76,1.84);box(.98,2.12,.06,6,.1,1.76,1.91);panel(.2,.25,voltage,.1,2,1.948);cyl(.032,.15,5,-.23,1.7,1.98);for(let i=0;i<5;i++)box(.64,.027,.027,iron,.1,.9+i*.07,1.95);
  box(1.7,.09,1.15,5,.1,.63,2.3);for(const x of [-.68,.88])for(const z of [1.88,2.8]){cyl(.025,1.45,iron,x,.73,z);line([x,1.43,1.88],[x,1.43,2.8],.025,iron);line([x,1.1,1.88],[x,1.1,2.8],.018,iron);}
  for(let i=0;i<3;i++)box(.95,.13,.3,5,.1,.16+i*.16,3.34-i*.28);for(const x of [-.37,.57])line([x,.1,3.5],[x,.63,2.7],.025,iron);for(const x of [-.68,.88])line([x,1.42,2.7],[x,.91,3.46],.025,iron);for(let i=0;i<10;i++)box(1.64,.01,.015,iron,.1,.681,1.78+i*.11);
  for(const z of [-1.25,-.6])cyl(.035,3.62,iron,2.15,1.85,z);for(let i=0;i<13;i++)line([2.15,.22+i*.28,-1.25],[2.15,.22+i*.28,-.6],.025,iron);
  box(.8,.15,.75,iron,-.85,3.64,-.7);cyl(.53,.22,6,-.85,3.83,-.7,0,0,.08,4);box(.65,.16,.65,5,.9,3.65,-.65);cyl(.19,.55,5,.9,4,-.65);cyl(.25,.07,5,.9,4.29,-.65);
  line([.7,3.6,.65],[.7,3.96,.65],.085,iron);add(new T.TorusGeometry(.2,.085,8,16,Math.PI),iron,.5,3.96,.65);line([.3,3.6,.65],[.3,3.96,.65],.085,iron);
  line([-1.8,.38,1.9],[1.85,.38,1.9],.06,cream);line([1.85,.38,1.9],[1.85,1.6,1.9],.06,cream);
 }
 if(id==='garbage-bags')for(let i=0;i<6;i++){
  const x=(i%3-1)*.56+(i%2)*.06,z=Math.floor(i/3)*.43-.2,h=.66+(i%3)*.14,y=i===4?.43:0;
  const g=new T.SphereGeometry(1,20,14),p=g.attributes.position;for(let j=0;j<p.count;j++){const a=Math.atan2(p.getZ(j),p.getX(j)),v=p.getY(j),fold=1+.085*Math.sin(a*13+v*5)+.035*Math.sin(a*23-v*8);p.setXYZ(j,p.getX(j)*.4*fold*(1-.66*Math.pow(Math.max(0,v),1.2)),Math.max(0,(v+1)*h*.5-.018),p.getZ(j)*.34*fold*(1-.66*Math.pow(Math.max(0,v),1.2)));}g.computeVertexNormals();add(g,3,x,y,z);cyl(.075,.11,3,x,y+h,z,0,0,.042);add(new T.ConeGeometry(.12,.2,9,2,true),3,x,y+h+.14,z,.12,i);add(new T.TorusGeometry(.059,.014,6,16),iron,x,y+h+.025,z,Math.PI/2);
 }
 if(id==='campfire'){
  cyl(.72,.04,7,0,.025,0,0,0,.67,32);for(let i=0;i<6;i++){const a=i*1.7;line([Math.cos(a)*.64,.13,Math.sin(a)*.64],[Math.cos(a+2.5)*.65,.13,Math.sin(a+2.5)*.65],.09,7);}for(let i=0;i<10;i++){const a=i*Math.PI/5;line([Math.cos(a)*.64,.1,Math.sin(a)*.64],[Math.cos(a+.6)*.09,.7+(i%3)*.16,Math.sin(a+.6)*.09],.085+(i%2)*.02,7);}for(let i=0;i<15;i++){const a=i*2.4;add(new T.DodecahedronGeometry(.065,0),ember,Math.cos(a)*.45,.08,Math.sin(a)*.45);}
  for(let i=0;i<13;i++){const a=i*2.4,h=.65+(i%4)*.22,r=.11+(i%3)*.035;const shape=[new T.Vector2(0,0),new T.Vector2(r,.08),new T.Vector2(r*.7,h*.35),new T.Vector2(r*.44,h*.63),new T.Vector2(0,h)];const g=new T.LatheGeometry(shape,10);const p=g.attributes.position;const colors=[];for(let j=0;j<p.count;j++){const t=p.getY(j)/h;p.setX(j,p.getX(j)+Math.sin(p.getY(j)*5+i)*p.getY(j)*.13);const c=new T.Color().setRGB(1,1-t*.68,.5*(1-t));colors.push(c.r,c.g,c.b);}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();add(g,i%3===0?core:flame,Math.cos(a)*.23,.15,Math.sin(a)*.23);}
 }
 if(id==='shipping-container'){
 for(const z of [-1.301,1.301])for(const x of [-1.55,1.55])box(.53,.09,.018,iron,x,.12,z);
 for(const z of [-1.08,0,1.08])for(const y of [.38,1.26,2.17]){box(.13,.15,.17,5,3.19,y,z);cyl(.032,.2,iron,3.26,y,z);}

  box(6.06,2.59,2.44,0,0,1.295);for(const z of [-1.235,1.235]){for(let i=0;i<27;i++)box(.115,2.34,.055,0,-2.84+i*.218,1.295,z);for(const y of [.1,2.49])box(6.08,.18,.12,0,0,y,z);}
  for(let i=0;i<25;i++)box(.1,.045,2.27,0,-2.8+i*.23,2.606);for(const x of [-2.96,2.96])for(const z of [-1.15,1.15]){box(.17,2.55,.17,0,x,1.3,z);for(const y of [.13,2.47]){box(.24,.23,.24,iron,x,y,z);cyl(.051,.247,iron,x,y,z,Math.PI/2);}}
  for(const z of [-.6,.6]){box(.08,2.3,1.15,0,3.07,1.3,z);for(let k=0;k<5;k++)box(.09,.07,1.08,0,3.13,.4+k*.43,z);for(const dz of [-.36,.36]){cyl(.025,2.26,5,3.2,1.3,z+dz);for(const y of [.25,.7,1.95,2.35])box(.09,.075,.14,5,3.21,y,z+dz);box(.11,.06,.24,iron,3.24,.95,z+dz);}}
  panel(.8,.45,serial,3.26,1.68,.58,Math.PI/2);panel(1.1,.48,serial,-1.7,1.8,1.272);
 }
 if(id==='electrical-cabinet'){
  box(2.5,.14,.88,1,0,.07);box(2.4,2.12,.75,5,0,1.2);box(2.56,.09,.91,5,0,2.29);for(let i=0;i<3;i++){const x=(i-1)*.79;box(.765,2.04,.05,5,x,1.2,.4);for(const y of [.4,.48,.56,.64,.72])for(const dx of [-.19,.19])box(.27,.045,.035,5,x+dx,y,.449,-.24);box(.045,.21,.03,iron,x+.29,1.2,.453);add(new T.TorusGeometry(.027,.008,5,12,Math.PI),iron,x+.28,1.35,.47);box(.057,.073,.035,cream,x+.28,1.31,.48);panel(.48,.37,voltage,x,i===0?1.03:1.62,.438);}
  box(.56,.58,.045,iron,-.79,1.85,.46);box(.5,.52,.02,cream,-.79,1.85,.49);for(const x of [-.94,-.66]){box(.16,.18,.02,5,x,1.86,.51);box(.135,.145,.009,cream,x,1.86,.525);line([x-.046,1.815,.534],[x+.024,1.895,.534],.003,iron);for(let k=0;k<5;k++)box(.008,.015,.005,iron,x-.048+k*.024,1.92,.535);}for(const x of [-.92,-.79,-.66])cyl(.026,.024,x===-.79?ember:6,x,2.04,.53,Math.PI/2);panel(.48,.5,glass,-.79,1.85,.55);
 }
 if(id==='bus-shelter'){
  for(const x of [-1.8,-.6,.6,1.8]){box(.07,2.5,.07,5,x,1.25,-.52);box(.2,.04,.22,iron,x,.025,-.52);for(const y of [.25,1.94,2.47])box(1.17,.045,.045,iron,x===1.8?1.2:x+.6,y,-.52);}for(const x of [-1.8,1.8]){box(.07,2.45,.07,5,x,1.225,.63);box(.2,.04,.22,iron,x,.025,.63);line([x,2.44,.63],[x,2.48,-.55],.034,5);}
  for(const x of [-1.2,0,1.2])panel(1.13,2.12,glass,x,1.34,-.505);panel(1.02,1.8,poster,-1.755,1.3,.02,Math.PI/2);for(const y of [.39,2.21])box(.055,.055,1.1,iron,-1.77,y,.02);panel(1.05,2.1,glass,1.79,1.34,.02,Math.PI/2);for(const x of [-1.8,-.6,.6,1.8])for(const y of [.45,1.93])box(.13,.1,.065,iron,x,y,-.49);panel(.48,.59,route,1.14,1.78,-.484);
  const roof=new T.PlaneGeometry(3.95,1.4,1,24);const rp=roof.attributes.position;for(let j=0;j<rp.count;j++){const v=(rp.getY(j)+.7)/1.4;rp.setXYZ(j,rp.getX(j),2.52+.17*Math.sin(v*Math.PI),-.65+v*1.4);}roof.computeVertexNormals();add(roof,5);for(const x of [-1.9,-.95,0,.95,1.9]){const curve=new T.CatmullRomCurve3(Array.from({length:17},(_,j)=>new T.Vector3(x,2.52+.17*Math.sin(j/16*Math.PI),-.65+j/16*1.4)));add(new T.TubeGeometry(curve,20,.027,6,false),iron);}
  box(2.65,.055,.42,5,.25,.55,-.12);for(const x of [-.95,.25,1.45]){cyl(.025,.55,iron,x,.28,-.12);line([x,.55,-.28],[x,.8,-.28],.022,iron);line([x,.8,-.28],[x,.8,.1],.022,iron);line([x,.8,.1],[x,.55,.1],.022,iron);}
 }
 if(id==='modular-fence'){
  const n=length/3;for(let k=0;k<=n;k++){const x=-length/2+k*3;box(.43,2.57,.47,2,x,1.34);for(let row=0;row<18;row++)for(const side of [-1,1]){box(.44,.012,.008,iron,x,.12+row*.14,side*.24);for(let col=0;col<2;col++)box(.012,.126,.008,iron,x-.21+col*.22+(row%2)*.11,.19+row*.14,side*.241);}box(.58,.32,.62,1,x,.16);box(.58,.17,.62,1,x,2.67);}
  for(let k=0;k<n;k++){const x=-length/2+1.5+k*3;box(2.58,1.34,.28,1,x,.82);box(2.64,.16,.39,1,x,1.52);box(2.65,.18,.4,1,x,.17);for(const y of [1.73,2.24])box(2.63,.06,.045,iron,x,y,0);for(let j=0;j<11;j++){const px=x-1.19+j*.238;box(.028,.92,.029,iron,px,2.06);cyl(.061,.18,iron,px,2.6,0,0,0,0,4);}panel(1.75,.77,tag,x,.91,.149);for(let row=0;row<4;row++)for(let j=0;j<4-row;j++)box(.21,.115,.026,2,x+.55+j*.22+(row%2)*.1,.4+row*.13,.151);for(let i=0;i<12;i++)box(.15,.08,.1,2,x-1.2+(i*17%23)*.105,.06,.22+(i%3)*.09,.1,i*.7,.2);}
 }
 const root=new T.Group();root.name=CITY_PROPS.find(a=>a.id===id)!.name;for(const [m,gs]of buckets){const flat=gs.map(g=>g.index?g.toNonIndexed():g),merged=mergeGeometries(flat)!;const geometry=mergeVertices(merged);merged.dispose();flat.forEach((g,i)=>{if(g!==gs[i])g.dispose();});gs.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,mats[m]);if(m===flame||m===core)mesh.userData.fireLayer=m===flame?1:2;mesh.castShadow=m!==glass&&m!==flame&&m!==core;mesh.receiveShadow=true;root.add(mesh);}return root;
 }
 return {create(id:CityPropId,length=3){if(SECURITY_FENCE_PROPS.some(p=>p.id===id))return security.create(id as SecurityFenceId,length);const l=isFence(id)?fenceLength(length):3,key=id+':'+l;let root=cache.get(key);if(!root){root=build(id,l);cache.set(key,root);}return root.clone(true);},dispose(){security.dispose();cache.forEach(g=>g.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();}));mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());atlas.dispose();}};
}
