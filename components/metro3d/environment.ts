import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createRefugeMaterials } from '../base/materials';
import { CELL, GRID, LEVELS, center, cellPoint, type World } from './world';

export function buildEnvironment(scene:T.Scene,world:World,level:number,maxAnisotropy:number) {
  const theme=LEVELS[level-1], surfaces=createRefugeMaterials(maxAnisotropy);
  const mat=(color:string,kind:'stone'|'concrete'|'metal',roughness=.8)=>surfaces.apply(new T.MeshStandardMaterial({color,roughness,metalness:kind==='metal'?.55:.02}),kind,kind==='stone'?.25:.65);
  const pavement=mat('#a8afaa','stone'),concrete=mat('#787e76','concrete'),tile=mat(theme.wall,'concrete',.55),tileAlt=mat('#98a39b','concrete',.6),steel=mat('#354247','metal',.5),rust=mat('#695343','metal'),black=new T.MeshStandardMaterial({color:'#101c20',roughness:.9});
  tile.normalScale.setScalar(.2);tileAlt.normalScale.setScalar(.2);
  const cold=new T.MeshStandardMaterial({color:'#c1e6d9',emissive:'#95c8bc',emissiveIntensity:1.2});
  const amber=new T.MeshStandardMaterial({color:theme.accent,emissive:theme.accent,emissiveIntensity:1});
  const red=new T.MeshStandardMaterial({color:'#d99382',emissive:'#b5483c',emissiveIntensity:.8});
  const batches=new Map<T.Material,T.Matrix4[]>(),d=new T.Object3D();
  function box(x:number,y:number,z:number,w:number,h:number,depth:number,m:T.Material,ry=0) {
    d.position.set(x,y,z);d.scale.set(w,h,depth);d.rotation.set(0,ry,0);d.updateMatrix();
    const list=batches.get(m)??[];list.push(d.matrix.clone());batches.set(m,list);
  }
  function cylinder(x:number,y:number,z:number,r:number,h:number,m:T.Material) {
    const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,12),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  const lightSources:{p:T.Vector3;color:T.Color;power:number;flicker:boolean}[]=[];
  function light(x:number,y:number,z:number,color:string,power=13,flicker=false) {lightSources.push({p:new T.Vector3(x,y,z),color:new T.Color(color),power,flicker});}
  function sign(text:string,sub:string,x:number,y:number,z:number,width=3) {
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#17272b';ctx.fillRect(0,0,768,192);ctx.strokeStyle=theme.accent;ctx.lineWidth=5;ctx.strokeRect(10,10,748,172);
    ctx.textAlign='center';ctx.fillStyle='#e0e4d1';ctx.font='bold 56px sans-serif';ctx.fillText(text,384,90);ctx.fillStyle=theme.accent;ctx.font='21px monospace';ctx.fillText(sub,384,144);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const mesh=new T.Mesh(new T.PlaneGeometry(width,width/4),new T.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:'#ffffff',emissiveIntensity:.3,roughness:.7}));mesh.position.set(x,y,z);scene.add(mesh);
  }
  let seed=theme.seed as number;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Floor uses the exact photographed concrete-paver material used in the refuge.
  for(const key of world.tiles) {
    const [gx,gz]=key.split(',').map(Number),{x,z}=cellPoint(gx,gz);
    const broken=rand()<.045;
    box(x,-.09,z,CELL,.18,CELL,broken?concrete:black);
    if(!broken)box(x,.015,z,CELL-.016,.06,CELL-.016,pavement);
    else {
      for(let i=0;i<3;i++)box(x+(rand()-.5)*.78,.07,z+(rand()-.5)*.78,.27+rand()*.36,.08,.24+rand()*.24,concrete,rand()*2);
    }
    // Outer boundary walls: tall on the far side; cutaway on the camera side.
    for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      if(world.tiles.has(`${gx+dx},${gz+dz}`))continue;
      const wx=x+dx*CELL/2,wz=z+dz*CELL/2,low=dx===1||dz===1,h=low?.78:3.45;
      box(wx,h/2,wz,dx?.20:CELL+.14,h,dz?.20:CELL+.14,concrete);
      box(wx,h+.04,wz,dx?.26:CELL+.16,.10,dz?.26:CELL+.16,steel);
      box(wx-dx*.12,.18,wz-dz*.12,dx?.08:CELL,.30,dz?.08:CELL,black);
      const rows=low?2:8;
      for(let row=0;row<rows;row++)for(let col=0;col<3;col++) {
        if(rand()<.075)continue;
        const along=(col-1)*.452;
        box(wx-dx*.115+(dx?0:along),.42+row*.365,wz-dz*.115+(dz?0:along),dx?.026:.435,.348,dz?.026:.435,rand()<.13?tileAlt:tile);
      }
      if(!low&&(gx+gz)%4===0) {
        const lx=wx-dx*.25,lz=wz-dz*.25;
        box(lx,2.92,lz,dx?.15:1.10,.17,dz?.15:1.10,steel);
        box(lx-dx*.09,2.88,lz-dz*.09,dx?.035:.97,.065,dz?.035:.97,cold);
        light(lx-dx*.6,2.7,lz-dz*.6,'#acd4ca',14,(gx+gz)%13===0);
      }
    }
  }
  const flameCanvas=document.createElement('canvas');flameCanvas.width=64;flameCanvas.height=128;
  const c=flameCanvas.getContext('2d')!,grad=c.createRadialGradient(32,91,1,32,79,47);
  grad.addColorStop(0,'rgba(255,247,181,1)');grad.addColorStop(.25,'rgba(255,174,46,.94)');grad.addColorStop(.6,'rgba(228,71,10,.65)');grad.addColorStop(1,'rgba(106,22,0,0)');c.fillStyle=grad;c.fillRect(0,0,64,128);
  const flameTexture=new T.CanvasTexture(flameCanvas);
  const fires:T.Sprite[]=[];
  function barrel(x:number,z:number,fire:boolean) {
    cylinder(x,.49,z,.37,.90,rust);
    for(const y of [.12,.72])cylinder(x,y,z,.388,.065,steel);
    cylinder(x,.946,z,.325,.026,black);
    if(fire) {
      const sprite=new T.Sprite(new T.SpriteMaterial({map:flameTexture,color:'#ffffff',transparent:true,depthWrite:false,blending:T.AdditiveBlending}));sprite.position.set(x,1.24,z);sprite.scale.set(.83,1.3,1);scene.add(sprite);fires.push(sprite);light(x,1.5,z,'#ff983f',9,true);
    }
  }
  for(const [index,r] of world.rooms.entries()) {
    const p=center(r),left=(r.x-GRID/2)*CELL,back=(r.z-GRID/2)*CELL;
    const cratePos=cellPoint(r.x+1,r.z+1),barrelPos=cellPoint(r.x+r.w-2,r.z+1);
    box(cratePos.x,.56,cratePos.z,1.02,1.04,1.02,steel);
    for(const dz of [-.48,.48])for(const dx of [-.35,.35])box(cratePos.x+dx,.59,cratePos.z+dz,.055,1.1,.06,rust);
    box(cratePos.x,.91,cratePos.z+.52,.5,.15,.016,black);
    barrel(barrelPos.x,barrelPos.z,index%2===0);
    // Wall-mounted service boxes and conduit details stay outside walkable centres.
    box(left+.23,1.42,back+3,.40,.80,.62,steel);
    for(let j=0;j<5;j++)box(left+.44,1.17+j*.1,back+3,.02,.028,.42,black);
    box(left+.28,2.35,back+3,.10,.12,3.8,rust);
    for(let j=0;j<4;j++)box(left+.28,2.35,back+1.4+j*1.05,.16,.20,.055,steel);
    sign(r.role==='entry'?'LOWER LINES':r.name.toUpperCase(),`${String(level).padStart(2,'0')} / ${theme.subtitle.toUpperCase()}`,p.x,2.5,back+.15,Math.min(6,r.w*.6));
    light(p.x,3.3,p.z,theme.accent,12);
    // Benches hug side walls; seats remain outside the main navigation axis.
    if(r.role==='entry'||r.role==='rest') {
      for(let j=0;j<3;j++) {
        box(left+.49,.55,back+4+j*.62,.5,.12,.56,steel);
        box(left+.21,.95,back+4+j*.62,.10,.73,.56,steel);
      }
      box(p.x, .06,p.z,2.9,.08,2.9,steel);
      for(let j=-1;j<=1;j++)box(p.x+j*.72,.11,p.z+.9,.42,.024,.16,amber);
    }
    if(r.role==='platform') {
      // Railway track beyond the end wall gives the station a visible continuation.
      const tz=back-2.2;
      box(p.x,-.20,tz,r.w*CELL+6,.26,2.8,black);
      for(let x=left-2;x<left+r.w*CELL+2;x+=.55)box(x,-.04,tz,.13,.15,2.0,rust);
      for(const dz of [-.69,.69])box(p.x,.08,tz+dz,r.w*CELL+6,.12,.07,steel);
      if(level===1) {
        box(p.x,1.35,tz,10.2,2.55,2.05,steel);
        box(p.x,2.67,tz,10.5,.19,2.22,concrete);
        for(let j=-4;j<=4;j++) {
          box(p.x+j,1.73,tz+1.04,.75,.80,.03,black);
          if(j%3!==0)box(p.x+j,1.73,tz+1.058,.64,.65,.014,tileAlt);
        }
        for(const dx of [-3.7,3.7]){box(p.x+dx,.20,tz,1.2,.40,1.9,black);box(p.x+dx,1,tz+1.07,.7,1.9,.03,rust);}
      }
      for(let x=left+.4;x<left+r.w*CELL-.4;x+=.42)box(x,.075,back+.37,.20,.03,.22,amber);
    }
    if(level>=2&&(r.role==='platform'||r.role==='arena')) {
      for(let i=0;i<3;i++) {
        const px=left+.28+i*.18;
        box(px,2.5,back+r.d*CELL/2,.12,.12,r.d*CELL-.5,i===1?rust:steel);
      }
    }
    if(level===2 && (r.role==='service'||r.role==='platform')) {
      // Ventilation machinery visible beyond the open top of the far wall.
      for(let i=0;i<3;i++) {
        box(p.x+(i-1)*2.1,1.25,back-.65,1.65,2.4,.85,steel);
        for(let j=0;j<9;j++)box(p.x+(i-1)*2.1,.40+j*.22,back-.20,1.4,.10,.08,black);
      }
    }
    if(level===3 && r.role==='service') {
      for(let i=0;i<4;i++) {
        box(left+.35,1.05,back+2+i*1.4,.4,1.95,1.10,steel);
        for(let j=0;j<3;j++)box(left+.57,1.35,back+1.7+i*1.4+j*.27,.025,.1,.13,amber);
      }
    }
    if(level===4 && (r.role==='platform'||r.role==='service'||r.role==='arena')) {
      // Sealed sample cabinets: frosted viewing slots, pale ceramic and status strips.
      for(let i=0;i<4;i++) {
        const cx=p.x+(i-1.5)*1.8;
        box(cx,1.28,back-.5,1.4,2.5,.7,tileAlt);
        box(cx,1.42,back-.135,1.04,1.52,.035,black);
        box(cx,1.42,back-.11,.84,1.30,.018,tile);
        box(cx,2.18,back-.09,.91,.045,.035,cold);
      }
    }
    if(r.role==='arena') {
      // Reserve the centre for the future boss; machinery stays behind the wall.
      box(p.x,.065,p.z,4.8,.04,4.8,steel);
      for(let i=-3;i<=3;i++)box(p.x+i*.65,.095,p.z+2.1,.32,.025,.18,amber);
      for(const dx of [-4,4]) {
        cylinder(p.x+dx,1.25,back-1.3,.9,2.6,steel);
        for(let j=0;j<5;j++)cylinder(p.x+dx,.3+j*.45,back-1.3,1.0,.12,level===3?amber:tile);
      }
      light(p.x,3.1,p.z,theme.accent,20);
    }
    if(r.role==='exit') {
      box(p.x,.04,p.z,3.4,.07,3.4,steel);
      for(const dx of [-1.65,1.65])box(p.x+dx,.11,p.z,.055,.035,3.4,cold);
      for(const dz of [-1.65,1.65])box(p.x,.11,p.z+dz,3.4,.035,.055,cold);
      sign(level===4?'EXTRACTION':'DESCENT',level===4?'BACK TO REFUGE':`LEVEL ${level+1} / SERVICE LIFT`,p.x,1.7,p.z-1.72,3.2);
    }
    // Puddles use the same environmental specular response as the refuge materials.
    const wet=new T.Mesh(new T.CircleGeometry(1,28),new T.MeshStandardMaterial({color:'#304546',roughness:.14,metalness:.48,transparent:true,opacity:.42,depthWrite:false}));
    wet.rotation.x=-Math.PI/2;wet.scale.set(1.5, .65,1);wet.position.set(p.x+1.5,.058,p.z-1);scene.add(wet);
  }
  for(const [material,matrices] of batches) {
    const mesh=new T.InstancedMesh(new RoundedBoxGeometry(1,1,1,1,.014),material,matrices.length);
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=material!==cold&&material!==amber&&material!==red;mesh.receiveShadow=true;scene.add(mesh);
  }
  return {surfaces,lightSources,update(t:number){fires.forEach((f,i)=>{const wobble=Math.sin(t*7+i)*.06+Math.sin(t*13+i)*.025;f.scale.set(.77+wobble,1.2+wobble*2,1);f.material.opacity=.82+Math.sin(t*9+i)*.12;});}};
}
