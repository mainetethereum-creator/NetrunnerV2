import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RAIL_FORK,ELEVATED_RAIL,sampleRailRoute,sampleAbandonedRailRoute,railSupportPoses} from '../src/renderer/environment/elevated-rail-layout.ts';
import {createRailRuins} from '../src/renderer/environment/rail-ruins.ts';

async function model() {
  const bytes=readFileSync('public/game/rail-ruins/v1/rail-ruins.glb');
  const loader=new GLTFLoader();loader.register(()=>({name:'EXT_texture_webp',loadTexture:async()=>new T.Texture()}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
}
test('train takes the intact eastern branch while original southern pillars stay in place',()=>{
  assert.deepEqual(sampleRailRoute(RAIL_FORK.start),sampleAbandonedRailRoute(RAIL_FORK.start));
  for(const s of [78,96,114,132]) {
    const previous=sampleAbandonedRailRoute(s),support=railSupportPoses().find(p=>p.abandoned&&p.distance===s);
    assert.ok(support);
    assert.ok(Math.abs(support.x-(previous.x-3*Math.sin(previous.yaw)))<1e-10);
    assert.ok(Math.abs(support.z-(previous.z-3*Math.cos(previous.yaw)))<1e-10);
  }
  for(let s=90;s<140;s+=.5) {
    const live=sampleRailRoute(s),old=sampleAbandonedRailRoute(s);
    assert.ok(live.x>old.x+8, 'train clears the abandoned foreground instead of reaching the broken edge');
  }
  assert.equal(ELEVATED_RAIL.deckCentres.some(s=>s>56&&s<88),false,'authored switch replaces the overlapping repeated decks');
});
test('Blender Y junction has unbroken live rails, an open void beyond the shattered branch and no invisible foreground deck',async()=>{
  const gltf=await model(),junction=gltf.scene.getObjectByName('RailJunction');junction.position.set(0,0,0);gltf.scene.updateMatrixWorld(true);
  const rayAt=(x,z)=>new T.Raycaster(new T.Vector3(x,4,z),new T.Vector3(0,-1,0)).intersectObject(junction,true);
  for(let x=.01;x<23.99;x+=.33)for(const z of [-.82,.82]) {
    const hits=rayAt(x,z);assert.ok(hits.length,`rail/bed gap at ${x},${z}`);
    assert.ok(Math.abs(hits[0].point.y-.19)<.001,`live rail at ${x},${z} has contact height ${hits[0].point.y}, expected .19`);
  }
  for(const s of [24,28,32]) {
    const a=s/32;assert.equal(rayAt(32*Math.sin(a),32*(1-Math.cos(a))).length,0,'no slab after the crash');
  }
  assert.ok(junction.children.some(m=>m.material.name==='RailRuin_Rust'));
  const bytes=readFileSync('public/game/rail-ruins/v1/rail-ruins.glb');assert.ok(bytes.length<1_500_000);
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok(doc.images.every(i=>i.mimeType==='image/webp'));assert.ok(doc.materials.filter(m=>m.normalTexture).length>=4);
});
test('ruin kit disposes source and instanced resources once, including late loading',async()=>{
  for(const late of [false,true]) {
    const source=await model(),resources=new Set(),counts=new Map(),errors=[];
    source.scene.traverse(o=>{if(o instanceof T.Mesh){resources.add(o.geometry);resources.add(o.material);for(const v of Object.values(o.material))if(v instanceof T.Texture)resources.add(v);}});
    for(const r of resources){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}
    let resolve;const scene=new T.Scene();
    const kit=createRailRuins(scene,{loadAsync:()=>late?new Promise(done=>{resolve=done;}):Promise.resolve(source)},false,m=>errors.push(m));
    if(late){kit.dispose();resolve(source);}await kit.ready;
    if(!late){
      scene.updateMatrixWorld(true);
      assert.ok(kit.root.children.some(o=>o.name.includes('RailJunction')));
      for(let distance=60.01;distance<83.99;distance+=.7)for(const side of [-.82,.82]){
        const route=sampleRailRoute(distance);
        const ray=new T.Raycaster(new T.Vector3(route.x+side*Math.sin(route.yaw),30,route.z+side*Math.cos(route.yaw)),new T.Vector3(0,-1,0));
        const hits=ray.intersectObject(kit.root,true);
        assert.ok(hits.length&&Math.abs(hits[0].point.y-ELEVATED_RAIL.deckY-.19)<.001,
          `instanced live junction must meet train contact at station ${distance}`);
      }
    }
    kit.dispose();kit.dispose();assert.equal(scene.children.length,0);assert.deepEqual(errors,[]);
    assert.ok([...counts.values()].every(n=>n===1));
  }
});
