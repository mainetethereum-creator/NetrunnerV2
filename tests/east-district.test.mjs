import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createEastDistrict} from '../src/renderer/environment/east-district.ts';
import {EAST_DISTRICT,EAST_EXIT,EAST_BEDS,EAST_BUILDINGS,eastGroundHeight} from '../src/renderer/environment/east-district-layout.ts';
import {canStand,findPath,moveWithCollision,nearestStation,clearBaseEditor} from '../components/base/world.ts';
import {railPierFootprints,railSupportPoses} from '../src/renderer/environment/elevated-rail-layout.ts';

async function model() {
  const bytes=readFileSync('public/game/east-district/v1/east-district.glb');
  const loader=new GLTFLoader();loader.register(()=>({name:'EXT_texture_webp',loadTexture:async()=>new T.Texture()}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
}
test('east walkways connect the garden to an interaction that cannot be walked through',()=>{
  clearBaseEditor();
  const path=findPath({x:31,z:23},EAST_EXIT);assert.ok(path.length>4);
  assert.ok(path.every(p=>canStand(p)));assert.equal(nearestStation(EAST_EXIT)?.id,'expedition');
  const stopped=moveWithCollision(EAST_EXIT,12,0);
  assert.ok(stopped.x<EAST_DISTRICT.east-.32,'breach is a transition, not a hole in navigation');
  for(let z=-12;z<60;z+=.2)assert.equal(canStand({x:EAST_DISTRICT.east+.01,z}),false);
  for(const b of [...EAST_BUILDINGS,...EAST_BEDS])assert.equal(canStand(b),false);
  assert.equal(findPath(EAST_EXIT,{x:52,z:25}).length,0);
  for(const pier of railPierFootprints().slice(4)) {
    assert.ok(pier.x-pier.w/2>EAST_DISTRICT.east);
    const support=railSupportPoses().find(p=>p.x===pier.x&&p.z===pier.z);
    assert.ok(Math.abs(eastGroundHeight(pier.x,pier.z)-support.y)<.01,'earth reaches support feet');
  }
});
test('mapped Blender kit has continuous ground under the railway and a clear physical breach',async()=>{
  const bytes=readFileSync('public/game/east-district/v1/east-district.glb');
  assert.ok(bytes.length<4_000_000);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok(doc.images.every(i=>i.mimeType==='image/webp'&&i.bufferView!==undefined));
  assert.ok(doc.materials.filter(m=>m.normalTexture).length>=3);
  const {scene}=await model();
  const ground=scene.getObjectByName('EastGround');ground.position.set(0,0,0);scene.updateMatrixWorld(true);
  for(const {x,z} of [{x:47,z:25},...railPierFootprints().slice(4)]) {
    const ray=new T.Raycaster(new T.Vector3(x,10,z),new T.Vector3(0,-1,0));
    const hit=ray.intersectObject(ground,true);assert.ok(hit.length,'solid earth, not a void');
    assert.ok(Math.abs(hit[0].point.y-eastGroundHeight(x,z))<.035, 'pier base follows the actual earth surface');
  }
  const breach=scene.getObjectByName('ExpeditionBreach');breach.position.set(0,0,0);scene.updateMatrixWorld(true);
  assert.equal(new T.Raycaster(new T.Vector3(0,1,4),new T.Vector3(0,0,-1)).intersectObject(breach,true).length,0);
});
test('east kit disposal owns loaded resources but never the borrowed paving',async()=>{
  const source=await model(),resources=new Set();
  source.scene.traverse(o=>{if(o instanceof T.Mesh){resources.add(o.geometry);resources.add(o.material);for(const v of Object.values(o.material))if(v instanceof T.Texture)resources.add(v);}});
  const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));
  const paving=new T.MeshStandardMaterial();let pavingDisposals=0;paving.addEventListener('dispose',()=>pavingDisposals++);
  const scene=new T.Scene(),errors=[];
  const district=createEastDistrict(scene,{loadAsync:async()=>source},paving,false,m=>errors.push(m));await district.ready;
  assert.deepEqual(errors,[]);district.update(.016,false);district.dispose();district.dispose();
  assert.equal(scene.children.length,0);assert.equal(pavingDisposals,0);
  assert.ok([...counts.values()].every(n=>n===1));paving.dispose();
});
