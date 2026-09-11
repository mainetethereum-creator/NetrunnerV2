import * as T from 'three';
import {createPropLibrary} from './prop-assets';
import {AUTHORED_PROPS} from './authored-layout';
import {animateCityProps} from './city-props';
import {RULES,type Point} from './config';

/** Static level dressing built from the same catalogue as MASTER. Prototypes,
 * geometries and materials are shared; only transforms are duplicated. */
export function createAuthoredDistrict(scene:T.Scene,height:(p:Point)=>number,anisotropy:number,ready?:()=>void){
  const library=createPropLibrary(anisotropy,ready),chunks=new Map<string,T.Group>();
  const sources:{p:T.Vector3;color:T.Color;power:number;flicker:boolean}[]=[];
  const chunk=(p:Point)=>{const key=`${Math.floor(p.x/RULES.chunkSize)},${Math.floor(p.z/RULES.chunkSize)}`;let root=chunks.get(key);if(!root){root=new T.Group();root.name=`Authored district ${key}`;root.visible=false;chunks.set(key,root);scene.add(root);}return root;};
  for(const p of AUTHORED_PROPS){
    const model=library.create(p.asset,p.length);model.position.set(p.x,height(p),p.z);model.rotation.y=p.rotation*Math.PI/180;model.userData.authoredAsset=p.asset;chunk(p).add(model);
    if(p.asset==='campfire')sources.push({p:new T.Vector3(p.x,height(p)+1.15,p.z),color:new T.Color('#ff9f55'),power:28,flicker:true});
  }
  return {sources,update(time:number){chunks.forEach(group=>{if(group.visible)animateCityProps(group,time);});},stream(p:Point){const x=Math.floor(p.x/RULES.chunkSize),z=Math.floor(p.z/RULES.chunkSize);chunks.forEach((group,key)=>{const [cx,cz]=key.split(',').map(Number);group.visible=Math.abs(cx-x)<=RULES.activeRadius&&Math.abs(cz-z)<=RULES.activeRadius;});},dispose(){library.dispose();}};
}
