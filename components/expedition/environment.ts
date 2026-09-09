import * as T from 'three';
import {createRefugeMaterials} from '../base/materials';
import {SOLIDS,elevationAt,type World} from './world';
import {POIS,EXTRACTIONS,ENCOUNTERS,EVENTS,RULES,BOUNDS,type Point} from './config';
// Each chunk owns a handful of instanced batches. Textures/materials/geometries are shared.
export function buildEnvironment(scene:T.Scene,_world:World,_level:number,anisotropy:number){
  const surfaces=createRefugeMaterials(anisotropy),geo=new T.BoxGeometry(1,1,1);
  const concrete=new T.MeshStandardMaterial({color:'#7a827c',roughness:.88});surfaces.apply(concrete,'concrete',.4);
  const floor=new T.MeshStandardMaterial({color:'#777d76',roughness:.7});surfaces.apply(floor,'stone',.5);
  const road=new T.MeshStandardMaterial({color:'#353d3b',roughness:.46});surfaces.apply(road,'stone',.25);
  const metal=new T.MeshStandardMaterial({color:'#635a49',roughness:.6,metalness:.65});surfaces.apply(metal,'metal',.4);
  const dark=new T.MeshStandardMaterial({color:'#242f30',roughness:.9});
  const blue=new T.MeshStandardMaterial({color:'#8ad6df',emissive:'#61adb8',emissiveIntensity:2});
  const amber=new T.MeshStandardMaterial({color:'#cda870',emissive:'#bf7839',emissiveIntensity:1});
  const mats=[concrete,floor,road,metal,dark,blue,amber];
  const distantGround=new T.Mesh(geo,road);distantGround.position.set(BOUNDS.w/2,-.4,BOUNDS.d/2);distantGround.scale.set(BOUNDS.w,.15,BOUNDS.d);distantGround.receiveShadow=true;scene.add(distantGround);
  const platform=new T.Mesh(geo,metal);platform.position.set(105,1.45,58);platform.scale.set(10,.3,3);platform.castShadow=true;platform.receiveShadow=true;scene.add(platform);
  const ramp=new T.Mesh(geo,metal);ramp.position.set(98,.7,58);ramp.scale.set(Math.hypot(4,1.6),.2,3);ramp.rotation.z=Math.atan2(1.6,4);ramp.castShadow=true;ramp.receiveShadow=true;scene.add(ramp);
  const chunks=new Map<string,T.Group>(),size=RULES.chunkSize;
  const lightSources:{p:T.Vector3;color:T.Color;power:number;flicker:boolean}[]=[];
  const dummy=new T.Object3D();
  const labels:T.Sprite[]=[];
  function label(text:string,x:number,y:number,z:number,width=7){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d')!;ctx.fillStyle='#13272b';ctx.fillRect(0,0,512,96);ctx.strokeStyle='#829b93';ctx.strokeRect(3,3,506,90);ctx.font='bold 26px monospace';ctx.fillStyle='#c4d4cb';ctx.textAlign='center';ctx.fillText(text.toUpperCase(),256,58);const texture=new T.CanvasTexture(c);const s=new T.Sprite(new T.SpriteMaterial({map:texture}));s.position.set(x,y,z);s.scale.set(width,width*96/512,1);scene.add(s);labels.push(s);return s;}
  for(let cx=0;cx<BOUNDS.w/size;cx++)for(let cz=0;cz<BOUNDS.d/size;cz++){
    const group=new T.Group();group.name=`Sector_${cx}_${cz}`;const batches:number[][][]=mats.map(()=>[]);
    const add=(m:number,x:number,y:number,z:number,w:number,h:number,d:number)=>batches[m].push([x,y,z,w,h,d]);
    const inside=(p:Point)=>Math.floor(p.x/size)===cx&&Math.floor(p.z/size)===cz;
    add(2,cx*size+12,-.18,cz*size+12,24,.3,24);
    for(let x=cx*size+1;x<(cx+1)*size;x+=2)for(let z=cz*size+1;z<(cz+1)*size;z+=2){
      if(z>30&&z<42){if(Math.abs(z-35)<1.1&&x%6===1)add(6,x,.015,z,1.2,.025,.12);continue;}
      // Broken, mismatched paving around the roadside service routes.
      if((x*17+z*11)%19!==0)add(1,x,-.025,z,1.94,.12,1.94);
    }
    for(const s of SOLIDS.filter(inside)){
      add(s.kind==='container'?3:0,s.x,s.h/2,s.z,s.w,s.h,s.d);
      add(4,s.x,s.h+.12,s.z,s.w+.2,.25,s.d+.2);
      if(s.kind==='building'){
        for(let x=s.x-s.w/2+1;x<s.x+s.w/2-.3;x+=2)for(let y=1.8;y<s.h;y+=2.5){add(4,x,y,s.z+s.d/2+.03,1.3,1.6,.12);if(Math.round(x+y)%3!==0)add(6,x,y,s.z+s.d/2+.11,.8,1.15,.06);}
        add(3,s.x+s.w*.25,s.h+.6,s.z,1.7,1,1.6);
        add(3,s.x-s.w*.4,s.h/2,s.z+s.d/2+.12,.18,s.h,.2);
      }
    }
    for(let x=cx*size+6;x<(cx+1)*size;x+=12){const z=cz===1?43:cz*24+12;add(3,x,2.7,z,.18,5.4,.18);add(3,x+.8,5.3,z,1.7,.14,.2);add(5,x+1.3,5.18,z,.7,.08,.3);lightSources.push({p:new T.Vector3(x+1.3,4.7,z),color:new T.Color('#aacbca'),power:10,flicker:false});}
    // Debris compositions and wrecks on shoulders, away from the navigable centre.
    for(let i=0;i<8;i++){const x=cx*size+2+(i*7)%20,z=cz*size+2+(i*11)%20;if(!SOLIDS.some(s=>Math.abs(s.x-x)<s.w/2+1&&Math.abs(s.z-z)<s.d/2+1))add(3,x,.13,z,.22+(i%3)*.1,.2,.25);}
    for(const p of POIS.filter(inside)){
      const height=elevationAt(p);
      add(3,p.x+1.4,height+.45,p.z,1.3,.9,.9);add(5,p.x+1.4,height+.92,p.z,.65,.06,.12);
      if(p.kind==='convoy'){add(3,p.x-4,.8,p.z+3,2,1.4,4);add(4,p.x-4,1.6,p.z+3,1.8,.8,2);}
      if(p.kind==='station'){add(3,p.x-3,1,p.z,1,2,.8);add(3,p.x+3,1,p.z,1,2,.8);add(0,p.x,3.3,p.z-3,9,.4,2);}
      if(p.kind==='power'){for(let dx=-3;dx<=3;dx+=3)add(3,p.x+dx,1.3,p.z+3,1.4,2.6,1.6);}
      label(p.name,p.x,4.8,p.z+1,4.5);
      // Small authored stories: discarded equipment, a dead terminal and improvised shelter.
      add(3,p.x-2.4,.35,p.z+2,1.2,.7,.7);add(4,p.x-2.4,.8,p.z+2,.8,.18,.5);
      if(p.kind==='camp'){add(3,p.x-3,.4,p.z+1,.65,.8,.65);add(6,p.x-3,.85,p.z+1,.45,.18,.45);lightSources.push({p:new T.Vector3(p.x-3,1.2,p.z+1),color:new T.Color('#eeb376'),power:7,flicker:true});}
    }
    for(const e of EXTRACTIONS.filter(inside)){add(3,e.x,-.02,e.z,5,.13,5);for(const dx of [-2,2]){add(3,e.x+dx,1.2,e.z,.2,2.4,.2);add(5,e.x+dx,2.5,e.z,.4,.2,.4);}label(e.id==='breach'?'CYBERBASE / RETURN':'EXTRACTION / CARGO LIFT',e.x,3.5,e.z);}
    batches.forEach((items,index)=>{if(!items.length)return;const mesh=new T.InstancedMesh(geo,mats[index],items.length);items.forEach(([x,y,z,w,h,d],i)=>{dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=index!==5&&index!==6;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);});
    scene.add(group);chunks.set(`${cx},${cz}`,group);
  }
  // Silhouettes stay cheap and visible beyond the active chunks.
  const landmark=new T.Group();scene.add(landmark);
  // A paired retaining wall frames the entry breach; the road remains open.
  for(const z of [24,48]){const wall=new T.Mesh(geo,concrete);wall.position.set(2,1.5,z);wall.scale.set(1,3,14);wall.castShadow=true;wall.receiveShadow=true;scene.add(wall);}
  for(const [x,z,h] of [[100,8,24],[106,8,19],[135,9,14]]){const tower=new T.Mesh(new T.CylinderGeometry(1.2,1.7,h,10),metal);tower.position.set(x,h/2,z);tower.castShadow=true;landmark.add(tower);const lamp=new T.Mesh(geo,amber);lamp.scale.set(.5,.5,.5);lamp.position.set(x,h+.2,z);landmark.add(lamp);}
  const debug=new T.Group();debug.visible=false;scene.add(debug);
  for(const [key] of chunks){const [x,z]=key.split(',').map(Number);const box=new T.Box3Helper(new T.Box3(new T.Vector3(x*size,.15,z*size),new T.Vector3((x+1)*size,.3,(z+1)*size)),0x58c3dd);debug.add(box);}
  for(const e of ENCOUNTERS){const ring=new T.Mesh(new T.RingGeometry(e.activationDistance-.1,e.activationDistance,64),new T.MeshBasicMaterial({color:'#e77b52',side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(e.x,.16,e.z);debug.add(ring);const spawn=new T.Mesh(new T.SphereGeometry(.3,8,6),amber);spawn.position.set(e.x,.6,e.z);debug.add(spawn);}
  const drop=new T.Mesh(geo,amber);drop.scale.set(1.2,1,1.2);drop.position.set(EVENTS[1].x,.6,EVENTS[1].z);drop.visible=false;scene.add(drop);
  let activeChunks=0;
  return {surfaces,lightSources,update(time:number){drop.rotation.y=time*.2;},stream(p:Point,showDebug:boolean,dropVisible:boolean){activeChunks=0;const x=Math.floor(p.x/size),z=Math.floor(p.z/size);chunks.forEach((g,k)=>{const [a,b]=k.split(',').map(Number);g.visible=Math.abs(a-x)<=RULES.activeRadius&&Math.abs(b-z)<=RULES.activeRadius;if(g.visible)activeChunks++;});labels.forEach(l=>l.visible=l.position.distanceTo(new T.Vector3(p.x,0,p.z))<32);debug.visible=showDebug;drop.visible=dropVisible&&Math.hypot(p.x-drop.position.x,p.z-drop.position.z)<40;},get activeChunks(){return activeChunks;}};
}
