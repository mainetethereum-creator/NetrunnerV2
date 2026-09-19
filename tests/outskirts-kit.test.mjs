import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REFERENCE_BUILDINGS, referenceHasCollision } from '../src/assets/reference-buildings.ts';
import { sampleRailRoute } from '../src/renderer/environment/elevated-rail-layout.ts';

const slugs = ['corner-chamfer','corner-rounded','slender-glass','slender-terrace',
  'outskirts-ground','outskirts-wreck','outskirts-barrier'];
const loadJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
for (const slug of slugs) {
  test(`${slug}: portable, bounded, finite game geometry`, async () => {
    const id = slug.startsWith('outskirts-') ? slug : `building-${slug}`;
    const asset = REFERENCE_BUILDINGS.find(a => a.id === id);
    assert.ok(asset);
    const bytes = readFileSync(new URL(`../public${asset.url}`, import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'glTF');
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    assert.ok(bytes.length < 3.6*1024*1024);
    const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
    assert.ok(!doc.animations?.length && !doc.skins?.length && !doc.cameras?.length);
    assert.ok(doc.images.every(i=>i.bufferView!==undefined && !i.uri));
    assert.ok(doc.materials.every(m=>!m.alphaMode || m.alphaMode==='OPAQUE'));
    const loader=new GLTFLoader();
    loader.register(()=>({name:'TEST_TEXTURES',loadTexture:()=>Promise.resolve(new T.Texture())}));
    const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    scene.updateMatrixWorld(true);
    let triangles=0,draws=0;
    scene.traverse(o=>{
      if(!o.isMesh)return;
      draws++;triangles+=o.geometry.index.count/3;
      assert.ok(o.geometry.attributes.normal && o.geometry.attributes.uv);
      for(const a of Object.values(o.geometry.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));
      for(const i of o.geometry.index.array)assert.ok(i<o.geometry.attributes.position.count);
    });
    assert.ok(triangles<16000);assert.ok(draws<=12);
    const bounds=new T.Box3().setFromObject(scene),size=bounds.getSize(new T.Vector3());
    assert.ok(Math.abs(bounds.min.x+bounds.max.x)<1e-3);
    assert.ok(Math.abs(bounds.min.z+bounds.max.z)<1e-3);
    if(slug!=='outskirts-ground')assert.ok(Math.abs(bounds.min.y)<1e-3);
    else {assert.equal(size.x,64);assert.equal(size.z,26);assert.ok(size.y<1);}
    if(!slug.startsWith('outskirts-')){
      for(const y of [1,6,10])for(const [x,z] of [[50,0],[-50,0],[0,50],[0,-50]]){
        const start=new T.Vector3(x,y,z),direction=new T.Vector3(0,y,0).sub(start).normalize();
        assert.ok(new T.Raycaster(start,direction).intersectObject(scene,true).length,'closed facade');
      }
    }
  });
}

test('outskirts layout preserves all owner edits and leaves service row / railway clear',()=>{
  const before=loadJson('../output/map-backups/base-before-outskirts-2026-09-19.json');
  const after=loadJson('../output/map-backups/base-with-outskirts-2026-09-19.json');
  for(const entry of before.entries)assert.deepEqual(after.entries.find(e=>e.id===entry.id),entry);
  assert.equal(new Set(after.entries.map(e=>e.id)).size,after.entries.length);
  const additions=after.entries.filter(e=>e.id.startsWith('prop:outskirts-'));
  assert.equal(additions.filter(e=>e.source.startsWith('building-')).length,4);
  for(const e of additions.filter(e=>e.source.startsWith('building-slender'))){
    for(let d=0;d<=60;d+=.5){
      const rail=sampleRailRoute(d);
      assert.ok(Math.abs(e.x-rail.x)>6 || Math.abs(e.z-rail.z)>7,'tower does not intersect guideway');
    }
  }
  for(const e of additions.filter(e=>e.source.startsWith('building-corner'))){
    assert.ok(e.x < -17 || e.x >= 25,'central service street stays open');
    const slug=e.source.replace('building-','');
    const metrics=loadJson(`../output/building-models/${slug}-v1/metrics.json`);
    assert.ok(e.x-metrics.width/2>=-32 && e.x+metrics.width/2<=32,'whole house stays on the platform');
  }
  assert.equal(referenceHasCollision('outskirts-ground'),false);
  assert.equal(referenceHasCollision('outskirts-wreck'),true);
  assert.equal(referenceHasCollision('building-slender-glass'),true);
});
