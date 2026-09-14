import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const EDITABLE_NPC_BATCH='editableNpcBatch';

/** Static scene baking must leave this root and all of its already-batched
 * descendants intact so MASTER can move it without rebuilding geometry. */
export function isEditableNpcBatch(object:T.Object3D){
 for(let node:T.Object3D|null=object;node;node=node.parent)if(node.userData[EDITABLE_NPC_BATCH])return true;
 return false;
}

/** Service NPCs retain one movable root, but submit one draw per material
 * instead of one per body part. Geometry stays in the root's local space. */
export function createRefugeNpc(accent:T.Material,coat:T.Material,palette:{edge:T.Material;brass:T.Material;dark:T.Material}){
 const group=new T.Group(),parts=new Map<T.Material,T.BufferGeometry[]>();group.userData[EDITABLE_NPC_BATCH]=true;
 function part(w:number,h:number,d:number,x:number,y:number,z:number,material:T.Material,tilt=0){
  const geometry=new T.BoxGeometry(w,h,d);
  geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),tilt),new T.Vector3(1,1,1)));
  const geometries=parts.get(material)??[];geometries.push(geometry);parts.set(material,geometries);
 }
 part(.48,.67,.3,0,.96,0,coat);
 part(.6,.3,.36,0,.6,0,coat);
 part(.29,.32,.29,0,1.46,0,palette.edge);
 part(.27,.065,.035,0,1.49,.16,accent);
 part(.29,.4,.18,0,1,-.23,palette.brass);
 for(const side of [-1,1]){
  part(.18,.5,.2,side*.16,.29,0,palette.dark);
  part(.2,.15,.34,side*.16,.09,.07,palette.edge);
  part(.15,.56,.2,side*.34,.95,.05,coat,side*.12);
  part(.17,.14,.2,side*.36,.62,.05,palette.brass);
 }
 for(const [material,geometries] of parts){
  const geometry=mergeGeometries(geometries,false);
  if(!geometry)throw new Error('Service NPC geometry could not be batched');
  geometries.forEach(part=>part.dispose());
  const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 return group;
}
