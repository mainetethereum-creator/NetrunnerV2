import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createRefugeNpc,isEditableNpcBatch} from '../components/base/npc.ts';
import {createEditorStreaming} from '../components/world-editor/streaming.ts';

function fixtures(){
 const materials=Object.fromEntries(['edge','brass','dark','amber','teal','rust','black','green'].map(name=>[name,new T.MeshStandardMaterial()]));
 const combinations=[['amber','rust'],['teal','dark'],['amber','black'],['teal','edge'],['amber','green']];
 const roots=combinations.map(([accent,coat])=>createRefugeNpc(materials[accent],materials[coat],materials));
 return {roots,dispose(){roots.forEach(root=>root.traverse(o=>o.geometry?.dispose()));Object.values(materials).forEach(m=>m.dispose());}};
}
test('normal base service NPCs submit at most 23 material draws instead of 65 body-part draws',()=>{
 const {roots,dispose}=fixtures();try{
  let draws=0,triangles=0;
  for(const root of roots){const unique=new Set();assert.ok(root.children.length<=5);
   assert.equal(isEditableNpcBatch(root),true);
   for(const mesh of root.children){assert.equal(mesh.isMesh,true);assert.equal(isEditableNpcBatch(mesh),true);assert.equal(Array.isArray(mesh.material),false);assert.equal(mesh.geometry.groups.length,0);assert.equal(unique.has(mesh.material),false);unique.add(mesh.material);draws++;triangles+=mesh.geometry.index.count/3;assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);}
  }
  assert.equal(draws,23);assert.ok(draws<=65*.36);assert.equal(triangles,5*13*12);
  const source=readFileSync(new URL('../components/base/scene.ts',import.meta.url),'utf8');
  assert.match(source,/const group = createRefugeNpc\(accent,coat,m\)/);
  assert.match(source,/if \(isEditableNpcBatch\(mesh\)\) return/);
 }finally{dispose();}
});
test('batched NPC root retains local geometry through editor movement and reset ownership',()=>{
 const {roots,dispose}=fixtures(),scene=new T.Scene(),root=roots[0];scene.add(root);root.position.set(-7.3,.08,-4.6);
 const before=new T.Box3().setFromObject(root),geometries=root.children.map(mesh=>mesh.geometry),materials=root.children.map(mesh=>mesh.material),stream=createEditorStreaming(scene,[root]);
 try{
  stream.setModified(root,true);root.position.add(new T.Vector3(12,2,9));
  const after=new T.Box3().setFromObject(root);
  assert.ok(after.min.distanceTo(before.min.clone().add(new T.Vector3(12,2,9)))<1e-6);
  assert.ok(after.max.distanceTo(before.max.clone().add(new T.Vector3(12,2,9)))<1e-6);
  root.rotation.y=Math.PI/2;root.scale.setScalar(1.5);stream.update(root.position);
  assert.equal(root.visible,true);assert.equal(root.parent,stream.root);assert.equal(root.children.length,5);
  assert.deepEqual(root.children.map(mesh=>mesh.geometry),geometries);assert.deepEqual(root.children.map(mesh=>mesh.material),materials);
  root.userData.editorDeleted=true;stream.update(root.position);assert.equal(root.visible,false);
  root.userData.editorDeleted=false;stream.update(root.position);assert.equal(root.visible,true);
  stream.setModified(root,false);assert.equal(root.parent,scene);
  root.position.set(-7.3,.08,-4.6);root.rotation.set(0,0,0);root.scale.setScalar(1);root.updateMatrixWorld(true);
  assert.ok(new T.Box3().setFromObject(root).min.distanceTo(before.min)<1e-6);
  const source=readFileSync(new URL('../components/base/scene.ts',import.meta.url),'utf8');
  assert.match(source,/setBaseStationOverride\(npcStations\[i\],\{x:e\.x,z:e\.z,deleted:!!e\.deleted\}\)/);
  assert.match(source,/ring\.position\.set\(e\.x,\.1,e\.z\)/);
 }finally{stream.dispose();dispose();}
});
