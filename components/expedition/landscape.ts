import {createLandscapeStudio} from './landscape-studio';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {World} from './world';
import {HANGARS,northEdge,southEdge} from './terrain';
// World-space aggregate and cracks: the road has no paving texture or tile grid.
export function groundMaterial(asphalt:boolean,relief?:T.Texture){
  const material=new T.MeshStandardMaterial({color:asphalt?'#24282b':'#343733',roughness:asphalt?.86:.98,metalness:0,envMapIntensity:asphalt?1.1:.2});
  material.onBeforeCompile=shader=>{
    if(relief)shader.uniforms.roadRelief={value:relief};
    shader.vertexShader=`varying vec3 groundWorld;\n${shader.vertexShader}`.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n groundWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=`${relief?'uniform sampler2D roadRelief;':''} varying vec3 groundWorld;
      float grit(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float grain(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(grit(i),grit(i+vec2(1,0)),f.x),mix(grit(i+vec2(0,1)),grit(i+vec2(1,1)),f.x),f.y);}
      ${shader.fragmentShader}`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 uv=groundWorld.xz;float fine=mix(grain(uv*42.),.5,smoothstep(.3,1.5,length(fwidth(uv*42.))));float wear=grain(uv*.75);
      diffuseColor.rgb*=.45+fine*.4+wear*.24;
      ${relief?'float scannedRelief=texture2D(roadRelief,uv*.72).r;diffuseColor.rgb*=mix(.62,1.3,scannedRelief);':''}
      ${asphalt?`float crack=abs(uv.y-(34.2+floor(uv.x*.7)*.065+grain(vec2(uv.x*1.8,3.))*1.2));float damaged=(1.-smoothstep(.012,.04,crack))*step(.45,grain(uv*.2));diffuseColor.rgb*=1.-damaged*.75;`:`diffuseColor.rgb*=.65+grain(uv*.17)*.6;`}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      ${asphalt?'roughnessFactor=mix(.78,.12,smoothstep(.45,.69,grain(groundWorld.xz*.28)));':''}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec2 aggregateUV=groundWorld.xz*18.;
      float visibleGrain=1.-smoothstep(.5,2.,length(fwidth(aggregateUV)));
      normal=normalize(normal+vec3(grain(aggregateUV)-.5,grain(aggregateUV+vec2(13.,7.))-.5,0.)*visibleGrain*.38);
      ${relief?`vec2 scanUV=groundWorld.xz*.72;float scanHeight=texture2D(roadRelief,scanUV).r;vec2 scanSlope=vec2(texture2D(roadRelief,scanUV+vec2(.002,0.)).r-scanHeight,texture2D(roadRelief,scanUV+vec2(0.,.002)).r-scanHeight);normal=normalize(normal+vec3(scanSlope*1.3,0.));`:''}
    `);
  };
  material.customProgramCacheKey=()=>asphalt?'expedition-asphalt-v3':'expedition-earth-v1';return material;
}
export function buildLandscape(scene:T.Scene,metal:T.Material,concrete:T.Material,dark:T.Material,world:World){
  const terrainHeight=world.terrainHeight;
  const relief=new T.TextureLoader().load('/base/materials/weathered-height-v1.webp');relief.wrapS=relief.wrapT=T.RepeatWrapping;relief.anisotropy=8;
  const soil=groundMaterial(false),asphalt=groundMaterial(true,relief);
  const meshGeometry=new T.PlaneGeometry(200,128,320,208);meshGeometry.rotateX(-Math.PI/2);meshGeometry.translate(72,0,36);
  const ground=new T.Mesh(meshGeometry,soil);ground.receiveShadow=true;scene.add(ground);
  const studio=createLandscapeStudio(scene,ground,world.landscape,terrainHeight);
  const road=new T.Mesh(new T.PlaneGeometry(144,12),asphalt);road.rotation.x=-Math.PI/2;road.position.set(72,.012,36);road.receiveShadow=true;scene.add(road);
  const box=new T.BoxGeometry(1,1,1),rock=new T.DodecahedronGeometry(1,0);
  const pieces:{x:number;y:number;z:number;w:number;h:number;d:number;turn:number}[]=[];
  // Broken embankments hide the rectangular engine bounds behind a natural skyline.
  for(let x=-10;x<156;x+=3.2)for(const side of [-1,1]){const z=side<0?northEdge(x)-2.5:southEdge(x)+2.5;pieces.push({x,y:terrainHeight({x,z})+.45,z,w:2+(x%3+3)*.3,h:1.1+Math.abs(Math.sin(x))*1.4,d:2.8,turn:x*.7});}
  const stones=new T.InstancedMesh(rock,groundMaterial(false),pieces.length),dummy=new T.Object3D();pieces.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.rotation.set(.12,p.turn,.1);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);});stones.castShadow=true;stones.receiveShadow=true;stones.computeBoundingSphere();scene.add(stones);
  // Distant low-cost buildings are a backdrop, not explorable interiors.
  const silhouettes=new T.InstancedMesh(box,dark,36);for(let i=0;i<36;i++){const x=(i%18)*10-10,z=i<18?-14:87,h=5+(i*7%9);dummy.position.set(x,terrainHeight({x,z})+h/2,z);dummy.scale.set(6+i%3,h,6);dummy.rotation.set(0,(i%3-1)*.07,0);dummy.updateMatrix();silhouettes.setMatrixAt(i,dummy.matrix);}silhouettes.computeBoundingSphere();scene.add(silhouettes);
  // A single hero ruin gives the outskirts a readable landmark. It is built
  // from shared box geometry so it adds visual weight without a new asset.
  const archParts:T.BufferGeometry[]=[];
  const archX=69,archZ=7,archY=terrainHeight({x:archX,z:archZ});
  const archPart=(x:number,y:number,z:number,w:number,h:number,d:number,turn=0)=>{const m=new T.Object3D();m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.set(0,turn,0);m.updateMatrix();archParts.push(box.clone().applyMatrix4(m.matrix));};
  archPart(archX-4,archY+2.6,archZ,.9,5.2,1.4,-.03);archPart(archX+4,archY+2.2,archZ,.9,4.4,1.4,.05);
  for(let i=0;i<7;i++){const a=Math.PI-(i/6)*Math.PI,x=archX+Math.cos(a)*4,z=archZ, y=archY+4.5+Math.sin(a)*3.2;archPart(x,y,z,1.05,.82,1.45,a-Math.PI/2);}
  const archMesh=new T.Mesh(mergeGeometries(archParts),concrete);archMesh.castShadow=true;archMesh.receiveShadow=true;scene.add(archMesh);archParts.forEach(g=>g.dispose());
  const brace=new T.Mesh(new T.BoxGeometry(1,1,1),metal);brace.position.set(archX,archY+3.1,archZ+.8);brace.scale.set(5.4,.08,.08);brace.rotation.z=-.08;brace.castShadow=true;scene.add(brace);
  const archLamp=new T.PointLight('#86d7e0',7,13,2);archLamp.position.set(archX,archY+3.7,archZ+.8);scene.add(archLamp);
  for(const h of HANGARS){const group=new T.Group();group.position.set(h.x,0,h.z);scene.add(group);
    const batches=new Map<T.Material,T.BufferGeometry[]>();
    const part=(x:number,y:number,z:number,w:number,height:number,d:number,mat:T.Material,tilt=0)=>{dummy.position.set(x,y,z);dummy.scale.set(w,height,d);dummy.rotation.set(0,0,tilt);dummy.updateMatrix();const geometry=box.clone().applyMatrix4(dummy.matrix);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat)!.push(geometry);};
    part(0,h.h*.44,0,h.w,h.h*.88,h.d,metal);
    for(const side of [-1,1])part(side*h.w/4,h.h,0,h.w*.55,.22,h.d+.5,metal,-side*.25);
    part(0,.22,h.d/2+.2,h.w+.4,.44,.6,concrete);
    part(0,1.8,h.d/2+.025,h.w*.55,3.6,.08,dark);
    for(let y=.25;y<3.6;y+=.28)part(0,y,h.d/2+.11,h.w*.55,.045,.08,metal);
    for(let x=-h.w/2+.15;x<h.w/2;x+=.7)part(x,h.h*.44,h.d/2+.06,.055,h.h*.88,.12,concrete);
    part(0,3.9,h.d/2+.25,h.w*.63,.2,.7,concrete);
    batches.forEach((parts,mat)=>{const mesh=new T.Mesh(mergeGeometries(parts),mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);parts.forEach(p=>p.dispose());});
  }
  return {asphalt,studio,dispose(){studio.dispose();relief.dispose();}};
}
