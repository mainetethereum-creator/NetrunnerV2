import * as T from 'three';
import {createEditorStreaming} from './streaming';
import {createPropLibrary,PROP_ASSETS,type PropId,type PropInstance} from '../expedition/prop-assets';
import {referenceHasCollision} from '../../src/assets/reference-buildings.ts';
import {fenceLength,isFence,snapFence,fenceColliders} from '../expedition/fence-layout';
import {createHistory,emptyDocument,parseDocument,type Entry,type MapId,type Transform,type WorldDocument} from './document';
import {createThrottledScheduler} from '../expedition/frame-throttle';
export type AuthoredObject={id:string;name:string;object:T.Object3D;asset?:PropId;length?:number;collision?:{w:number;d:number;h:number};onTransform?:(entry:Entry)=>void};
export type AdditionalEditorAsset={id:string;name:string;create:()=>T.Object3D;collision?:{w:number;d:number;h:number}|false};
export type EditorSnapshot={selected:string|null;objects:{id:string;name:string}[];assets?:{id:string;name:string}[];transform:Entry|null;mode:'translate'|'rotate'|'scale';axis:'x'|'y'|'z';canUndo:boolean;canRedo:boolean;loading:boolean;canSave:boolean;notice:string};
export type EditorState={instances:PropInstance[];selected:string|null;placing:boolean;notice:string;snapshot?:EditorSnapshot};
type Rect={x:number;z:number;w:number;d:number};
const capture=(o:T.Object3D):Transform=>({x:o.position.x,y:o.position.y,z:o.position.z,rx:o.rotation.x*180/Math.PI,rotation:o.rotation.y*180/Math.PI,rz:o.rotation.z*180/Math.PI,sx:o.scale.x,sy:o.scale.y,sz:o.scale.z});
const sameEntry=(a:Entry|undefined,b:Entry)=>!!a&&a.source===b.source&&a.length===b.length&&!!a.deleted===!!b.deleted
 &&a.x===b.x&&a.y===b.y&&a.z===b.z&&a.rx===b.rx&&a.rotation===b.rotation&&a.rz===b.rz&&a.sx===b.sx&&a.sy===b.sy&&a.sz===b.sz;
export function createWorldEditor(scene:T.Scene,onChange:(state:EditorState)=>void,options:{map:MapId;anisotropy:number;height:(p:{x:number;z:number})=>number;authored?:AuthoredObject[];additionalAssets?:AdditionalEditorAsset[];includePropAssets?:boolean;storageKey?:string;editorOnly?:boolean;canPlace?:(p:{x:number;z:number})=>boolean;onResolved?:(entries:Entry[])=>void;onPads?:(pads:Rect[])=>void;onColliders?:(pads:Rect[])=>void;onAuthoredColliders?:(pads:Rect[])=>void;onPan?:(x:number,z:number)=>void;onFocus?:(x:number,z:number)=>void}){
 const {map,height}=options,key=options.storageKey??`cyberbase.world-editor.${map}.v1`,library=createPropLibrary(options.anisotropy),streaming=createEditorStreaming(scene,(options.authored??[]).map(a=>a.object)),root=streaming.root;
 const additional=new Map((options.additionalAssets??[]).map(a=>[a.id,a]));
 const authored=new Map((options.authored??[]).map(a=>[a.id,a])),originals=new Map<string,Entry>(),objects=new Map<string,T.Object3D>();
 for(const a of authored.values()){originals.set(a.id,{id:a.id,source:a.id,...capture(a.object),...(a.length===undefined?{}:{length:a.length})});objects.set(a.id,a.object);a.object.matrixAutoUpdate=true;a.object.userData.editorManaged=true;}
 const sources=new Set([...authored.keys(),...(options.includePropAssets===false?[]:PROP_ASSETS.map(a=>a.id)),...additional.keys()]),history=createHistory(emptyDocument(map));
 let disposed=false,preparation=0;
 let documentRequest=0,documentPending=false,documentFailed=false;
 let settleDocument:(()=>void)|undefined;
 let selected:string|null=null,active=false,placing=false,asset:string=additional.keys().next().value??'barricade',rotation=0,length=3,mode:EditorSnapshot['mode']='translate',axis:EditorSnapshot['axis']='x',notice='Выберите объект кликом или из списка',ghost:T.Object3D|null=null;
 const outline=new T.BoxHelper(new T.Object3D(),0xf3cc79);outline.visible=false;scene.add(outline);
 let document=history.current;
 let documentEntries=new Map(document.entries.map(e=>[e.id,e]));
 const applied=new Map<string,Entry>(),footprints=new Map<string,{ground:number;rects:Rect[]}>();
 const propNames=new Map(PROP_ASSETS.map(a=>[a.id as string,a.name]));
 const catalogue=[...(options.includePropAssets===false?[]:PROP_ASSETS.map(({id,name})=>({id,name}))),...(options.additionalAssets??[]).map(({id,name})=>({id,name}))];
 let outlineDirty=true,firstApply=true;
 const listeners=new Set<()=>void>();let snapshot:EditorSnapshot;
 const entry=(id:string)=>documentEntries.get(id)??originals.get(id);
 function emit(){snapshot={selected,assets:catalogue,objects:[...objects].filter(([id])=>!entry(id)?.deleted).map(([id])=>({id,name:authored.get(id)?.name??authored.get(entry(id)?.source??'')?.name??additional.get(entry(id)?.source??'')?.name??propNames.get(entry(id)?.source??'')??id})),transform:selected?entry(selected)??null:null,mode,axis,canUndo:history.canUndo,canRedo:history.canRedo,loading:documentPending,canSave:!disposed&&!documentPending&&!documentFailed,notice};onChange({instances:[...objects.keys()].flatMap(id=>{const e=entry(id),asset=e?(authored.get(e.source)?.asset??(propNames.has(e.source)?e.source as PropId:undefined)):undefined;return e&&!e.deleted&&asset?[{id:e.id,asset,x:e.x,z:e.z,rotation:e.rotation,length:e.length}]:[];}),selected,placing,notice,snapshot});listeners.forEach(fn=>fn());}
 function createSource(source:string,length?:number){return additional.get(source)?.create()??authored.get(source)?.object.clone(true)??library.create(source as PropId,length);}
 function disposeInstances(object:T.Object3D){object.traverse(child=>{if(child instanceof T.InstancedMesh)child.dispose();});}
 function clearGhost(){preparation++;if(!ghost)return;ghost.removeFromParent();disposeInstances(ghost);ghost.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});ghost=null;}
 function applyTransform(o:T.Object3D,e:Entry){o.position.set(e.x,e.y,e.z);o.rotation.set(e.rx*Math.PI/180,e.rotation*Math.PI/180,e.rz*Math.PI/180);o.scale.set(e.sx,e.sy,e.sz);o.visible=!e.deleted&&(!options.editorOnly||active);o.userData.editorDeleted=!!e.deleted;o.matrixAutoUpdate=true;o.updateMatrix();o.updateMatrixWorld(true);}
 function updateOutline(){
  const obj=selected?objects.get(selected):undefined;
  outline.visible=active&&!!obj&&!entry(selected!)?.deleted;
  if(outline.visible&&outlineDirty){outline.setFromObject(obj!);outlineDirty=false;}
 }
 function objectFootprints(id:string,obj:T.Object3D,e:Entry,ground:number):Rect[]{
  if(!referenceHasCollision(e.source))return [];
  const authoredItem=authored.get(id);
  if(authoredItem&&!authoredItem.collision)return [];
  const c=authoredItem?.collision??additional.get(e.source)?.collision;
  if(c===false)return [];
  const boxes:T.Box3[]=[];
  if(!authoredItem&&propNames.has(e.source)&&isFence(e.source as PropId)){
   for(const r of fenceColliders({asset:e.source as PropId,x:0,z:0,rotation:0,length:e.length})){
    boxes.push(new T.Box3(new T.Vector3(r.x-r.w/2,0,r.z-r.d/2),new T.Vector3(r.x+r.w/2,2.8,r.z+r.d/2)).applyMatrix4(obj.matrixWorld));
   }
  }else{
   boxes.push(c?new T.Box3(new T.Vector3(-c.w/2,0,-c.d/2),new T.Vector3(c.w/2,c.h,c.d/2)).applyMatrix4(obj.matrixWorld):new T.Box3().setFromObject(obj));
  }
  return boxes.filter(b=>!b.isEmpty()&&b.max.y>=ground&&b.min.y<=ground+1.8).map(b=>({x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,w:b.max.x-b.min.x,d:b.max.z-b.min.z}));
 }
 // Cache unchanged footprints. Only publishing the final changed list is throttled:
 // Expedition uses it to rebuild terrain/grass, Base uses it for navigation.
 function refresh(){
  const dynamic:Rect[]=[],authoredPads:Rect[]=[];
  for(const [id,obj] of objects){
   const e=entry(id);if(!e||e.deleted)continue;
   const ground=height(obj.position);let cached=footprints.get(id);
   if(!cached||cached.ground!==ground){cached={ground,rects:objectFootprints(id,obj,e,ground)};footprints.set(id,cached);}
   (authored.has(id)?authoredPads:dynamic).push(...cached.rects);
  }
 // Selecting, cancelling or arming a placement leaves every footprint where it
 // was. Republishing identical pads would still rebuild terrain, grass and the
 // navigation caches, so only publish when a footprint actually changed.
 const dynamicKey=rectKey(dynamic),authoredKey=rectKey(authoredPads);
 if(dynamicKey!==publishedDynamic){publishedDynamic=dynamicKey;options.onPads?.(dynamic);options.onColliders?.(dynamic);}
 if(authoredKey!==publishedAuthored){publishedAuthored=authoredKey;options.onAuthoredColliders?.(authoredPads);}
 updateOutline();}
 let publishedDynamic:string|null=null,publishedAuthored:string|null=null;
 const rectKey=(rects:Rect[])=>rects.map(r=>`${r.x.toFixed(3)},${r.z.toFixed(3)},${r.w.toFixed(3)},${r.d.toFixed(3)}`).join('|');
 const refreshScheduler=createThrottledScheduler(refresh,90);
 function applyEntry(id:string,obj:T.Object3D,e:Entry){
  if(sameEntry(applied.get(id),e))return false;
  applyTransform(obj,e);applied.set(id,e);footprints.delete(id);
  if(id===selected)outlineDirty=true;
  return true;
 }
 function apply(){
  document=history.current;documentEntries=new Map(document.entries.map(e=>[e.id,e]));
  let changed=firstApply;firstApply=false;
  for(const [id,obj] of objects)if(!authored.has(id)){
   const next=entry(id),previous=applied.get(id);
   if(!next||next.deleted||previous?.length!==next.length||previous?.source!==next.source){
    obj.removeFromParent();disposeInstances(obj);objects.delete(id);applied.delete(id);footprints.delete(id);changed=true;
   }
  }
  for(const [id,a] of authored){
   const e=entry(id)!,modified=documentEntries.has(id);
   if(a.object.userData.editorModified!==modified){a.object.userData.editorModified=modified;streaming.setModified(a.object,modified);}
   if(applyEntry(id,a.object,e)){a.onTransform?.(e);changed=true;}
   if(options.editorOnly)a.object.visible=active&&!e.deleted;
  }
  for(const e of document.entries){
   if(authored.has(e.id)||e.deleted)continue;
   let obj=objects.get(e.id);
   if(!obj){obj=createSource(e.source,e.length);obj.userData.editorLength=e.length;root.add(obj);objects.set(e.id,obj);}
   if(applyEntry(e.id,obj,e))changed=true;
   if(options.editorOnly)obj.visible=active;
  }
  if(selected&&!objects.has(selected)){selected=null;outlineDirty=true;}
  updateOutline();
  if(changed){refreshScheduler.schedule();options.onResolved?.([...objects.keys()].map(id=>entry(id)).filter((e):e is Entry=>!!e));}
  emit();
 }
 // Selection and ghost cancellation are independent of document restoration.
 // Only a newer document request or an actual edit can supersede a saved map.
 function supersedeDocument(){documentRequest++;documentPending=false;documentFailed=false;settleDocument?.();settleDocument=undefined;}
 function commit(entries:Entry[]){preparation++;try{const valid=parseDocument(JSON.stringify({version:1,map,entries}),map,sources);supersedeDocument();history.commit(valid);apply();}catch(error){notice=error instanceof Error?error.message:'Некорректная правка';emit();}}
 function change(patch:Partial<Transform>&{length?:number}){if(!selected)return;const current=entry(selected);if(!current)return;commit([...history.current.entries.filter(e=>e.id!==selected),{...current,...patch}]);}
 function select(id:string|null){clearGhost();placing=false;selected=id&&objects.has(id)?id:null;outlineDirty=true;refresh();emit();}
 function cancel(){clearGhost();placing=false;selected=null;notice='Выбор сброшен';refresh();emit();}
 // GLB preparation finishes before ghosts, clones and collider bounds are created.
 // This generation belongs only to placement; closing MASTER cannot cancel a map load.
 function prepareSources(ids:string[],ready:()=>void){
  const token=++preparation;
  const missing=[...new Set(ids)].filter(id=>PROP_ASSETS.some(a=>a.id===id)&&!library.isReady(id as PropId));
  if(!missing.length){ready();return;}
  notice='Загружаем 3D-модель…';emit();
  Promise.all(missing.map(id=>library.prepare(id as PropId))).then(()=>{
   if(!disposed&&token===preparation)ready();
  }).catch(()=>{if(!disposed&&token===preparation){notice='Не удалось загрузить модель. Повторите попытку.';emit();}});
 }
 function restoreDocument(read:()=>WorldDocument|null,successNotice:string):Promise<void>{
  clearGhost();placing=false;supersedeDocument();
  const request=documentRequest;
  documentPending=true;
  const result=new Promise<void>((resolve,reject)=>{
   settleDocument=resolve;
   const current=()=>!disposed&&request===documentRequest;
   const fail=(error:unknown)=>{
    if(!current())return;
    documentPending=false;documentFailed=true;settleDocument=undefined;
    const failure=error instanceof Error?error:new Error('Не удалось загрузить карту');
    notice=failure.message;emit();reject(failure);
   };
   try{
    const next=read();
    const finish=()=>{
     if(!current())return;
     try{
      documentPending=false;documentFailed=false;settleDocument=undefined;
      clearGhost();placing=false;
      if(next){history.commit(next);selected=null;notice=successNotice;apply();}
      else{notice='Сохранения ещё нет';emit();}
      resolve();
     }catch(error){fail(error);}
    };
    const missing=[...new Set(next?.entries.filter(e=>!e.deleted).map(e=>e.source)??[])]
     .filter(id=>PROP_ASSETS.some(a=>a.id===id)&&!library.isReady(id as PropId));
    if(!missing.length){finish();return;}
    notice='Загружаем сохранённую карту…';emit();
    Promise.all(missing.map(id=>library.prepare(id as PropId))).then(finish,fail);
   }catch(error){fail(error);}
  });
  // UI callbacks may ignore the promise; scene bootstrap can still await/reject it.
  void result.catch(()=>{});
  return result;
 }
 function ghostMaterial(source:T.Material){const material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;material.transparent=true;material.opacity=.5;return material;}
 function arm(){clearGhost();selected=null;placing=false;prepareSources([asset],()=>{if(!active)return;placing=true;notice='Кликните по карте, чтобы разместить объект';ghost=createSource(asset,length);ghost.traverse(o=>{if(o instanceof T.Mesh)o.material=Array.isArray(o.material)?o.material.map(ghostMaterial):ghostMaterial(o.material);});ghost.visible=false;scene.add(ghost);refresh();emit();});}
 function remove(){if(!selected)return;const current=entry(selected);if(!current)return;const entries=history.current.entries.filter(e=>e.id!==selected);if(authored.has(selected))entries.push({...current,deleted:true});selected=null;commit(entries);}
 function duplicate(){if(!selected)return;const current=entry(selected);if(!current)return;const next={...current,id:`copy:${crypto.randomUUID()}`,x:current.x+1,z:current.z+1};selected=next.id;commit([...history.current.entries,next]);}
 function nudge(direction:number){const e=selected?entry(selected):null;if(!e)return;const field=mode==='translate'?axis:mode==='rotate'?({x:'rx',y:'rotation',z:'rz'} as const)[axis]:({x:'sx',y:'sy',z:'sz'} as const)[axis];change({[field]:Number((e[field]+direction*(mode==='rotate'?15:mode==='scale'?.1:.25)).toFixed(4))});}
 function load():Promise<void>{return restoreDocument(()=>{let saved=localStorage.getItem(key);if(!saved&&map==='expedition'){const old=JSON.parse(localStorage.getItem('netrunner.master.props.v2')??'[]') as PropInstance[];if(Array.isArray(old)&&old.length){saved=JSON.stringify({version:1,map,entries:old.slice(0,200).map(e=>({id:e.id,source:e.asset,x:e.x,y:height(e),z:e.z,rx:0,rotation:e.rotation,rz:0,sx:1,sy:1,sz:1,...(e.length===undefined?{}:{length:e.length})}))});}}return saved?parseDocument(saved,map,sources):null;},'Загружено');}
 const api={ready:Promise.resolve(),get active(){return active;},get placing(){return placing;},getSnapshot:()=>snapshot,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},setActive(value:boolean){if(active===value)return;active=value;if(!value)cancel();apply();},setAsset(id:string){if(!sources.has(id))return;preparation++;asset=id;if(placing)arm();},setLength(value:number){length=fenceLength(value);if(selected&&!authored.has(selected))change({length});else if(placing)arm();},setRotation(value:number){rotation=value;if(selected)change({rotation:value});if(ghost)ghost.rotation.y=value*Math.PI/180;},pan(x:number,z:number){options.onPan?.(x,z);},focus(){const e=selected?entry(selected):null;if(e)options.onFocus?.(e.x,e.z);},setMode(value:EditorSnapshot['mode']){mode=value;emit();},setAxis(value:EditorSnapshot['axis']){axis=value;emit();},change,nudge,arm,select,cancel,remove,duplicate,undo(){clearGhost();placing=false;if(history.canUndo)supersedeDocument();history.undo();apply();},redo(){clearGhost();placing=false;if(history.canRedo)supersedeDocument();history.redo();apply();},reset(){clearGhost();placing=false;supersedeDocument();history.commit(emptyDocument(map));selected=null;notice='Исходная карта восстановлена; можно отменить';apply();},save(){if(documentPending||documentFailed){notice=documentPending?'Дождитесь загрузки карты перед сохранением':'Карта не загрузилась. Повторите «Загрузить» перед сохранением';emit();return;}try{localStorage.setItem(key,JSON.stringify(history.current));notice='Сохранено в этом браузере';}catch{notice='Хранилище браузера недоступно';}emit();},load,exportJSON:()=>JSON.stringify(history.current,null,2),importJSON(text:string){return restoreDocument(()=>parseDocument(text,map,sources),'JSON импортирован; нажмите «Сохранить»');},hover(point:T.Vector3){if(ghost){ghost.position.set(point.x,height(point),point.z);ghost.rotation.y=rotation*Math.PI/180;ghost.visible=true;}},click(ray:T.Raycaster,point:T.Vector3){if(placing){if(options.canPlace&&!options.canPlace(point)){notice='Нельзя посадить дерево на дороге, объекте или за границей карты';emit();return;}if(PROP_ASSETS.some(a=>a.id===asset)&&isFence(asset as PropId)){const p=snapFence(point,rotation,length,document.entries.filter(e=>!e.deleted&&PROP_ASSETS.some(a=>a.id===e.source)).map(e=>({id:e.id,asset:e.source as PropId,x:e.x,z:e.z,rotation:e.rotation,length:e.length})));point=new T.Vector3(p.x,point.y,p.z);}const next:Entry={id:`prop:${crypto.randomUUID()}`,source:asset,x:point.x,y:height(point),z:point.z,rx:0,rotation,rz:0,sx:1,sy:1,sz:1,...(PROP_ASSETS.some(a=>a.id===asset)&&isFence(asset as PropId)?{length}:{})};commit([...history.current.entries,next]);return;}const hits=ray.intersectObjects([...objects.values()].filter(o=>{let node:T.Object3D|null=o;while(node){if(!node.visible)return false;node=node.parent;}return !o.userData.editorDeleted;}),true);let node:T.Object3D|null=hits[0]?.object??null;while(node){const found=[...objects].find(([,o])=>o===node);if(found){select(found[0]);return;}node=node.parent;}select(null);notice='LOCKED · поверхность, инстансы, оболочка или игровой объект';emit();},keyDown(e:KeyboardEvent){if(!active||e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable=true]'))return false;const k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&k==='z'){if(e.shiftKey)api.redo();else api.undo();}else if((e.ctrlKey||e.metaKey)&&k==='y')api.redo();else if((e.ctrlKey||e.metaKey)&&k==='d')duplicate();else if(k==='escape')cancel();else if(k==='delete'||k==='backspace')remove();else if(['g','r','s'].includes(k))api.setMode(k==='g'?'translate':k==='r'?'rotate':'scale');else if(['x','y','z'].includes(k))api.setAxis(k as EditorSnapshot['axis']);else if(k==='arrowup'||k==='arrowright')nudge(1);else if(k==='arrowdown'||k==='arrowleft')nudge(-1);else return false;e.preventDefault();return true;},stream(focus:{x:number;z:number}){if(options.editorOnly&&!active){root.visible=false;outline.visible=false;return;}root.visible=true;streaming.update(focus);},dispose(){disposed=true;supersedeDocument();preparation++;refreshScheduler.cancel();clearGhost();options.onColliders?.([]);for(const [id,object] of objects)if(!authored.has(id))disposeInstances(object);streaming.dispose();scene.remove(outline);outline.geometry.dispose();(outline.material as T.Material).dispose();library.dispose();listeners.clear();}};
 emit();api.ready=load();apply();return api;
}
export type WorldEditor=ReturnType<typeof createWorldEditor>;
