import * as T from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSET_URLS } from '../../assets/registry.ts';
import { disposeObjectTree } from '../three/dispose.ts';
import { roadGlowTexture } from './city-street-geometry.ts';
import { deliveryPose, parkWalkwayContains, PARK_ROCKS, PARK_BENCHES, PARK_LANTERNS, PARK_STALLS, PARK_STONE_LANTERNS, SAKURA_PARK, SAKURA_TREES } from './sakura-park-layout.ts';
import { createParkPathMask, gardenGroundMaterial, lanternReflectionMaterial } from './park-ground.ts';
import { EAST_BEDS, EAST_TREES, EAST_LANTERNS, EAST_BENCHES, eastGroundHeight } from './east-district-layout.ts';

type Placement = readonly [x: number, z: number, yaw?: number, scale?: number, y?: number, heightScale?: number, depthScale?:number];
/** One Blender kit; repeated objects share mesh buffers, textures and instanced draws.
 * Animation uses the scene's clock. No timers, secondary render loop or shadow lights. */
export function createSakuraPark(parent: T.Scene, loader: GLTFLoader, mobile: boolean, onError: (message: string) => void) {
  const root = new T.Group(); root.name = 'Sakura garden'; parent.add(root);
  let disposed = false, time = 0, deliveryTime = 0;
  const matrix = new T.Matrix4(), dummy = new T.Object3D();
  const moving: { mesh: T.InstancedMesh; local: T.Matrix4 }[] = [];
  const waterTime = { value: 0 };
  const owned = new T.Group(); // Retain uninstanced prototypes for unified resource teardown.
  let droplets: T.Points | undefined, petals: T.Points | undefined, steam:T.Points|undefined;
  const flash = new T.DirectionalLight(0xb4ceff, 0); flash.position.set(-20,35,-15); root.add(flash);
  const moon = new T.DirectionalLight(0xadcaff, .78); moon.position.set(12,28,24); root.add(moon);
  const gardenFill=new T.DirectionalLight(0xffd5a4,.65);gardenFill.position.set(-20,12,24);root.add(gardenFill);
  const glowTexture = roadGlowTexture();
  const glowMaterial = new T.MeshBasicMaterial({map:glowTexture,color:0xffa047,transparent:true,opacity:.26,depthWrite:false,blending:T.AdditiveBlending});
  const glowGeometry = new T.PlaneGeometry(5.8,5.8).rotateX(-Math.PI/2);
  // Also retain these when an asset load fails before the glow meshes exist.
  owned.add(new T.Mesh(glowGeometry,glowMaterial));
  const ready = loader.loadAsync(`${ASSET_URLS.sakuraPark}?v=20260920-10`).then(gltf => {
    if (disposed) { disposeObjectTree(gltf.scene); return; }
    owned.add(gltf.scene);
    const materials = new Map<string,T.MeshStandardMaterial>();
    gltf.scene.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!(mat instanceof T.MeshStandardMaterial)) continue;
        materials.set(mat.name,mat);
        for (const texture of [mat.map,mat.normalMap,mat.emissiveMap]) if (texture) texture.anisotropy = mobile ? 2 : 8;
        mat.envMapIntensity = .55;
        if (mat.name.includes('Blossom')) {
          mat.side=T.DoubleSide;mat.alphaTest=.42;mat.transparent=false;mat.depthWrite=true;mat.emissiveIntensity=.18;
          mat.onBeforeCompile=shader=>{
            shader.vertexShader='varying vec3 blossomLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nblossomLocal=position;');
            shader.fragmentShader='varying vec3 blossomLocal;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.76+.23*sin(blossomLocal.x*2.3)*cos(blossomLocal.y*3.1+blossomLocal.z);');
          };
        }
        if (mat.name.includes('Washi')) { mat.emissive.set(0xff8e35); mat.emissiveIntensity = .65; }
      }
    });
    const mat = (name: string) => materials.get(`SAKURA_${name}`)!;
    const fountainStone=mat('Basalt').clone();fountainStone.color.setRGB(.95,1.05,1.15);fountainStone.roughness=.57;fountainStone.normalScale.setScalar(.3);
    owned.add(new T.Mesh(glowGeometry,fountainStone));
    mat('Moss').color.setRGB(1.35,1.6,1.05);
    mat('Foliage')?.color.setRGB(.48,.56,.42);
    mat('Ceramic')?.color.multiplyScalar(.6);
    const foliageMaterials=new Map<string,T.MeshStandardMaterial>();
    const sprayMaterial=new T.MeshBasicMaterial({map:mat('WaterSpray')?.map,transparent:true,opacity:.67,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,color:0xb4d8d8});
    owned.add(new T.Mesh(glowGeometry,sprayMaterial));
    sprayMaterial.onBeforeCompile=shader=>{
      shader.uniforms.waterTime=waterTime;
      shader.vertexShader='uniform float waterTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(position.y*17.+waterTime*4.)*.012*position.y;');
    };
    function instances(name: string, placements: readonly Placement[], animated = false) {
      const source = gltf.scene.getObjectByName(name);
      if (!source) throw new Error(`Missing park model: ${name}`);
      source.updateWorldMatrix(true,true);
      const inverse = source.matrixWorld.clone().invert();
      source.traverse(o => {
        if (!(o instanceof T.Mesh)) return;
        if(name==='Fountain' && (o.material as T.Material).name==='SAKURA_Cyan')return;
        const local = inverse.clone().multiply(o.matrixWorld);
        let material=name==='Fountain' && (o.material as T.Material).name==='SAKURA_Basalt'?fountainStone:o.material;
        if(name==='FountainSpray')material=sprayMaterial;
        if((o.material as T.Material).name==='SAKURA_Foliage') {
          if(!foliageMaterials.has(name)) {
            const variant=mat('Foliage').clone();
            variant.color.setRGB(...(name==='GardenShrub'?[.25,.34,.30]:name==='ForestGrass'?[.38,.43,.30]:[.30,.42,.34]) as [number,number,number]);
            foliageMaterials.set(name,variant);
          }
          material=foliageMaterials.get(name)!;
        }
        const mesh = new T.InstancedMesh(o.geometry,material,placements.length);
        mesh.name = `Park / ${o.name}`; mesh.castShadow = !animated; mesh.receiveShadow = true;
        for (let i=0;i<placements.length;i++) {
          const [x,z,yaw=0,scale=1,y=.095,heightScale=scale,depthScale=scale] = placements[i];
          dummy.position.set(x,y,z); dummy.rotation.set(0,yaw,0); dummy.scale.set(scale,heightScale,depthScale); dummy.updateMatrix();
          mesh.setMatrixAt(i,matrix.multiplyMatrices(dummy.matrix,local));
        }
        mesh.computeBoundingSphere(); root.add(mesh);
        if (animated) { mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled=false; moving.push({mesh,local}); }
      });
    }
    const pathMask=createParkPathMask();owned.add(new T.Mesh(glowGeometry,new T.MeshBasicMaterial({map:pathMask})));
    const ground = new T.Mesh(new T.PlaneGeometry(64,22),gardenGroundMaterial(mat('Basalt'),mat('Moss'),pathMask));
    ground.geometry.rotateX(-Math.PI/2); ground.geometry.translate(0,.08,23);
    const pos = ground.geometry.attributes.position, uv = ground.geometry.attributes.uv;
    for(let i=0;i<pos.count;i++) uv.setXY(i,pos.getX(i)/4,pos.getZ(i)/4);
    ground.receiveShadow=true;ground.name='Rain-dark basalt garden paths';root.add(ground);
    const slab = new T.Mesh(new T.BoxGeometry(64,.5,22),mat('Basalt'));slab.position.set(0,-.2,23);root.add(slab);
    const trees:Placement[]=SAKURA_TREES.map(([x,z,s],i)=>[x,z,i*2.39,s*(i===0?1.5:i===4?1.15:1),.095,s*(i===0?1.1:1)]);
    trees.push(...EAST_TREES.map(([x,z,s],i)=>[x,z,i*2.39,s,.20] as Placement));
    instances('SakuraTree',trees);
    instances('YataiStall',PARK_STALLS);
    instances('Fountain',[[SAKURA_PARK.fountainX,SAKURA_PARK.fountainZ,0,SAKURA_PARK.fountainScale,.095,1.3,SAKURA_PARK.fountainScale*.8]]);
    instances('LanternPost',[...PARK_LANTERNS,...EAST_LANTERNS]);
    instances('ParkBench',[...PARK_BENCHES,...EAST_BENCHES]);
    instances('StoneLantern',PARK_STONE_LANTERNS);
    instances('GardenSign',PARK_STALLS.map(([x,z])=>[x+2.5,z,0,.65,2.5]));
    const plants: Placement[] = [];
    const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),fountainStone,PARK_ROCKS.length);
    rocks.castShadow=true;rocks.receiveShadow=true;root.add(rocks);
    PARK_ROCKS.forEach(({x,z,yaw,j,w,h,d},i)=>{
      dummy.position.set(x,.4,z);dummy.rotation.set(.13*j,yaw,.2);
      dummy.scale.set(w,h,d);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
    });
    for(let z=13.5;z<33.5;z+=mobile?1.65:1.25)for(let x=-31;x<32;x+=mobile?1.65:1.25) {
      const px=x+Math.sin(z*37+x*13)*.35,pz=z+Math.cos(z*19+x*33)*.3;
      if(parkWalkwayContains({x:px,z:pz},.5)||Math.hypot(px-SAKURA_PARK.fountainX,pz-SAKURA_PARK.fountainZ)<5.3)continue;
      plants.push([px,pz,x*z,.85+Math.abs(Math.sin(x*17+z))* .55,.095]);
    }
    for(const bed of EAST_BEDS)for(let x=bed.x-bed.w/2+.35;x<bed.x+bed.w/2-.2;x+=mobile?1.2:.85)
      for(let z=bed.z-bed.d/2+.35;z<bed.z+bed.d/2-.2;z+=mobile?1.2:.85)plants.push([x,z,x*z,.65+Math.abs(Math.sin(x*17+z))*.3,.23]);
    // Reuse the same foliage atlas for the grounded rail shoulder, leaving a
    // gravel service trail visible beyond the expedition opening.
    for(let z=-8;z<57;z+=mobile?2.3:1.65)for(let x=47.4;x<65;x+=mobile?2.7:1.95) {
      if((x>49&&x<53&&z>21&&z<31)||Math.sin(x*4+z*3)>.35)continue;
      plants.push([x,z,x*z,.7+Math.abs(Math.sin(x*7+z))*.45,eastGroundHeight(x,z)]);
    }
    instances('ForestGrass',plants.filter((_,i)=>i%4<2).map(([x,z,yaw,s,y])=>[x,z,yaw,s!* .85,y]));
    instances('FernCluster',plants.filter((_,i)=>i%4===2));
    instances('GardenShrub',plants.filter((_,i)=>i%4===3).map(([x,z,yaw,s,y])=>[x,z,yaw,s!* .8,y]));
    const glow = new T.InstancedMesh(new T.PlaneGeometry(3.8,9.2).rotateX(-Math.PI/2),lanternReflectionMaterial(pathMask),PARK_LANTERNS.length+2);
    [...PARK_LANTERNS,...PARK_STALLS].forEach(([x,z],i)=>{
      dummy.position.set(x+1,.102,z+2.7);dummy.rotation.set(0,.35,0);dummy.scale.set(1+i%3*.14,1,1);dummy.updateMatrix();glow.setMatrixAt(i,dummy.matrix);
    });root.add(glow);
    // A handful of pooled real lights, without shadows; the rest use emissive paper and ground spill.
    for(const [i,[x,z]] of (mobile?[PARK_STALLS[0],PARK_STALLS[1]]:[...PARK_STALLS,[-7,26],[8,28],[-21,17],[17,17]]).entries()) {
      const light = new T.PointLight(0xffae62,i<2?18:26,11,2);light.position.set(x,2.7,z+1);root.add(light);
    }
    const poolLight = new T.PointLight(0x77d6e2,12,9,2);poolLight.position.set(SAKURA_PARK.fountainX,1.1,SAKURA_PARK.fountainZ);root.add(poolLight);
    const water = new T.MeshStandardMaterial({color:0x28636a,metalness:.4,roughness:.19,emissive:0x15383a,emissiveIntensity:.24,transparent:true,opacity:.95});
    water.onBeforeCompile=shader=>{
      shader.uniforms.parkTime=waterTime;
      shader.vertexShader='varying vec3 poolPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npoolPosition=position;');
      shader.fragmentShader='uniform float parkTime; varying vec3 poolPosition;\n'+shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
        float rings=sin(length(poolPosition.xy)*25.-parkTime*3.+sin(poolPosition.x*5.));
        normal=normalize(normal+vec3(rings*.16,cos(poolPosition.x*22.+sin(poolPosition.y*9.)+parkTime)*.16,0.));`)
        .replace('#include <color_fragment>',`#include <color_fragment>
          float wave=sin(poolPosition.x*14.+sin(poolPosition.y*7.+parkTime)*3.)*sin(poolPosition.y*19.+sin(poolPosition.x*11.)*2.-parkTime*1.7);
          float caustic=pow(max(0.,wave),16.);
          float ripple=pow(max(0.,sin(length(poolPosition.xy)*23.+sin(poolPosition.x*11.)*.8-parkTime*2.)),24.);
          diffuseColor.rgb*=.7+wave*.15;
          diffuseColor.rgb+=vec3(.19,.48,.46)*(caustic*.5+ripple*.1);
          float foam=0.;
          for(int i=0;i<4;i++) {
            float a=float(i)*2.0944;
            vec2 jet=i==3?vec2(0.):vec2(cos(a)*1.8,sin(a)*1.8);
            float d=length(poolPosition.xy-jet);
            foam+=exp(-d*2.6)*(.35+.65*pow(max(0.,sin(d*44.-parkTime*6.+wave)),2.));
          }
          diffuseColor.rgb+=vec3(.45,.6,.56)*foam;`)
        .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          totalEmissiveRadiance+=vec3(.42,.73,.71)*(foam*.8+caustic*.5+ripple*.18);`);
    };
    const pool = new T.Mesh(new T.CircleGeometry(1.8*SAKURA_PARK.fountainScale,64),water);pool.rotation.x=-Math.PI/2;pool.scale.y=.8;pool.position.set(SAKURA_PARK.fountainX,.61,SAKURA_PARK.fountainZ);root.add(pool);
    const dropGeometry = new T.BufferGeometry();dropGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array((mobile?150:390)*3),3));
    droplets=new T.Points(dropGeometry,new T.PointsMaterial({color:0xd7f5ec,map:glowTexture,size:.11,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending}));
    droplets.position.set(SAKURA_PARK.fountainX,.61,SAKURA_PARK.fountainZ);droplets.scale.z=.8;droplets.frustumCulled=false;root.add(droplets);
    instances('FountainSpray',[0,1,2,3].map(i=>{
      const a=i*Math.PI*2/3,r=i===3?0:1.8;
      return[SAKURA_PARK.fountainX+Math.cos(a)*r,SAKURA_PARK.fountainZ+Math.sin(a)*r*.8,0,i===3?3.6:2.6,.61,i===3?4.2:2.5];
    }));
    const poolGlows=new T.InstancedMesh(new T.PlaneGeometry(1.4,1.1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:glowTexture,color:0x78eadf,transparent:true,opacity:.48,depthWrite:false,blending:T.AdditiveBlending}),6);
    for(let i=0;i<6;i++) {const a=i*Math.PI/3;dummy.position.set(SAKURA_PARK.fountainX+Math.cos(a)*3.05,.618,SAKURA_PARK.fountainZ+Math.sin(a)*2.44);dummy.rotation.set(0,a,0);dummy.scale.setScalar(1);dummy.updateMatrix();poolGlows.setMatrixAt(i,dummy.matrix);}root.add(poolGlows);
    const petalCount=mobile?1800:5600, petalPositions=new Float32Array(petalCount*3);
    let seed=74129;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<petalCount;i++) {
      const [x,z]=SAKURA_TREES[i%SAKURA_TREES.length],a=random()*Math.PI*2,r=Math.sqrt(random())*5;
      // Wind gathers petals at planting edges, with a lighter trail around the pool.
      const onRing=i%5===0,ringRadius=5.35+random()*2.4;
      petalPositions.set(onRing?[SAKURA_PARK.fountainX+Math.cos(a)*ringRadius,.106,SAKURA_PARK.fountainZ+Math.sin(a)*ringRadius]:[x+Math.cos(a)*r,.106,z+Math.sin(a)*r*.75],i*3);
    }
    const petalGeometry=new T.BufferGeometry();petalGeometry.setAttribute('position',new T.BufferAttribute(petalPositions,3));
    petals=new T.Points(petalGeometry,new T.PointsMaterial({map:glowTexture,color:0xe49aaa,size:.11,transparent:true,opacity:.85,depthWrite:false}));root.add(petals);
    const steamGeometry=new T.BufferGeometry();steamGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(60*3),3));
    steam=new T.Points(steamGeometry,new T.PointsMaterial({map:glowTexture,color:0xb8c4c4,size:.8,opacity:.16,transparent:true,depthWrite:false}));steam.frustumCulled=false;root.add(steam);
    instances('DeliveryRobot',[0,1,2].map(i=>{const p=deliveryPose(0,i);return[p.x,p.z,p.yaw,1.2];}),true);
  }).catch(error=>{if(!disposed) { console.error('Sakura park asset load failed',error);onError('Не удалось загрузить сад сакуры. Перезагрузите страницу.'); }});
  return {root,ready,
    update(dt:number,deliveries:boolean,rain:boolean,reducedMotion:boolean) {
      if(disposed)return;
      dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
      time+=dt; if(deliveries)deliveryTime+=dt;
      waterTime.value=reducedMotion?0:time;
      if(deliveries && dt>0) for(let i=0;i<3;i++) {
        const p=deliveryPose(deliveryTime,i);dummy.position.set(p.x,.095,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(1.2);dummy.updateMatrix();
        for(const {mesh,local} of moving) {mesh.setMatrixAt(i,matrix.multiplyMatrices(dummy.matrix,local));mesh.instanceMatrix.needsUpdate=true;}
      }
      if(droplets) {
        const positions=droplets.geometry.attributes.position;
        for(let i=0;i<positions.count;i++) {
          const jet=i%4,angle=jet*Math.PI*2/3,phase=((reducedMotion?0:time)*.7+i*.137)%1;
          const r=jet===3?0:1.8;
          const jitter=Math.sin(i*37.8)*.06;
          positions.setXYZ(i,Math.cos(angle)*(r+phase*.28)+jitter,Math.sin(phase*Math.PI)*(jet===3?3.9:2.3),Math.sin(angle)*(r+phase*.28)+Math.cos(i*19)*.06);
        }positions.needsUpdate=true;
      }
      if(steam) {
        const p=steam.geometry.attributes.position;
        for(let i=0;i<p.count;i++) {
          const [x,z]=PARK_STALLS[i%2],phase=((reducedMotion?0:time)*.19+i*.137)%1;
          p.setXYZ(i,x+Math.sin(i*19+phase*2)*.25+phase*.6,1.8+phase*1.7,z+.4+Math.cos(i*11)*.25);
        }p.needsUpdate=true;
      }
      // Distant, infrequent diffuse lightning; disabled under reduced motion.
      const storm=time%37;
      flash.intensity=rain&&!reducedMotion&&storm>30&&storm<30.4?Math.max(0,Math.sin((storm-30)*Math.PI/.4))*.8:0;
    },
    dispose() {
      if(disposed)return;disposed=true;parent.remove(root);root.add(owned);
      root.traverse(object=>{if(object instanceof T.InstancedMesh||object instanceof T.Light)object.dispose();});
      disposeObjectTree(root);root.clear();
    },
  };
}
