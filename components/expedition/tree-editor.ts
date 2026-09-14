import * as T from 'three';
import {createWorldEditor,type EditorState,type WorldEditor} from '../world-editor/controller';
import type {Entry} from '../world-editor/document';
import {loadRuntimeTrees} from '../vegetation/baked-runtime';
import {TREE_EDITOR_STORAGE_KEY,treesFromEntries,TREE_VARIANTS} from '../vegetation/tree-editor-state';
import type {VegetationTree} from '../vegetation/layout';
import type {Point,Rect} from './config';

export const TREE_ASSETS=TREE_VARIANTS.map((id,index)=>({id,name:`Baked tree ${index+1}`}));

export async function prepareTreeEditor(scene:T.Scene,onChange:(state:EditorState)=>void,defaults:VegetationTree[],height:(p:Point)=>number,canStand:(p:Point,r?:number)=>boolean,onTrees:(trees:VegetationTree[])=>void,onColliders:(rects:Rect[])=>void,onPan:(x:number,z:number)=>void,onFocus:(x:number,z:number)=>void):Promise<()=>WorldEditor>{
 const abort=new AbortController(),geometries=await loadRuntimeTrees(abort.signal);
 const material=new T.MeshStandardMaterial({color:'#929381',vertexColors:true,roughness:.9,side:T.DoubleSide});
 const make=(variant:number)=>{const mesh=new T.Mesh(geometries[variant],material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.treeVariant=variant;return mesh;};
 const authored=defaults.map((tree,index)=>{const object=make(tree.variant);object.position.set(tree.x,tree.y??height(tree),tree.z);object.rotation.y=tree.rotation??(index*2.399+tree.x*.17)%6.28;object.scale.set(tree.sx??tree.scale,tree.sy??tree.scale,tree.sz??tree.scale);scene.add(object);return {id:`tree:${index}`,name:`Tree ${String(index+1).padStart(2,'0')} · variant ${tree.variant+1}`,object,collision:{w:.72,d:.72,h:6}};});
 const extras=TREE_ASSETS.map((item,index)=>({...item,create:()=>make(index),collision:{w:.72,d:.72,h:6}}));
 return ()=>{
  let authoredColliders:Rect[]=[],addedColliders:Rect[]=[];
  const syncColliders=()=>onColliders([...authoredColliders,...addedColliders]);
  const editor=createWorldEditor(scene,onChange,{map:'expedition',anisotropy:1,height,authored,additionalAssets:extras,includePropAssets:false,storageKey:TREE_EDITOR_STORAGE_KEY,editorOnly:true,canPlace:p=>(p.z<27.5||p.z>45)&&canStand(p,1),onResolved:(entries:Entry[])=>onTrees(treesFromEntries(defaults,entries)),onAuthoredColliders:r=>{authoredColliders=r;syncColliders();},onColliders:r=>{addedColliders=r;syncColliders();},onPan,onFocus});
  const dispose=editor.dispose.bind(editor);
  return Object.assign(editor,{dispose(){dispose();onColliders([]);authored.forEach(a=>a.object.removeFromParent());geometries.forEach(g=>g.dispose());material.dispose();abort.abort();}});
 };
}
