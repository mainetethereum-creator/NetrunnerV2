import * as T from 'three';

/** Edited authored objects have an independent parent so their old chunk can
 * remain culled. Unmodified/reset objects return to that exact authored parent. */
export function createEditorStreaming(scene:T.Scene,authored:Iterable<T.Object3D>,distance=57){
 const root=new T.Group();root.name='Editor streamed objects';scene.add(root);
 const parents=new Map<T.Object3D,T.Object3D|null>();
 for(const object of authored)parents.set(object,object.parent);
 const position=new T.Vector3();
 function setModified(object:T.Object3D,modified:boolean){
  object.userData.editorStreaming=modified;
  const target=modified?root:parents.get(object);
  if(target&&object.parent!==target)target.add(object);
 }
 return {root,setModified,update(focus:{x:number;z:number}){
  for(const object of root.children){
   object.getWorldPosition(position);
   object.visible=!object.userData.editorDeleted&&Math.hypot(position.x-focus.x,position.z-focus.z)<distance;
  }
 },dispose(){
  for(const object of parents.keys())setModified(object,false);
  root.removeFromParent();parents.clear();
 }};
}
