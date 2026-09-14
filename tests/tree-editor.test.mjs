import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {treesFromEntries,TREE_EDITOR_STORAGE_KEY,readSavedTrees} from '../components/vegetation/tree-editor-state.ts';
import {makeWorld,DEFAULT_VEGETATION_TREES} from '../components/expedition/world.ts';

const transform={y:0,rx:0,rotation:90,rz:0,sx:1.4,sy:1.7,sz:1.2};

test('tree document moves, deletes and adds baked variants without reviving legacy trees',()=>{
 const defaults=[{x:10,z:10,variant:2,scale:1},{x:20,z:20,variant:0,scale:1.1}];
 const trees=treesFromEntries(defaults,[
  {id:'tree:0',source:'tree:0',x:12,z:14,...transform},
  {id:'tree:1',source:'tree:1',x:20,z:20,...transform,deleted:true},
  {id:'prop:new',source:'tree-variant:1',x:30,z:22,...transform},
 ]);
 assert.deepEqual(trees.map(t=>[t.x,t.z,t.variant]),[[12,14,2],[30,22,1]]);
 assert.equal(trees[0].rotation,Math.PI/2);
 assert.equal(trees[0].sy,1.7);
});

test('saved tree data is map scoped and malformed browser data falls back safely',()=>{
 const old=globalThis.localStorage;
 globalThis.localStorage={getItem:key=>key===TREE_EDITOR_STORAGE_KEY?JSON.stringify({version:1,map:'base',entries:[]}):null};
 assert.equal(readSavedTrees(DEFAULT_VEGETATION_TREES),DEFAULT_VEGETATION_TREES);
 globalThis.localStorage={getItem:()=>'{broken'};
 assert.equal(readSavedTrees(DEFAULT_VEGETATION_TREES),DEFAULT_VEGETATION_TREES);
 if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;
});

test('tree collision override follows transformed trunks and clears deleted locations',()=>{
 const world=makeWorld(),tree=DEFAULT_VEGETATION_TREES[0];
 world.setTreeColliders([{x:tree.x+8,z:tree.z,w:1.2,d:1.2}]);
 assert.equal(world.canStand({x:tree.x,z:tree.z},.2),true);
 assert.equal(world.canStand({x:tree.x+8,z:tree.z},.2),false);
 world.setTreeColliders([]);
 assert.equal(world.canStand({x:tree.x+8,z:tree.z},.2),true);
});

test('tree editor stays lazy and obsolete cubic POI dressing does not return',()=>{
 const scene=fs.readFileSync(new URL('../components/expedition/scene.ts',import.meta.url),'utf8');
 const panel=fs.readFileSync(new URL('../components/world-editor/WorldEditorPanel.tsx',import.meta.url),'utf8');
 const environment=fs.readFileSync(new URL('../components/expedition/environment.ts',import.meta.url),'utf8');
 const nature=fs.readFileSync(new URL('../components/expedition/nature.ts',import.meta.url),'utf8');
 assert.match(scene,/import\('\.\/tree-editor'\)/);
 assert.doesNotMatch(scene,/^import .*tree-editor/m);
 assert.doesNotMatch(environment,/Debris compositions|p\.kind==='convoy'|p\.kind==='power'|Small authored stories/);
 assert.match(nature,/export const TREES|from '\.\/world'/);
 assert.match(panel,/editor\.remove\(\)/);
 assert.match(panel,/Delete · Удалить/);
});
