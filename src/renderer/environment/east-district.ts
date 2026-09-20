import * as T from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ASSET_URLS } from '../../assets/registry.ts';
import { disposeObjectTree } from '../three/dispose.ts';
import { EAST_BEDS, EAST_BOUNDARY_RUNS, EAST_BUILDINGS, EAST_DISTRICT, EAST_TRAIL_PLANTS, EAST_TRAIL_POINTS, EAST_TRAIL_ROCKS, eastGroundHeight } from './east-district-layout.ts';
import { roadGlowTexture } from './city-street-geometry.ts';

type Placement = readonly [x:number,z:number,yaw?:number,sx?:number,y?:number,sz?:number];
type PrimitivePlacement = readonly [x:number,y:number,z:number,sx:number,sy:number,sz:number,yaw?:number,rx?:number,rz?:number];
/** Blender-authored service frontage and earth shoulder. The courtyard material
 * is borrowed, so teardown must leave its textures/material in the base's care. */
export function createEastDistrict(parent:T.Scene,loader:GLTFLoader,paving:T.Material,mobile:boolean,onError:(message:string)=>void) {
  const root=new T.Group();root.name='East district / expedition boundary';parent.add(root);
  const owned=new T.Group();let disposed=false,time=0;
  const floorGeometry=new T.PlaneGeometry(EAST_DISTRICT.east-EAST_DISTRICT.west,EAST_DISTRICT.south-EAST_DISTRICT.north);
  floorGeometry.rotateX(-Math.PI/2);
  const floor=new T.Mesh(floorGeometry,paving);
  floor.position.set((EAST_DISTRICT.west+EAST_DISTRICT.east)/2,.076,(EAST_DISTRICT.north+EAST_DISTRICT.south)/2);
  floor.receiveShadow=true;floor.name='East district / matching courtyard tiles';root.add(floor);
  const fireTime={value:0};let fireLight:T.PointLight|undefined;
  const ready=loader.loadAsync(`${ASSET_URLS.eastDistrict}?v=20260920-1`).then(gltf=>{
    if(disposed){disposeObjectTree(gltf.scene);return;}
    owned.add(gltf.scene);
    const materials=new Map<string,T.MeshStandardMaterial>();
    gltf.scene.traverse(o=>{
      if(!(o instanceof T.Mesh))return;
      for(const mat of Array.isArray(o.material)?o.material:[o.material]) {
        if(!(mat instanceof T.MeshStandardMaterial))continue;
        materials.set(mat.name,mat);
        mat.envMapIntensity=.45;
        for(const tex of [mat.map,mat.normalMap,mat.emissiveMap])if(tex)tex.anisotropy=mobile?2:8;
        if(mat.name==='EAST_Concrete'){mat.color.setRGB(.60,.65,.68);mat.normalScale.setScalar(.5);}
        if(mat.name==='EAST_Earth'){mat.color.setRGB(.46,.48,.37);mat.normalScale.setScalar(.7);}
        if(mat.name==='EAST_Moss')mat.color.setRGB(.45,.6,.33);
        if(mat.name==='EAST_Steel')mat.color.setRGB(.43,.49,.5);
        if(mat.name==='EAST_WorkshopInterior'){mat.emissiveIntensity=.42;mat.color.setRGB(.85,.75,.6);}
        if(mat.name==='EAST_Pink'||mat.name==='EAST_Amber')mat.side=T.DoubleSide;
      }
    });
    const dummy=new T.Object3D(),matrix=new T.Matrix4();
    function instances(name:string,placements:readonly Placement[]) {
      const source=gltf.scene.getObjectByName(name);if(!source)throw new Error(`Missing east model ${name}`);
      source.updateWorldMatrix(true,true);const inverse=source.matrixWorld.clone().invert();
      source.traverse(o=>{
        if(!(o instanceof T.Mesh))return;
        const mesh=new T.InstancedMesh(o.geometry,o.material,placements.length),local=inverse.clone().multiply(o.matrixWorld);
        mesh.name=`East / ${o.name}`;mesh.castShadow=name!=='EastGround';mesh.receiveShadow=true;
        placements.forEach(([x,z,yaw=0,sx=1,y=.08,sz=sx],i)=>{
          dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(sx,name==='EastPlanter'||name==='EastFence'?1:sx,sz);dummy.updateMatrix();
          mesh.setMatrixAt(i,matrix.multiplyMatrices(dummy.matrix,local));
        });mesh.computeBoundingSphere();root.add(mesh);
      });
    }
    function primitiveInstances(name:string,geometry:T.BufferGeometry,material:T.Material,placements:readonly PrimitivePlacement[],castShadow=true) {
      const mesh=new T.InstancedMesh(geometry,material,placements.length);mesh.name=name;mesh.castShadow=castShadow;mesh.receiveShadow=true;
      placements.forEach(([x,y,z,sx,sy,sz,yaw=0,rx=0,rz=0],i)=>{
        dummy.position.set(x,y,z);dummy.rotation.set(rx,yaw,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      });
      mesh.computeBoundingSphere();root.add(mesh);return mesh;
    }
    for(const building of EAST_BUILDINGS)instances(building.name,[[building.x,building.z]]);
    instances('EastGround',[[0,0,0,1,0]]);
    instances('EastPlanter',EAST_BEDS.map(b=>[b.x,b.z,0,b.w,.08,b.d]));
    // Match the retained front perimeter: precast panel courses, tapered feet,
    // recessed joints and lifting eyes. The eight-metre centre stays visibly
    // fractured while world collision continues across the interaction line.
    const concrete=materials.get('EAST_Concrete')!,steel=materials.get('EAST_Steel')!;
    const panels:PrimitivePlacement[]=[],posts:PrimitivePlacement[]=[],feet:PrimitivePlacement[]=[],eyes:PrimitivePlacement[]=[];
    const postKeys=new Set<string>();
    for(const [a,b] of EAST_BOUNDARY_RUNS) {
      const count=Math.ceil((b-a)/3.2),step=(b-a)/count;
      for(let i=0;i<=count;i++) {
        const z=a+i*step,key=z.toFixed(3);
        if(!postKeys.has(key)) {
          postKeys.add(key);posts.push([EAST_DISTRICT.east,1.36,z,.56,2.56,.54]);feet.push([EAST_DISTRICT.east,.31,z,.98,.55,.67]);
          eyes.push([EAST_DISTRICT.east,2.72,z,.12,.12,.12,-Math.PI/2]);
        }
        if(i===count)continue;
        const center=z+step/2,width=step-.5;
        panels.push([EAST_DISTRICT.east,.32,center,.53,.48,width],[EAST_DISTRICT.east,1.02,center,.25,.87,width+.02],[EAST_DISTRICT.east,1.91,center,.25,.87,width+.02],[EAST_DISTRICT.east,2.39,center,.30,.055,width+.03]);
      }
    }
    primitiveInstances('East / precast concrete panels',new RoundedBoxGeometry(1,1,1,1,.035),concrete,panels);
    primitiveInstances('East / precast concrete posts',new RoundedBoxGeometry(1,1,1,1,.035),concrete,posts);
    const footGeometry=new T.BoxGeometry(1,1,1),footPositions=footGeometry.attributes.position;
    for(let i=0;i<footPositions.count;i++)if(footPositions.getY(i)>.45)footPositions.setX(i,footPositions.getX(i)*.58);
    footGeometry.computeVertexNormals();primitiveInstances('East / tapered concrete feet',footGeometry,concrete,feet);
    primitiveInstances('East / steel lifting eyes',new T.TorusGeometry(1,.19,5,10,Math.PI),steel,eyes,false);
    instances('ExpeditionBreach',[[EAST_DISTRICT.east,EAST_DISTRICT.breachZ,-Math.PI/2]]);
    // A rain-dark gravel trail runs from the old breach into the shoulder.
    const trailCurve=new T.CatmullRomCurve3(EAST_TRAIL_POINTS.map(([x,z])=>new T.Vector3(x,0,z)),false,'catmullrom',.35);
    const trailSegments=36,trailPositions:number[]=[],trailUvs:number[]=[],trailIndices:number[]=[];
    for(let i=0;i<=trailSegments;i++) {
      const t=i/trailSegments,p=trailCurve.getPoint(t),tangent=trailCurve.getTangent(t),nx=-tangent.z,nz=tangent.x;
      const halfWidth=1.16+Math.sin(t*Math.PI*3.2)*.13;
      for(const side of [-1,1]) {
        const x=p.x+nx*halfWidth*side,z=p.z+nz*halfWidth*side;
        trailPositions.push(x,eastGroundHeight(x,z)+.035,z);trailUvs.push((side+1)/2,t*5.5);
      }
      if(i<trailSegments)trailIndices.push(i*2,i*2+2,i*2+1,i*2+1,i*2+2,i*2+3);
    }
    const trailGeometry=new T.BufferGeometry();trailGeometry.setAttribute('position',new T.Float32BufferAttribute(trailPositions,3));trailGeometry.setAttribute('uv',new T.Float32BufferAttribute(trailUvs,2));trailGeometry.setIndex(trailIndices);trailGeometry.computeVertexNormals();
    const trailMaterial=materials.get('EAST_Earth')!.clone();trailMaterial.name='EAST_GravelTrail';trailMaterial.color.setRGB(.72,.68,.54);trailMaterial.roughness=1;trailMaterial.polygonOffset=true;trailMaterial.polygonOffsetFactor=-1;
    const trail=new T.Mesh(trailGeometry,trailMaterial);trail.name='East / gravel expedition trail';trail.receiveShadow=true;root.add(trail);
    primitiveInstances('East / trail edge stones',new T.IcosahedronGeometry(.5,1),concrete,EAST_TRAIL_ROCKS.map(({x,z,yaw,scale,variant})=>[
      x,eastGroundHeight(x,z)+scale*.22,z,scale*(1+variant*.16),scale*(.55+variant*.11),scale*(.85+(2-variant)*.14),yaw,variant*.09,(variant-1)*.08,
    ]));
    function plantGeometry(variant:number) {
      const vertices:number[]=[];
      const triangle=(a:number[],b:number[],c:number[])=>vertices.push(...a,...b,...c);
      const leaf=(angle:number,baseY:number,length:number,width:number,lift:number,originRadius=0)=>{
        const dx=Math.cos(angle),dz=Math.sin(angle),px=-dz,pz=dx;
        const base=[dx*originRadius,baseY,dz*originRadius],mid=[dx*(originRadius+length*.52),baseY+lift*.48,dz*(originRadius+length*.52)],tip=[dx*(originRadius+length),baseY+lift,dz*(originRadius+length)];
        const left=[mid[0]+px*width,mid[1],mid[2]+pz*width],right=[mid[0]-px*width,mid[1],mid[2]-pz*width];
        triangle(base,left,tip);triangle(base,tip,right);
      };
      if(variant===0)for(let i=0;i<9;i++)leaf(i*Math.PI*2/9,.04,.58,.105,.34+(i%3)*.05);
      else if(variant===1) {
        for(let i=0;i<7;i++)leaf(i*Math.PI*2/7,.12,.46,.15,.33,.045);
        for(let i=0;i<5;i++)leaf(i*Math.PI*2/5+.45,.35,.34,.13,.30,.025);
      } else for(let i=0;i<13;i++) {
        const angle=i*Math.PI*2/13,dx=Math.cos(angle),dz=Math.sin(angle),r=.055+(i%3)*.025,width=.025+(i%2)*.012,height=.75+(i%5)*.11;
        triangle([dx*r-dz*width,0,dz*r+dx*width],[dx*r+dz*width,0,dz*r-dx*width],[dx*(r+.08*Math.sin(i*2.3)),height,dz*(r+.08*Math.cos(i*1.7))]);
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
    }
    const plantFamilies=[
      {name:'ferns',geometry:plantGeometry(0),color:0x315038},
      {name:'broadleaf',geometry:plantGeometry(1),color:0x3d5c35},
      {name:'reed grass',geometry:plantGeometry(2),color:0x53633a},
    ];
    for(const [variant,family] of plantFamilies.entries()) {
      const plantMaterial=new T.MeshStandardMaterial({name:`East ${family.name}`,color:family.color,roughness:.96,side:T.DoubleSide});
      const plants=EAST_TRAIL_PLANTS.filter((p,i)=>p.variant===variant&&(!mobile||i%2===0)).map(({x,z,yaw,scale})=>[
        x,eastGroundHeight(x,z),z,scale,scale*(variant===1?.72:1),scale,yaw,
      ] as PrimitivePlacement);
      primitiveInstances(`East / ${family.name}`,family.geometry,plantMaterial,plants,!mobile);
    }
    instances('BurnBarrel',[[50.4,25.7,0,1,eastGroundHeight(50.4,25.7)],[47,12.2,0,.85,eastGroundHeight(47,12.2)]]);
    instances('TirePile',[[51.5,27.3,.7,1,eastGroundHeight(51.5,27.3)],[48,14,1.3,.8,eastGroundHeight(48,14)]]);
    instances('EastRubble',Array.from({length:18},(_,i)=>{
      const x=47.5+(i%3)*3.3,z=-2+i*2.4;
      return [x,z,i*1.7,.7+i%3*.15,eastGroundHeight(x,z)] as Placement;
    }));
    // A single animated shader batch for flame tongues; no per-flame lights.
    const flameGeometry=new T.LatheGeometry([
      new T.Vector2(0,0),new T.Vector2(.13,.06),new T.Vector2(.105,.24),new T.Vector2(.055,.57),new T.Vector2(0,.93),
    ],7);
    const flameMaterial=new T.MeshBasicMaterial({color:0xff7420,transparent:true,opacity:.78,depthWrite:false,blending:T.AdditiveBlending});
    flameMaterial.onBeforeCompile=shader=>{
      shader.uniforms.fireTime=fireTime;
      shader.vertexShader='uniform float fireTime; varying float fireHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        fireHeight=position.y;transformed.x+=sin(position.y*8.+fireTime*5.+instanceMatrix[3].x*9.)*position.y*.14;
        transformed.y*=.9+.14*sin(fireTime*6.+instanceMatrix[3].z*11.);`);
      shader.fragmentShader='varying float fireHeight;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(vec3(1.,.87,.42),vec3(.9,.08,.005),fireHeight);diffuseColor.a*=1.-fireHeight*.85;');
    };
    const flames=new T.InstancedMesh(flameGeometry,flameMaterial,16);flames.name='East / barrel flames';
    for(let i=0;i<16;i++) {
      const other=i>=8,x=other?47:50.4,z=other?12.2:25.7,s=other?.85:1,a=i*2.4,r=i%3*.08;
      dummy.position.set(x+Math.cos(a)*r,eastGroundHeight(x,z)+1.05*s,z+Math.sin(a)*r);
      dummy.rotation.set(0,a,.13*Math.sin(i));dummy.scale.set(s,s*(.6+(i%4)*.2),s);dummy.updateMatrix();flames.setMatrixAt(i,dummy.matrix);
    }flames.computeBoundingSphere();root.add(flames);
    fireLight=new T.PointLight(0xff8731,16,8,2);fireLight.position.set(50.4,1.5,25.7);root.add(fireLight);
    for(const [x,z,color,power] of [[40.5,5,0xffb064,19],[43.3,11.5,0xffb064,14],[35,15,0xffba77,14],[43,26,0xffbd72,10]]) {
      if(mobile&&x===35)continue;
      const light=new T.PointLight(color,power,9,2);light.position.set(x,2.6,z);root.add(light);
    }
    const smokeMaterial=new T.PointsMaterial({map:roadGlowTexture(),color:0x627575,size:1.15,transparent:true,opacity:.10,depthWrite:false});
    const smokeGeometry=new T.BufferGeometry();
    const vertices=new Float32Array(12*3);
    for(let i=0;i<12;i++){vertices[i*3]=50.4+Math.sin(i*4)*.2;vertices[i*3+1]=1.5+i*.2;vertices[i*3+2]=25.7+Math.cos(i*3)*.16;}
    smokeGeometry.setAttribute('position',new T.BufferAttribute(vertices,3));root.add(new T.Points(smokeGeometry,smokeMaterial));
  }).catch(error=>{if(!disposed){console.error('East district load failed',error);onError('Не удалось загрузить восточный квартал. Перезагрузите страницу.');}});
  return {root,ready,
    update(dt:number,reducedMotion:boolean){
      if(disposed||reducedMotion)return;
      time+=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;fireTime.value=time;
      if(fireLight)fireLight.intensity=15+Math.sin(time*8)*1.2+Math.sin(time*13)*.7;
    },
    dispose(){
      if(disposed)return;disposed=true;parent.remove(root);
      root.remove(floor);floorGeometry.dispose(); // borrowed material remains owned by base
      root.add(owned);root.traverse(o=>{if(o instanceof T.InstancedMesh||o instanceof T.Light)o.dispose();});
      disposeObjectTree(root);root.clear();
    },
  };
}
