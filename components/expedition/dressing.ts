import * as T from 'three';
import {BRICK_WALLS,WRECKS,FIRE_BARRELS,MESH_FENCES,BARRIERS} from './dressing-layout';
import {RULES,type Point} from './config';
import {createRefugeMaterials} from '../base/materials';

export function createDressing(scene:T.Scene,surfaces:ReturnType<typeof createRefugeMaterials>){
  const brick=new T.MeshStandardMaterial({roughness:.94});surfaces.apply(brick,'concrete',1.3);brick.color.set('#9b6952');
  const mortar=new T.MeshStandardMaterial({color:'#454b46',roughness:1});
  const rust=new T.MeshStandardMaterial({color:'#926c47',roughness:.74,metalness:.5});surfaces.apply(rust,'metal',.75);
  const paint=new T.MeshStandardMaterial({color:'#597a72',roughness:.65,metalness:.45});surfaces.apply(paint,'metal',.65);
  const rubber=new T.MeshStandardMaterial({color:'#171e21',roughness:.94});
  const fenceMetal=new T.MeshStandardMaterial({color:'#26373a',roughness:.82,metalness:.7});
  const barrier=new T.MeshStandardMaterial({color:'#70766f',roughness:.96});surfaces.apply(barrier,'concrete',.72);
  const hazard=new T.MeshStandardMaterial({color:'#b4773d',roughness:.8,metalness:.35});surfaces.apply(hazard,'metal',.55);
  const glass=new T.MeshStandardMaterial({color:'#263c47',roughness:.22,metalness:.65});
  const glow=new T.MeshStandardMaterial({color:'#df942a',emissive:'#ff762a',emissiveIntensity:1.2});
  const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(.5,.5,1,12);
  // Crossed soft flame ribbons: shared shader, no textures or per-frame uploads.
  const flameGeo=new T.PlaneGeometry(1,1,1,8);
  const flame=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0}},vertexShader:`uniform float time; varying vec2 flameUv; varying float seed; void main(){flameUv=uv;seed=instanceMatrix[3].x*1.7+instanceMatrix[3].z;vec3 p=position;float h=uv.y;p.x+=sin(time*6.+h*8.+seed)*.17*h+sin(time*11.+h*17.+seed)*.06*h;p.y+=sin(time*8.+seed)*.08*h;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,fragmentShader:`uniform float time; varying vec2 flameUv; varying float seed; void main(){float h=flameUv.y;float width=(1.-h)*.44;float wave=sin(h*19.-time*9.+seed)*.07*h;float edge=1.-smoothstep(width*.35,width+.035,abs(flameUv.x-.5+wave));float alpha=edge*smoothstep(0.,.12,h)*(1.-smoothstep(.65,1.,h));vec3 color=mix(vec3(1.,.76,.22),vec3(1.,.12,.012),smoothstep(.12,.8,h));gl_FragColor=vec4(color*1.8,alpha*.85);}`});
  const groups=new Map<string,T.Group>();
  const sources:{p:T.Vector3;color:T.Color;power:number;flicker:boolean}[]=[];
  type Batch={geometry:T.BufferGeometry;material:T.Material;matrices:T.Matrix4[]};
  const batches=new Map<string,Map<string,Batch>>();
  const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,rx=0,ry=0,rz=0)=>{
    const chunk=`${Math.floor(x/RULES.chunkSize)},${Math.floor(z/RULES.chunkSize)}`;
    if(!batches.has(chunk))batches.set(chunk,new Map());const map=batches.get(chunk)!,key=`${g.uuid}:${m.uuid}`;
    if(!map.has(key))map.set(key,{geometry:g,material:m,matrices:[]});
    map.get(key)!.matrices.push(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(w,h,d)));
  };
  for(const wall of BRICK_WALLS){const alongX=wall.w>wall.d,length=Math.max(wall.w,wall.d);
    add(box,mortar,wall.x,.77,wall.z,wall.w,1.54,wall.d);
    for(let row=0;row<5;row++)for(let i=0;i<Math.floor(length/.65);i++){
      if(row===4&&i%5===2)continue;const offset=-length/2+.34+i*.65+(row%2)*.23;
      if(offset>length/2-.2)continue;
      add(box,brick,wall.x+(alongX?offset:0),.18+row*.31,wall.z+(alongX?0:offset),alongX?.62:.62,.28,alongX?.62:.62,0,0,(row===4&&i%7===0)?.04:0);
    }
    for(const side of [-1,1])add(box,mortar,wall.x+(alongX?side*length/2:0),.88,wall.z+(alongX?0:side*length/2),.78,1.76,.78);
    // Iron railings retain the broken wall silhouette without blocking the road.
    for(let i=0;i<Math.floor(length/.45);i++){const offset=-length/2+.2+i*.45;add(box,rubber,wall.x+(alongX?offset:0),1.92,wall.z+(alongX?0:offset),.035,.76,.035);}
    for(const y of [1.7,2.1])add(box,rubber,wall.x,y,wall.z,alongX?length:.045,.045,alongX?.045:length);
    for(let i=0;i<5;i++)add(box,brick,wall.x-1+i*.4,.1,wall.z+1+(i%2)*.3,.36,.18,.24,0,i*.8,.15);
  }
  for(const car of WRECKS){const {x,z}=car;
    // Roof on the ground, chassis and exposed axles above it.
    add(box,paint,x,.87,z,4.2,.65,1.95,0,.05,.04);
    add(box,glass,x-.25,.4,z,2.05,.6,1.55,0,.05,.08);
    add(box,rubber,x,1.22,z,3.5,.12,1.65);
    add(box,rust,x,1.37,z,2.2,.24,.48);
    for(const axle of [-1.4,1.4]){add(box,rust,x+axle,1.38,z,.13,.13,2.2);for(const side of [-1,1]){add(cylinder,rubber,x+axle,1.43,z+side, .78,.3,.78,Math.PI/2);add(cylinder,rust,x+axle,1.43,z+side*1.17,.36,.035,.36,Math.PI/2);}}
    for(const end of [-1,1]){add(box,rust,x+end*2.13,.86,z,.14,.2,2.04);for(const side of [-1,1])add(box,end===1?glow:glass,x+end*2.21,.9,z+side*.65,.06,.16,.35);}
    add(box,paint,x+.4,.16,z+1.9,1.2,.12,.85,0,.65,.08);
    for(let i=0;i<8;i++)add(box,glass,x-2+i*.55,.06,z+1.7+(i%3)*.25,.15,.035,.22,0,i*.9);
  }
  for(const [i,p] of FIRE_BARRELS.entries()){
    add(cylinder,rust,p.x,.53,p.z,.8,1.06,.8);
    for(const y of [.12,.3,.79,1.01])add(cylinder,rubber,p.x,y,p.z,.84,.045,.84);
    add(cylinder,glow,p.x,1.04,p.z,.63,.05,.63);
    for(let f=0;f<5;f++)add(flameGeo,flame,p.x+Math.sin(f*2.4)*.16,1.48+(f%3)*.09,p.z+Math.cos(f*2.4)*.16,.65,1.05+(f%3)*.2,1,0,f*Math.PI/2.5);
    sources.push({p:new T.Vector3(p.x,1.65,p.z),color:new T.Color('#ffae65'),power:36,flicker:true});
    // Nearby abandoned supply box, metal straps, scattered planks and bricks.
    add(box,rust,p.x-1.4,.32,p.z-.9,.9,.64,.75);
    for(const dx of [-.29,.29])add(box,rubber,p.x-1.4+dx,.34,p.z-.9,.045,.69,.79);
    for(let j=0;j<4;j++)add(box,j%2?brick:rust,p.x+.9+j*.25,.07,p.z-.6+(j%2)*.4,.4,.09,.16,0,i+j);
  }
  // Sparse chain-link fragments: posts and rails are instanced with the rest
  // of the dressing, while the open spacing keeps the player readable.
  for(const fence of MESH_FENCES){
    const alongX=fence.w>fence.d,length=Math.max(fence.w,fence.d),count=Math.floor(length/2.2)+1;
    for(let i=0;i<count;i++){
      const offset=-length/2+i*(length/Math.max(1,count-1));
      add(cylinder,fenceMetal,fence.x+(alongX?offset:0),1.15,fence.z+(alongX?0:offset),.09,2.3,.09);
      add(box,fenceMetal,fence.x+(alongX?offset:0),2.18,fence.z+(alongX?0:offset),alongX?2.2:.09,.08,alongX?.09:2.2,0,0,0);
    }
    add(box,fenceMetal,fence.x,1.25,fence.z,alongX?length:.08,.06,alongX?.08:length,0,0,0);
    // Two loose braces sell the damaged, hand-repaired silhouette.
    add(box,hazard,fence.x+(alongX?-length*.28:0),.95,fence.z+(alongX?0:-length*.28),alongX?1.1:.08,.08,alongX?.08:1.1,0,0,alongX?.18:-.18);
    add(box,hazard,fence.x+(alongX?length*.31:0),.72,fence.z+(alongX?0:length*.31),alongX?.95:.08,.08,alongX?.08:.95,0,0,alongX?-.14:.14);
  }
  // Concrete road barriers with faded orange reflectors.
  for(const b of BARRIERS){
    add(box,barrier,b.x,.38,b.z,1.9,.76,.72,0,b.turn,0);
    for(const offset of [-.48,.48])add(box,hazard,b.x+Math.cos(b.turn)*offset,.44,b.z+Math.sin(b.turn)*offset,.08,.34,.76,0,b.turn,0);
  }
  batches.forEach((map,key)=>{const group=new T.Group();map.forEach(b=>{const mesh=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=b.material!==flame&&b.material!==glow;mesh.receiveShadow=mesh.castShadow;mesh.computeBoundingSphere();group.add(mesh);});groups.set(key,group);scene.add(group);});
  return {sources,update(time:number){flame.uniforms.time.value=time;},stream(p:Point){const x=Math.floor(p.x/RULES.chunkSize),z=Math.floor(p.z/RULES.chunkSize);groups.forEach((g,key)=>{const [a,b]=key.split(',').map(Number);g.visible=Math.abs(a-x)<=RULES.activeRadius&&Math.abs(b-z)<=RULES.activeRadius;});}};
}
