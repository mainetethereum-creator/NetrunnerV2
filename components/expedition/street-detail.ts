import * as T from 'three';
import {RULES,type Point} from './config';
import {FIRE_BARRELS} from './dressing-layout';

/** Surface-only dressing: no new obstacles, collision changes or gameplay state.
 * Every sector reuses the same three buffers and atlas material. */
export function createStreetDetail(scene:T.Scene,height:(p:Point)=>number,canStand:(p:Point)=>boolean,anisotropy:number){
  const texture=new T.TextureLoader().load('/game/props/salvage/material-atlas.webp');texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,anisotropy);
  const material=new T.MeshStandardMaterial({map:texture,roughness:.87,metalness:.08,side:T.DoubleSide});
  const fragment=new T.PlaneGeometry(1,1);fragment.rotateX(-Math.PI/2);
  const uv=fragment.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,.67+uv.getX(i)*.32,.34+uv.getY(i)*.32);
  const leaf=new T.BufferGeometry();leaf.setAttribute('position',new T.Float32BufferAttribute([0,0,-.5,-.3,.025,-.05,0,.07,.5,0,0,-.5,0,.07,.5,.3,.025,-.05],3));leaf.setAttribute('uv',new T.Float32BufferAttribute([.02,.69,.13,.78,.29,.95,.02,.69,.29,.95,.19,.78],2));leaf.computeVertexNormals();
  const chip=new T.DodecahedronGeometry(1,0);const chipUV=chip.attributes.uv;for(let i=0;i<chipUV.count;i++)chipUV.setXY(i,.67+chipUV.getX(i)*.32,.34+chipUV.getY(i)*.32);
  const chunks=new Map<string,T.Group>(),dummy=new T.Object3D();
  let seed=81249;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let cx=0;cx<6;cx++)for(let cz=0;cz<3;cz++){
    const group=new T.Group();group.name='Windblown street litter';group.visible=false;
    const pieces:{x:number;z:number;s:number;r:number;k:number}[][]=[[],[],[]];
    for(let i=0;i<170;i++){
      const x=cx*24+random()*24,z=cz*24+random()*24;
      // Accumulate at both gutters; leave the central navigation corridor legible.
      const gutter=Math.min(Math.abs(z-30),Math.abs(z-42));
      if(gutter>2.4&&random()>.1||!canStand({x,z}))continue;
      const kind=random()<.74?1:random()<.6?0:2;
      pieces[kind].push({x,z,s:.08+random()*.19,r:random()*Math.PI*2,k:random()});
    }
    [fragment,leaf,chip].forEach((geometry,kind)=>{
      if(!pieces[kind].length)return;
      const mesh=new T.InstancedMesh(geometry,material,pieces[kind].length);
      pieces[kind].forEach((p,i)=>{dummy.position.set(p.x,height(p)+.047+(kind===2?p.s*.2:0),p.z);dummy.scale.set(p.s*(kind===0?1.7:1),kind===2?p.s*.22:1,p.s);dummy.rotation.set(0,p.r,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color().setHSL(kind===1?.12:.09,kind===1?.35:.08,.45+p.k*.25));});
      mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
    });scene.add(group);chunks.set(`${cx},${cz}`,group);
  }
  // One point batch for drifting sparks. Animation stays entirely on the GPU.
  const positions:number[]=[],phases:number[]=[];
  for(const p of FIRE_BARRELS)for(let i=0;i<12;i++){positions.push(p.x+(random()-.5)*.55,1.1,p.z+(random()-.5)*.55);phases.push(random());}
  const sparksGeometry=new T.BufferGeometry();sparksGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));sparksGeometry.setAttribute('phase',new T.Float32BufferAttribute(phases,1));
  const sparksMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{time:{value:0}},vertexShader:`attribute float phase;uniform float time;varying float life;void main(){life=fract(phase+time*.23);vec3 p=position;p.y+=life*2.3;p.x+=sin(phase*37.+life*6.)*life*.36;p.z+=life*.35;vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp(38./-view.z,1.,2.8);}`,fragmentShader:`varying float life;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(1.,.34,.055,(1.-smoothstep(.12,.5,d))*(1.-life)*.75);}`});
  const sparks=new T.Points(sparksGeometry,sparksMaterial);sparks.frustumCulled=false;scene.add(sparks);
  return {update(time:number){sparksMaterial.uniforms.time.value=time;},stream(p:Point){const x=Math.floor(p.x/RULES.chunkSize),z=Math.floor(p.z/RULES.chunkSize);chunks.forEach((g,key)=>{const [a,b]=key.split(',').map(Number);g.visible=Math.abs(a-x)<=RULES.activeRadius&&Math.abs(b-z)<=RULES.activeRadius;});},dispose(){texture.dispose();}};
}
