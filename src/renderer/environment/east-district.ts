import * as T from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSET_URLS } from '../../assets/registry.ts';
import { disposeObjectTree } from '../three/dispose.ts';
import { EAST_BEDS, EAST_BUILDINGS, EAST_DISTRICT, eastGroundHeight } from './east-district-layout.ts';
import { roadGlowTexture } from './city-street-geometry.ts';

type Placement = readonly [x:number,z:number,yaw?:number,sx?:number,y?:number,sz?:number];
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
    gltf.scene.traverse(o=>{
      if(!(o instanceof T.Mesh))return;
      for(const mat of Array.isArray(o.material)?o.material:[o.material]) {
        if(!(mat instanceof T.MeshStandardMaterial))continue;
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
    for(const building of EAST_BUILDINGS)instances(building.name,[[building.x,building.z]]);
    instances('EastGround',[[0,0,0,1,0]]);
    instances('EastPlanter',EAST_BEDS.map(b=>[b.x,b.z,0,b.w,.08,b.d]));
    const fence:Placement[]=[];
    // Endpoints meet the breach's 8m wide masonry shoulders exactly.
    for(const [a,b] of [[-10,21],[29,34]]) {
      const count=Math.ceil((b-a)/4),length=(b-a)/count;
      for(let i=0;i<count;i++)fence.push([EAST_DISTRICT.east,a+(i+.5)*length,-Math.PI/2,length/4,.08,1]);
    }
    instances('EastFence',fence);
    instances('ExpeditionBreach',[[EAST_DISTRICT.east,EAST_DISTRICT.breachZ,-Math.PI/2]]);
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
