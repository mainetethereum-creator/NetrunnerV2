import * as T from 'three';
import {createPropLibrary} from './prop-assets';
import {AUTHORED_PROPS} from './authored-layout';
import {animateCityProps} from './city-props';
import {RULES,type Point} from './config';
import type {BuildingLightSource} from './cyber-buildings';
import {createDistanceDetail} from './distance-detail';

/** Static level dressing built from the same catalogue as MASTER. Prototypes,
 * geometries and materials are shared; only transforms are duplicated. */
export function createAuthoredDistrict(scene:T.Scene,height:(p:Point)=>number,anisotropy:number,ready?:()=>void){
  const library=createPropLibrary(anisotropy,ready),chunks=new Map<string,T.Group>();
  const detail=createDistanceDetail(),animated:T.Object3D[]=[];
  const sources:{p:T.Vector3;color:T.Color;power:number;flicker:boolean}[]=[];
  const chunk=(p:Point)=>{const key=`${Math.floor(p.x/RULES.chunkSize)},${Math.floor(p.z/RULES.chunkSize)}`;let root=chunks.get(key);if(!root){root=new T.Group();root.matrixAutoUpdate=false;root.name=`Authored district ${key}`;root.visible=false;chunks.set(key,root);scene.add(root);}return root;};
  for(const p of AUTHORED_PROPS){
    const model=library.create(p.asset,p.length);model.position.set(p.x,height(p),p.z);model.rotation.y=p.rotation*Math.PI/180;model.userData.authoredAsset=p.asset;chunk(p).add(model);
    for(const light of (model.userData.lightSources??[]) as BuildingLightSource[]){const position=new T.Vector3(light.x,light.y,light.z).applyAxisAngle(new T.Vector3(0,1,0),model.rotation.y).add(model.position);sources.push({p:position,color:new T.Color(light.color),power:light.power,flicker:false});}
    if(p.asset==='campfire')sources.push({p:new T.Vector3(p.x,height(p)+1.15,p.z),color:new T.Color('#ff9f55'),power:28,flicker:true});
    detail.add(model);model.traverse(o=>{if(o.userData.fireLayer)animated.push(o);else{o.updateMatrix();o.matrixAutoUpdate=false;}});
  }
  return {sources,get detailCulled(){return detail.culled;},update(time:number){for(const flame of animated)if(flame.parent?.visible&&flame.parent.parent?.visible)animateCityProps(flame,time);},stream(p:Point,camera?:T.Camera){const x=Math.floor(p.x/RULES.chunkSize),z=Math.floor(p.z/RULES.chunkSize);chunks.forEach((group,key)=>{const [cx,cz]=key.split(',').map(Number);group.visible=Math.abs(cx-x)<=RULES.activeRadius&&Math.abs(cz-z)<=RULES.activeRadius;});detail.update(p,camera);},dispose(){detail.dispose();library.dispose();}};
}
