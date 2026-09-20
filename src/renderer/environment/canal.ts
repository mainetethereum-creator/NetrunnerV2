import * as T from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { ASSET_URLS } from '../../assets/registry.ts';
import { disposeObjectTree } from '../three/dispose.ts';
import { CANAL,CANAL_LANTERNS,CANAL_NEAR_LANTERNS,BRIDGE_LANTERNS } from './canal-layout.ts';
import { createCanalWater } from './canal-water.ts';
import { roadGlowTexture } from './city-street-geometry.ts';

type Placement=readonly [x:number,z:number,yaw?:number,scale?:number,y?:number];
/** Scene-owned, closed forest crossing. Models are authored in Blender; repeated
 * bank modules share instanced geometry. No extra timer, renderer or reflection. */
export function createCanal(parent:T.Scene,loader:GLTFLoader,mobile:boolean,reflection:Reflector,onError:(message:string)=>void,
  loadNormal:()=>Promise<T.Texture>=()=>new T.TextureLoader(loader.manager).loadAsync(ASSET_URLS.canalNormal)) {
  const root=new T.Group();root.name='Canal / closed forest crossing';parent.add(root);
  const owned=new T.Group();let disposed=false,time=0;
  let water:ReturnType<typeof createCanalWater>|undefined;
  let mist:T.Points|undefined;
  const ready=Promise.allSettled([loader.loadAsync(`${ASSET_URLS.canalKit}?v=20260920-4`),loadNormal()]).then(results=>{
    const [modelResult,normalResult]=results;
    if(modelResult.status==='fulfilled')owned.add(modelResult.value.scene);
    if(normalResult.status==='fulfilled')owned.add(new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({map:normalResult.value})));
    if(disposed){disposeObjectTree(owned);owned.clear();return;}
    if(modelResult.status==='rejected'||normalResult.status==='rejected')throw new Error('Canal model or water texture failed to load');
    const source=modelResult.value.scene,normal=normalResult.value;
    normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.anisotropy=mobile?2:4;
    source.traverse(o=>{
      if(!(o instanceof T.Mesh))return;
      for(const mat of Array.isArray(o.material)?o.material:[o.material]) {
        if(!(mat instanceof T.MeshStandardMaterial))continue;
        mat.envMapIntensity=.65;
        for(const tex of [mat.map,mat.normalMap])if(tex)tex.anisotropy=mobile?2:8;
        if(mat.name==='CANAL_Foliage'){mat.alphaTest=.42;mat.transparent=false;mat.side=T.DoubleSide;mat.color.setRGB(.55,.64,.5);}
        if(mat.name==='CANAL_Washi'){mat.color.set(0xb16b30);mat.emissive.set(0xff8d2d);mat.emissiveIntensity=1.05;}
        if(mat.name==='CANAL_Masonry'){mat.color.setRGB(.88,.95,1.);mat.normalScale.setScalar(.5);}
        if(mat.name==='CANAL_Cedar'){
          mat.color.setRGB(.95,.62,.34);mat.roughness=.82;mat.normalScale.setScalar(.26);mat.envMapIntensity=.18;
          mat.emissive.set(0x713916);mat.emissiveMap=mat.map;mat.emissiveIntensity=.32;
        }
        if(mat.name==='CANAL_Moss')mat.color.setRGB(.55,.7,.40);
        if(mat.name==='CANAL_Iron')mat.color.setRGB(.30,.34,.38);
        if(mat.name==='CANAL_Rock'){mat.color.setRGB(.55,.64,.59);mat.roughness=.87;}
      }
    });
    const dummy=new T.Object3D(),matrix=new T.Matrix4();
    function instances(name:string,placements:readonly Placement[]) {
      const model=source.getObjectByName(name);if(!model)throw new Error(`Missing canal model ${name}`);
      model.updateWorldMatrix(true,true);const inverse=model.matrixWorld.clone().invert();
      model.traverse(o=>{
        if(!(o instanceof T.Mesh))return;
        const local=inverse.clone().multiply(o.matrixWorld);
        const mesh=new T.InstancedMesh(o.geometry,o.material,placements.length);mesh.name=`Canal / ${o.name}`;
        mesh.castShadow=true;mesh.receiveShadow=true;
        placements.forEach(([x,z,yaw=0,s=1,y=.08],i)=>{
          dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(s);dummy.updateMatrix();
          mesh.setMatrixAt(i,matrix.multiplyMatrices(dummy.matrix,local));
          if(name==='BankFern'||name==='CanalReeds') {
            const tone=.46+.44*(.5+.5*Math.sin(x*.62+z*.31));
            mesh.setColorAt(i,new T.Color().setRGB(tone*.82,tone,tone*.70));
          }
        });mesh.computeBoundingSphere();root.add(mesh);
      });
    }
    const north:Placement[]=[],south:Placement[]=[],fences:Placement[]=[];
    for(let x=CANAL.west+2;x<CANAL.east;x+=4) {
      north.push([x,34]);south.push([x,48.7,Math.PI]);
      if(Math.abs(x-CANAL.bridgeX)>4)fences.push([x,33.85],[x,48.95,Math.PI]);
    }
    instances('Embankment',[...north,...south]);instances('CanalRailing',fences);
    instances('UnfinishedBridge',[[CANAL.bridgeX,CANAL.bridgeZ,0,1,0]]);
    instances('ForestGate',[[CANAL.bridgeX,CANAL.gateZ,0,1,.10]]);
    instances('ConstructionSupplies',[[CANAL.bridgeX+4.0,35.0,Math.PI/2,1.3,.10]]);
    const allLamps=[...CANAL_LANTERNS,...CANAL_NEAR_LANTERNS];
    instances('CanalLantern',[
      ...allLamps.filter(p=>Math.abs(p.x-CANAL.bridgeX)>2.7).map(({x,z})=>[x,z,0,1.15,.25] as const),
      ...BRIDGE_LANTERNS.map(({x,z,y})=>[x,z,0,1.15,y] as const),
    ]);
    const ivy:Placement[]=[],reeds:Placement[]=[],ferns:Placement[]=[],rocks:Placement[]=[];
    const bankPlantCount=Math.ceil((CANAL.east-CANAL.west)/2.7);
    for(let i=0;i<bankPlantCount;i++) {
      const x=CANAL.west+1+i*2.7;
      if(Math.abs(x-CANAL.bridgeX)>3) {
        if(i%3!==1)ivy.push([x,34.55,0,.6+Math.abs(Math.sin(i*12))*.7,.08]);
        ivy.push([x,48.20,Math.PI,.8,.08]);
        reeds.push([x,48.25,i*2.4,1.05+(i%3)*.18,-.6]);
        for(let row=0;row<3;row++) {
          const px=x+Math.sin(i*13+row)*.55;
          if(Math.abs(px-CANAL.bridgeX)<3.3||(row===1&&i%3===0))continue;
          const scale=(row===1?.9:row===2?1.6:1.25)*(1+.25*Math.sin(i*12+row));
          ferns.push([px,50.3+row*2.1+Math.sin(i*4.7+row)*.65,i*1.71+row,scale,.08]);
        }
        if(i%3===0)rocks.push([x,51.4+Math.sin(i*5)*1.3,i*2.2,1.4+(i%4)*.15,-.22]);
      }
    }
    instances('IvyDrape',ivy);instances('CanalReeds',reeds.filter((_,i)=>!mobile||i%2===0));
    instances('BankFern',ferns.filter((_,i)=>!mobile||i%2===0));instances('BankRocks',rocks);
    instances('NearBank',[[0,52.8,0,1,0]]);
    for(const {x,z} of CANAL_LANTERNS.filter((_,i)=>mobile?i===6:i%4===2)) {
      const light=new T.PointLight(0xffaa55,9,7,2);light.position.set(x,.9,z);root.add(light);
    }
    const bridgeLight=new T.PointLight(0xffaa60,21,11,2);bridgeLight.position.set(CANAL.bridgeX,3.2,35.5);root.add(bridgeLight);
    if(!mobile)for(const x of [-8,CANAL.bridgeX]) {
      const light=new T.PointLight(0xffb266,13,8,2);light.position.set(x,1.4,49);root.add(light);
    }
    water=createCanalWater(normal,reflection,mobile);root.add(water.water);
    const mistMap=roadGlowTexture(),mistGeo=new T.BufferGeometry();
    mistGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(24*3),3));
    const mistMaterial=new T.PointsMaterial({map:mistMap,color:0x829f9f,size:7,transparent:true,opacity:.065,depthWrite:false});
    mist=new T.Points(mistGeo,mistMaterial);mist.frustumCulled=false;mist.renderOrder=3;root.add(mist);
  }).catch(error=>{if(!disposed){console.error('Canal load failed',error);onError('Не удалось загрузить набережную. Перезагрузите страницу.');}});
  return {root,ready,
    update(dt:number,high:boolean,reducedMotion:boolean) {
      if(disposed)return;time+=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
      water?.update(time,high,reducedMotion);
      if(mist) {
        const p=mist.geometry.attributes.position;
        const span=CANAL.east-CANAL.west;
        for(let i=0;i<p.count;i++)p.setXYZ(i,CANAL.west+2+(i*4.7+(reducedMotion?0:time*.04))%span,-.9+Math.sin(i*23)*.12,36+(i*2.17)%10);
        p.needsUpdate=true;
      }
    },
    dispose(){
      if(disposed)return;disposed=true;water?.detach();parent.remove(root);root.add(owned);
      root.traverse(o=>{if(o instanceof T.InstancedMesh||o instanceof T.Light)o.dispose();});
      disposeObjectTree(root);root.clear();
    },
  };
}
