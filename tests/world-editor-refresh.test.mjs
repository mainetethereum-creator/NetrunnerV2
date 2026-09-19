import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// controller.ts imports siblings without extensions, as the Next bundler allows.
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('.')&&context.parentURL&&!/\.[a-z]+$/i.test(specifier))for(const extension of ['.ts','.tsx']){const url=new URL(specifier+extension,context.parentURL);if(existsSync(url))return next(url.href,context);}
 return next(specifier,context);
}});
// The prop library draws sign canvases and requests atlases; neither needs a GPU here.
const canvasContext=new Proxy({measureText:()=>({width:100}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>target[key]??(()=>{})});
globalThis.document??={createElement:()=>({width:512,height:512,getContext:()=>canvasContext})};
T.TextureLoader.prototype.load=function(){return new T.Texture();};
const frames=[];
globalThis.requestAnimationFrame=callback=>frames.push(callback);
globalThis.cancelAnimationFrame=handle=>{frames[handle-1]=null;};
let clock=0;
const drain=()=>{for(let i=0;i<20&&frames.some(Boolean);i++){clock+=100;const pending=frames.splice(0);for(const callback of pending)callback?.(clock);}};
const {createWorldEditor}=await import('../components/world-editor/controller.ts');
const {createBaseMapEditor}=await import('../components/base/base-map-editor.ts');
const {createPropLibrary}=await import('../components/expedition/prop-assets.ts');

test('burning drums reuse city fire geometry and dispose every shared buffer once',()=>{
 const library=createPropLibrary(1),a=library.create('burning-drum'),b=library.create('burning-drum');
 assert.ok(a.getObjectByProperty('isPointLight',true));
 const geometries=new Map();
 a.traverse(o=>{if(o.isMesh&&!geometries.has(o.geometry)){
  const record={disposed:0};geometries.set(o.geometry,record);
  o.geometry.addEventListener('dispose',()=>record.disposed++);
 }});
 const second=new Set();b.traverse(o=>{if(o.isMesh)second.add(o.geometry);});
 assert.deepEqual(second,new Set(geometries.keys()));
 a.position.x=10;assert.equal(b.position.x,0);
 library.dispose();
 for(const record of geometries.values())assert.equal(record.disposed,1);
});

test('imported outskirts ground stays non-solid after move, scale and undo',async()=>{
 const originalLoad=GLTFLoader.prototype.loadAsync,originalStorage=globalThis.localStorage;
 GLTFLoader.prototype.loadAsync=async()=>({scene:new T.Group().add(new T.Mesh(new T.BoxGeometry(64,.5,26),new T.MeshStandardMaterial()))});
 globalThis.localStorage={getItem:()=>null,setItem(){}};
 let colliders=[];
 const editor=createWorldEditor(new T.Scene(),()=>{},{map:'base',anisotropy:1,height:()=>0,onColliders:r=>colliders=r});
 try{
  await editor.importJSON(JSON.stringify({version:1,map:'base',entries:[{id:'prop:ground',source:'outskirts-ground',x:0,y:0,z:0,rx:0,rotation:0,rz:0,sx:1,sy:1,sz:1}]}));
  drain();assert.deepEqual(colliders,[]);
  editor.select('prop:ground');editor.change({x:10,sx:2});drain();assert.deepEqual(colliders,[]);
  editor.undo();drain();assert.deepEqual(colliders,[]);
 }finally{
  editor.dispose();GLTFLoader.prototype.loadAsync=originalLoad;
  if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;
 }
});

test('selecting and cancelling never republish unchanged pads; a real move publishes once',()=>{
 const scene=new T.Scene(),object=new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial());
 object.position.set(5,0,5);scene.add(object);
 const calls={pads:0,colliders:0,authored:0};
 const editor=createWorldEditor(scene,()=>{},{map:'expedition',anisotropy:1,height:()=>0,
  authored:[{id:'authored:0',name:'box',object,collision:{w:2,d:2,h:2}}],
  onPads:()=>calls.pads++,onColliders:()=>calls.colliders++,onAuthoredColliders:()=>calls.authored++});
 drain();
 const settled={...calls};
 assert.equal(settled.authored,1,'the first refresh publishes the authored footprint');
 editor.setActive(true);drain();
 editor.select('authored:0');editor.cancel();editor.select('authored:0');drain();
 assert.deepEqual(calls,settled,'selection must not rebuild terrain, grass or navigation');
 editor.change({x:9});drain();
 assert.equal(calls.authored,settled.authored+1);
 editor.undo();drain();
 assert.equal(calls.authored,settled.authored+2);
 editor.dispose();object.geometry.dispose();object.material.dispose();
});

test('Base catalogue can place deleted scenery, undo it and restore a saved document', () => {
 const saved=new Map();globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
 function fixture(){
  const scene=new T.Scene(),mesh=new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial());
  mesh.position.set(-5.4,1.08,.2);scene.add(mesh);
  const result=createBaseMapEditor({scene,sources:[mesh],rendered:[mesh],labels:new Map([[mesh,{id:'base:planter-west',name:'Клумба · запад'}]]),instanceLabels:new Map(),npcs:[],onEditor(){},onColliders(){},onPan(){},onFocus(){},onFloorVisibility(){}});
  return {...result,scene,mesh};
 }
 const first=fixture();
 try{
  first.editor.setActive(true);drain();
  assert.ok(first.editor.getSnapshot().assets.some(a=>a.id==='base:planter-west'));
  for(const id of ['building-reference-armory','building-reference-restaurant','building-reference-administration']){
   assert.ok(first.editor.getSnapshot().assets.some(a=>a.id===id),`${id} is available alongside authored Base scenery`);
  }
  first.editor.select('base:planter-west');first.editor.remove();drain();
  assert.equal(first.editor.getSnapshot().objects.some(a=>a.id==='base:planter-west'),false);
  first.editor.setAsset('base:planter-west');first.editor.arm();
  first.editor.click(new T.Raycaster(),new T.Vector3(5,.08,5));drain();
  assert.equal(first.editor.getSnapshot().objects.length,1);
  first.editor.undo();drain();assert.equal(first.editor.getSnapshot().objects.length,0);
  first.editor.redo();drain();assert.equal(first.editor.getSnapshot().objects.length,1);
  first.editor.save();
  const json=first.editor.exportJSON();
  first.editor.setActive(false);first.editor.stream({x:5,z:5});
  assert.equal(first.render.authored[0].object.visible,false);
  const second=fixture();
  try{second.editor.setActive(true);drain();assert.equal(second.editor.exportJSON(),json);assert.equal(second.editor.getSnapshot().objects.length,1);}
  finally{second.editor.dispose();second.render.dispose();second.mesh.geometry.dispose();second.mesh.material.dispose();}
 }finally{first.editor.dispose();first.render.dispose();first.mesh.geometry.dispose();first.mesh.material.dispose();delete globalThis.localStorage;}
});

test('async catalogue placement cancels safely, then supports clones, transforms and undo with real bounds',async()=>{
 const original=GLTFLoader.prototype.loadAsync;let resolve;
 GLTFLoader.prototype.loadAsync=()=>new Promise(r=>resolve=r);
 const scene=new T.Scene(),model=new T.Group();
 model.add(new T.Mesh(new T.BoxGeometry(2,3,4).translate(0,1.5,0),new T.MeshStandardMaterial()));
 let pads=[];
 const editor=createWorldEditor(scene,()=>{},{map:'base',anisotropy:1,height:()=>0,onColliders:value=>pads=value});
 try{
  editor.setActive(true);editor.setAsset('building-reference-armory');editor.arm();
  assert.equal(editor.placing,false,'cannot place a half-loaded model');
  editor.cancel();resolve({scene:model});await new Promise(setImmediate);
  assert.equal(editor.placing,false,'late load does not resurrect cancelled ghost');
  editor.arm();assert.equal(editor.placing,true);
  editor.hover(new T.Vector3(5,0,5));editor.click(new T.Raycaster(),new T.Vector3(5,0,5));editor.cancel();drain();
  const entry=JSON.parse(editor.exportJSON()).entries[0];assert.equal(entry.source,'building-reference-armory');
  editor.select(entry.id);editor.change({rotation:90,sx:2});drain();
  assert.equal(pads[0].w,4);assert.ok(Math.abs(pads[0].d-4)<1e-6);
  editor.duplicate();assert.equal(JSON.parse(editor.exportJSON()).entries.length,2);
  editor.remove();assert.equal(JSON.parse(editor.exportJSON()).entries.length,1);
  editor.undo();assert.equal(JSON.parse(editor.exportJSON()).entries.length,2);
  editor.redo();assert.equal(JSON.parse(editor.exportJSON()).entries.length,1);
 }finally{editor.dispose();GLTFLoader.prototype.loadAsync=original;}
});

test('decorative floor copies do not become invisible walking obstacles',()=>{
 const floor=new T.Mesh(new T.BoxGeometry(20,.1,20),new T.MeshBasicMaterial());
 let colliders=[];
 const editor=createWorldEditor(new T.Scene(),()=>{},{map:'base',anisotropy:1,height:()=>.08,
  additionalAssets:[{id:'test:floor',name:'Floor',create:()=>floor.clone(),collision:false}],
  onColliders:value=>colliders=value});
 try{
  editor.setActive(true);editor.setAsset('test:floor');editor.arm();
  editor.click(new T.Raycaster(),new T.Vector3(0,.08,0));editor.cancel();drain();
  assert.equal(editor.getSnapshot().objects.length,1);assert.deepEqual(colliders,[]);
 }finally{editor.dispose();floor.geometry.dispose();floor.material.dispose();}
});

test('a reset wins over a late GLB document import',async()=>{
 const original=GLTFLoader.prototype.loadAsync;let resolve;
 GLTFLoader.prototype.loadAsync=()=>new Promise(r=>resolve=r);
 const editor=createWorldEditor(new T.Scene(),()=>{},{map:'base',anisotropy:1,height:()=>0});
 try{
  editor.setActive(true);
  editor.importJSON(JSON.stringify({version:1,map:'base',entries:[{id:'prop:import',source:'building-reference-restaurant',x:0,y:0,z:0,rx:0,rotation:0,rz:0,sx:1,sy:1,sz:1}]}));
  editor.reset();resolve({scene:new T.Group()});await new Promise(setImmediate);
  assert.equal(JSON.parse(editor.exportJSON()).entries.length,0);
 }finally{editor.dispose();GLTFLoader.prototype.loadAsync=original;}
});

const savedBuildingDocument=()=>({version:1,map:'base',entries:[{
 id:'prop:saved-building',source:'building-reference-armory',x:7,y:.08,z:-9,
 rx:0,rotation:25,rz:0,sx:.8,sy:.8,sz:.8,
}]});
const savedBuildingModel=()=>{
 const scene=new T.Group();
 scene.add(new T.Mesh(new T.BoxGeometry(2,3,4).translate(0,1.5,0),new T.MeshStandardMaterial()));
 return {scene};
};

test('initial saved GLB restoration survives selection, Escape and closing MASTER; early Save preserves storage',async()=>{
 const originalLoad=GLTFLoader.prototype.loadAsync,originalStorage=globalThis.localStorage;
 const saved=savedBuildingDocument(),text=JSON.stringify(saved);let stored=text,resolveModel,writes=0;
 GLTFLoader.prototype.loadAsync=()=>new Promise(resolve=>resolveModel=resolve);
 globalThis.localStorage={getItem:()=>stored,setItem:(_key,value)=>{stored=value;writes++;}};
 const editor=createWorldEditor(new T.Scene(),()=>{},{map:'base',anisotropy:1,height:()=>0});
 try{
  let ready=false;void editor.ready.then(()=>ready=true);
  assert.equal(editor.getSnapshot().loading,true);assert.equal(editor.getSnapshot().canSave,false);
  editor.setActive(true);editor.select(null);editor.cancel();editor.setActive(false);
  editor.save();await new Promise(setImmediate);
  assert.equal(ready,false,'ready waits for saved model preparation');
  assert.equal(writes,0,'Save cannot replace an in-flight saved map with empty history');
  assert.equal(stored,text);
  resolveModel(savedBuildingModel());await editor.ready;drain();
  assert.equal(editor.active,false,'restoration does not reopen MASTER');
  assert.equal(editor.getSnapshot().loading,false);assert.equal(editor.getSnapshot().canSave,true);
  assert.deepEqual(JSON.parse(editor.exportJSON()),saved);
  assert.equal(editor.getSnapshot().objects.length,1);
  editor.setActive(true);editor.setActive(false);drain();
  assert.deepEqual(JSON.parse(editor.exportJSON()),saved,'reopening keeps the restored document');
  editor.save();assert.equal(writes,1);assert.deepEqual(JSON.parse(stored),saved);
 }finally{
  editor.dispose();GLTFLoader.prototype.loadAsync=originalLoad;
  if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;
 }
});

test('an explicit reset supersedes initial restoration before its model arrives',async()=>{
 const originalLoad=GLTFLoader.prototype.loadAsync,originalStorage=globalThis.localStorage;
 let stored=JSON.stringify(savedBuildingDocument()),resolveModel;
 GLTFLoader.prototype.loadAsync=()=>new Promise(resolve=>resolveModel=resolve);
 globalThis.localStorage={getItem:()=>stored,setItem:(_key,value)=>stored=value};
 const editor=createWorldEditor(new T.Scene(),()=>{},{map:'base',anisotropy:1,height:()=>0});
 try{
  editor.reset();await editor.ready;
  assert.equal(editor.getSnapshot().loading,false);assert.equal(editor.getSnapshot().canSave,true);
  editor.save();assert.deepEqual(JSON.parse(stored).entries,[],'explicit reset permits intentionally replacing a save');
  resolveModel(savedBuildingModel());await new Promise(setImmediate);drain();
  assert.deepEqual(JSON.parse(editor.exportJSON()).entries,[]);
 }finally{
  editor.dispose();GLTFLoader.prototype.loadAsync=originalLoad;
  if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;
 }
});

test('failed restoration rejects ready and protects storage until a successful retry',async()=>{
 const originalLoad=GLTFLoader.prototype.loadAsync,originalStorage=globalThis.localStorage;
 const saved=savedBuildingDocument(),text=JSON.stringify(saved);let stored=text,rejectModel,writes=0;
 GLTFLoader.prototype.loadAsync=()=>new Promise((_resolve,reject)=>rejectModel=reject);
 globalThis.localStorage={getItem:()=>stored,setItem:(_key,value)=>{stored=value;writes++;}};
 const editor=createWorldEditor(new T.Scene(),()=>{},{map:'base',anisotropy:1,height:()=>0});
 try{
  const rejected=assert.rejects(editor.ready,/offline/);
  rejectModel(new Error('offline'));await rejected;
  assert.equal(editor.getSnapshot().loading,false);assert.equal(editor.getSnapshot().canSave,false);
  editor.setActive(false);editor.select(null);editor.cancel();editor.save();
  assert.equal(writes,0,'closing or selection cannot remove a failed-restore save guard');
  assert.equal(stored,text);
  GLTFLoader.prototype.loadAsync=async()=>savedBuildingModel();
  await editor.load();drain();
  assert.equal(editor.getSnapshot().loading,false);assert.equal(editor.getSnapshot().canSave,true);
  assert.deepEqual(JSON.parse(editor.exportJSON()),saved);
  editor.save();assert.equal(writes,1);assert.deepEqual(JSON.parse(stored),saved);
 }finally{
  editor.dispose();GLTFLoader.prototype.loadAsync=originalLoad;
  if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;
 }
});

test('a newer document import wins over an in-flight initial saved map',async()=>{
 const originalLoad=GLTFLoader.prototype.loadAsync,originalStorage=globalThis.localStorage;
 let resolveModel;
 GLTFLoader.prototype.loadAsync=()=>new Promise(resolve=>resolveModel=resolve);
 globalThis.localStorage={getItem:()=>JSON.stringify(savedBuildingDocument())};
 const editor=createWorldEditor(new T.Scene(),()=>{},{map:'base',anisotropy:1,height:()=>0});
 try{
  const newer={version:1,map:'base',entries:[{...savedBuildingDocument().entries[0],id:'prop:newer',source:'barricade',x:11}]};
  await editor.importJSON(JSON.stringify(newer));await editor.ready;
  resolveModel(savedBuildingModel());await new Promise(setImmediate);drain();
  assert.deepEqual(JSON.parse(editor.exportJSON()),newer);
 }finally{
  editor.dispose();GLTFLoader.prototype.loadAsync=originalLoad;
  if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;
 }
});
