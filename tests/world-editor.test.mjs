import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDocument,emptyDocument,createHistory} from '../components/world-editor/document.ts';
import {setBaseEditorColliders,setBaseStationOverride,clearBaseEditor,canStand,nearestStation,STATIONS} from '../components/base/world.ts';
import {makeWorld,SOLIDS} from '../components/expedition/world.ts';
const entry={id:'prop:one',source:'barrel',x:1,y:0,z:2,rx:0,rotation:0,rz:0,sx:1,sy:1,sz:1};
const sources=new Set(['barrel','authored:0']);
const encode=(entries=[entry],map='base')=>JSON.stringify({version:1,map,entries});
test('JSON round trip is map scoped and strips unrecognized properties',()=>{
 assert.deepEqual(parseDocument(encode([{...entry,script:'evil',__proto__:{polluted:true}}]),'base',sources).entries,[entry]);
 assert.throws(()=>parseDocument(encode(undefined,'expedition'),'base',sources));
 assert.throws(()=>parseDocument(encode([{...entry,source:'unknown'}]),'base',sources));
 assert.throws(()=>parseDocument(encode([entry,entry]),'base',sources));
 assert.throws(()=>parseDocument(encode([{...entry,id:'authored:0'}]),'base',sources));
});
test('JSON rejects invalid transforms, oversized data and unsafe shape before replacing document',()=>{
 for(const patch of [{sx:0},{sy:-1},{sz:21},{x:null},{y:101},{rotation:Infinity},{length:25},{deleted:'yes'},{id:'__proto__.x'}])assert.throws(()=>parseDocument(encode([{...entry,...patch}]),'base',sources));
 assert.throws(()=>parseDocument(' '.repeat(500001),'base',sources));
 assert.throws(()=>parseDocument('null','base',sources));
 assert.throws(()=>parseDocument(JSON.stringify({version:1,map:'base',entries:Array(501).fill(entry)}),'base',sources));
});
test('history restores duplicate, transforms, deletion, reset and clears redo on a branch',()=>{
 const h=createHistory(emptyDocument('base')),one=parseDocument(encode(),'base',sources);h.commit(one);
 const two={...one,entries:[entry,{...entry,id:'copy:two',x:8}]};h.commit(two);
 h.commit({...two,entries:[{...entry,deleted:true},two.entries[1]]});
 assert.deepEqual(h.undo(),two);assert.deepEqual(h.undo(),one);assert.deepEqual(h.redo(),two);
 h.commit(emptyDocument('base'));assert.equal(h.canRedo,false);assert.deepEqual(h.undo(),two);
 const external=h.current;external.entries[0].x=99;assert.equal(h.current.entries[0].x,1);
});
test('base dynamic colliders and moved/deleted interactions never mutate authored constants',()=>{
 const original=structuredClone(STATIONS);try{
 assert.equal(canStand({x:0,z:5}),true);setBaseEditorColliders([{x:0,z:5,w:2,d:2}]);assert.equal(canStand({x:0,z:5}),false);
 setBaseEditorColliders([]);assert.equal(canStand({x:0,z:5}),true);
 setBaseStationOverride('smith',{x:1,z:6,deleted:false});assert.equal(nearestStation({x:1,z:6})?.id,'smith');
 setBaseStationOverride('smith',{x:1,z:6,deleted:true});assert.notEqual(nearestStation({x:1,z:6})?.id,'smith');assert.deepEqual(STATIONS,original);
 }finally{clearBaseEditor();}
});
test('expedition authored collision overrides replace old solids and invalidate cached routes',()=>{
 const world=makeWorld(),solid=SOLIDS[0],original=structuredClone(SOLIDS),point={x:solid.x,z:solid.z};
 assert.equal(world.canStand(point),false);world.setAuthoredColliders([]);assert.equal(world.canStand(point),true);
 const free={x:9,z:36};assert.equal(world.routeStand(free),true);world.setEditorColliders([{...free,w:2,d:2}]);assert.equal(world.routeStand(free),false);
 world.setEditorColliders([]);assert.equal(world.routeStand(free),true);assert.deepEqual(SOLIDS,original);
});
