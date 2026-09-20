import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createSakuraPark} from '../src/renderer/environment/sakura-park.ts';
import {deliveryPose,DELIVERY_PERIOD,parkWalkwayContains,SAKURA_PARK,PARK_ROCKS,SAKURA_TREES} from '../src/renderer/environment/sakura-park-layout.ts';
import {canStand,findPath,SPAWN} from '../components/base/world.ts';

function fixture() {
  const scene=new T.Group(),resources=[];
  const names=['Bark','Cedar','Basalt','Moss','Bronze','Washi','RedPaper','Noren','Food','Ceramic','Blossom','RobotPaint','Rubber','Cyan','Sign','Foliage','WaterSpray'];
  const texture=new T.Texture();resources.push(texture);
  const materials=names.map(name=>{const m=new T.MeshStandardMaterial({map:texture});m.name=`SAKURA_${name}`;resources.push(m);return m;});
  for(const name of ['SakuraTree','YataiStall','Fountain','FountainSpray','DeliveryRobot','Planting','FernCluster','ForestGrass','GardenShrub','LanternPost','StoneLantern','ParkBench','GardenSign']) {
    const root=new T.Group();root.name=name;scene.add(root);
    for(const material of (name==='SakuraTree'?materials:[materials[2]])) {
      const geometry=new T.BoxGeometry(.5,1,.5);resources.push(geometry);
      const mesh=new T.Mesh(geometry,material);mesh.name=`${name}_${material.name}`;root.add(mesh);
    }
  }
  return {scene,resources};
}
const watch=resources=>resources.map(resource=>{const count={value:0};resource.addEventListener('dispose',()=>count.value++);return count;});

test('Blender park kit has alpha-tested leaves, real PBR textures and bounded transfer/geometry',()=>{
  const file=readFileSync('public/game/park/sakura-v1/sakura-kit.glb');assert.ok(file.length<5_000_000);
  const doc=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)));
  for(const name of ['SakuraTree','YataiStall','Fountain','DeliveryRobot','Planting','LanternPost','StoneLantern','ParkBench','GardenSign'])assert.ok(doc.nodes.some(node=>node.name===name),name);
  for(const name of ['SAKURA_Blossom','SAKURA_Foliage']) {
    const mat=doc.materials.find(m=>m.name===name);assert.equal(mat.alphaMode,'MASK');assert.equal(mat.doubleSided,true);assert.ok(mat.pbrMetallicRoughness.baseColorTexture);
  }
  assert.ok(doc.materials.filter(m=>m.normalTexture).length>=4);
  assert.ok(doc.images.every(i=>i.mimeType==='image/webp'));
  assert.ok(!doc.animations?.length&&!doc.cameras?.length);
  for(const accessor of doc.accessors)for(const value of [...accessor.min??[],...accessor.max??[]])assert.ok(Number.isFinite(value));
});

test('delivery route is seamless, separated, stays on paving and avoids solid fountain/stalls',()=>{
  for(let t=0;t<DELIVERY_PERIOD;t+=.25) {
    const poses=[0,1,2].map(i=>deliveryPose(t,i));
    for(const p of poses) {assert.ok(parkWalkwayContains(p));assert.ok(canStand(p,.4),JSON.stringify(p));}
    for(let i=0;i<3;i++)assert.ok(Math.hypot(poses[i].x-poses[(i+1)%3].x,poses[i].z-poses[(i+1)%3].z)>10);
  }
  const a=deliveryPose(0,0),b=deliveryPose(DELIVERY_PERIOD,0);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-8);
  assert.ok(findPath(SPAWN,{x:3.2,z:31}).length,'plaza connects to the park');
  assert.equal(canStand({x:SAKURA_PARK.fountainX,z:SAKURA_PARK.fountainZ}),false);
  assert.equal(canStand({x:0,z:34}),false,'outer platform edge is solid');
  for(const rock of PARK_ROCKS)assert.equal(canStand(rock),false,'decorative rocks stay solid');
});

test('west park paving reaches the armory edge and the marked boundary tree is removed',()=>{
  assert.equal(SAKURA_PARK.west,-42);
  assert.ok(parkWalkwayContains({x:-41.5,z:19}), 'main park path continues across the former void');
  assert.ok(parkWalkwayContains({x:-41.5,z:29}), 'south park path continues across the former void');
  assert.equal(SAKURA_TREES.some(([x,z])=>x===-29&&z===15),false);
  assert.equal(SAKURA_TREES.some(([x,z])=>x===-21&&z===15.1),false);
  assert.equal(SAKURA_TREES.some(([x,z])=>x===-9.5&&z===15.6),false);
});

test('park shares meshes, pauses deliveries and disposes each resource once',async()=>{
  const source=fixture(),counts=watch(source.resources),scene=new T.Scene(),errors=[];
  const park=createSakuraPark(scene,{loadAsync:async()=>source},false,e=>errors.push(e));await park.ready;assert.deepEqual(errors,[]);
  const robot=park.root.getObjectByName('Park / DeliveryRobot_SAKURA_Basalt');
  const a=new T.Matrix4(),b=new T.Matrix4();robot.getMatrixAt(0,a);
  park.update(1,true,true,false);robot.getMatrixAt(0,b);assert.notDeepEqual(a.elements,b.elements);
  a.copy(b);park.update(5,false,true,false);robot.getMatrixAt(0,b);assert.deepEqual(a.elements,b.elements);
  park.update(0,true,true,false);robot.getMatrixAt(0,b);assert.deepEqual(a.elements,b.elements);
  const gpu=new Set();park.root.traverse(o=>{if(o.geometry)gpu.add(o.geometry);if(o.material)gpu.add(o.material);if(o.isInstancedMesh)gpu.add(o);});const gpuCounts=watch([...gpu]);
  park.dispose();park.dispose();assert.ok(counts.every(c=>c.value===1));assert.ok(gpuCounts.every(c=>c.value===1));assert.equal(scene.children.length,0);
});

test('late GLB after unmount releases resources without reattaching scenery',async()=>{
  let finish;const promise=new Promise(resolve=>finish=resolve),source=fixture(),counts=watch(source.resources),scene=new T.Scene();
  const park=createSakuraPark(scene,{loadAsync:()=>promise},true,()=>assert.fail('unmounted error'));
  park.dispose();finish(source);await park.ready;assert.equal(scene.children.length,0);assert.ok(counts.every(c=>c.value===1));
});
