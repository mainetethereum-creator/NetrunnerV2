import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
import * as T from 'three';
import {createLazyEditor} from '../components/world-editor/lazy-editor.ts';
import {createEditorStreaming} from '../components/world-editor/streaming.ts';
import {createDistanceDetail} from '../components/expedition/distance-detail.ts';

test('placements cull at 57m from player/editor focus and deleted props stay hidden',()=>{
 const scene=new T.Scene(),stream=createEditorStreaming(scene,[]),near=new T.Group(),far=new T.Group();
 near.position.x=56;far.position.x=58;stream.root.add(near,far);
 stream.update({x:0,z:0});assert.equal(near.visible,true);assert.equal(far.visible,false);
 stream.update({x:100,z:0});assert.equal(far.visible,true);
 far.userData.editorDeleted=true;stream.update({x:100,z:0});assert.equal(far.visible,false);
 stream.update({x:-100,z:0});assert.equal(near.visible,false);stream.dispose();
});

test('moved authored props stream independently without revealing old chunk; reset restores parent',()=>{
 const scene=new T.Scene(),oldChunk=new T.Group(),model=new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial()),sibling=new T.Group();
 scene.add(oldChunk);oldChunk.add(model,sibling);
 const detail=createDistanceDetail();detail.add(model);
 const stream=createEditorStreaming(scene,[model]);
 oldChunk.visible=false;stream.setModified(model,true);model.position.x=100;
 stream.update({x:100,z:0});detail.update({x:100,z:0});
 assert.equal(model.parent,stream.root);assert.equal(model.visible,true);assert.equal(oldChunk.visible,false);assert.equal(sibling.parent,oldChunk);
 stream.update({x:0,z:0});detail.update({x:0,z:0});assert.equal(model.visible,false);
 stream.setModified(model,false);model.position.x=0;detail.update({x:0,z:0});
 assert.equal(model.parent,oldChunk);assert.equal(model.userData.editorStreaming,false);assert.equal(oldChunk.visible,false);
 stream.setModified(model,true);stream.dispose();assert.equal(model.parent,oldChunk);
 detail.dispose();model.geometry.dispose();model.material.dispose();
});

const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fakeEditor(){const listeners=new Set();return {active:false,placing:false,getSnapshot:()=>({notice:'ready'}),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},setActive(value){this.active=value;for(const fn of listeners)fn();},dispose(){listeners.clear();}};}
test('lazy facade loads once on first activation and publishes snapshot to pre-existing subscribers',async()=>{
 let loads=0,constructs=0,resolveLoad;const active=[];
 const editor=createLazyEditor(()=>{loads++;return new Promise(resolve=>{resolveLoad=resolve;});},assert.fail,value=>active.push(value));
 let notifications=0;const unsubscribe=editor.subscribe(()=>notifications++);
 editor.stream({x:0,z:0});editor.setActive(false);assert.equal(loads,0);assert.equal(editor.getSnapshot(),undefined);
 editor.setActive(true);editor.setActive(true);assert.equal(loads,1);assert.equal(editor.active,true);
 editor.setActive(false);resolveLoad(()=>{constructs++;return fakeEditor();});await settle();
 assert.equal(constructs,1);assert.equal(editor.active,false);assert.deepEqual(editor.getSnapshot(),{notice:'ready'});assert.ok(notifications>0);
 editor.setActive(true);assert.equal(loads,1);assert.equal(editor.active,true);assert.equal(active.at(-1),true);
 unsubscribe();editor.dispose();
});
test('disposing during import never constructs an editor; failed imports can retry',async()=>{
 let resolveLoad,constructed=0;
 const editor=createLazyEditor(()=>new Promise(resolve=>{resolveLoad=resolve;}),assert.fail);
 editor.setActive(true);editor.dispose();resolveLoad(()=>{constructed++;return fakeEditor();});await settle();assert.equal(constructed,0);
 let attempts=0,errors=0;const retry=createLazyEditor(async()=>{if(++attempts===1)throw new Error('network');return()=>fakeEditor();},()=>errors++);
 retry.setActive(true);await settle();assert.equal(errors,1);assert.equal(retry.active,false);
 retry.setActive(true);await settle();assert.equal(attempts,2);assert.equal(retry.active,true);retry.dispose();
});

function staticDependencies(entry){
 const seen=new Set();function visit(file){file=resolve(file);if(seen.has(file))return;seen.add(file);
  const ast=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  for(const node of ast.statements){
   if(!ts.isImportDeclaration(node)||node.importClause?.isTypeOnly)continue;
   const bindings=node.importClause?.namedBindings;
   if(!node.importClause?.name&&bindings&&ts.isNamedImports(bindings)&&bindings.elements.every(e=>e.isTypeOnly))continue;
   const specifier=node.moduleSpecifier.text;if(!specifier.startsWith('.'))continue;
   const base=resolve(dirname(file),specifier),next=[base,base+'.ts',base+'.tsx'].find(p=>existsSync(p)&&/\.tsx?$/.test(p));if(next)visit(next);
  }
 }visit(entry);return seen;
}
test('normal base app/scene graphs exclude full catalogue and controller; expedition creation is lazy',()=>{
 for(const entry of ['components/base/BaseApp.tsx','components/base/scene.ts']){
  const files=staticDependencies(entry);assert.ok(files.size>5);
  for(const file of files)assert.ok(!/[/\\](prop-assets|controller|BaseEditorPanel)\.tsx?$/.test(file),file);
 }
 for(const path of ['components/base/scene.ts','components/expedition/scene.ts']){
  const code=readFileSync(path,'utf8');assert.match(code,/createLazyEditor\(\(\)=>import\(/);assert.doesNotMatch(code,/queueMicrotask\([^\n]*[Ee]ditor|queueMicrotask\([^\n]*enableMaster/);
  assert.match(code,/editor\.stream\(editor\.active\?pivot:player\.position\)/);
 }
});
