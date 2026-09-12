import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SECURITY_FENCE_PROPS,createSecurityFenceLibrary} from '../components/expedition/security-fences.ts';
import {FENCE_IDS,fenceLength,isFence,snapFence,fenceColliders} from '../components/expedition/fence-layout.ts';
import {makeWorld,findRoute} from '../components/expedition/world.ts';

test('all fence variants quantize length and connect at rotated and mixed endpoints',()=>{
  assert.deepEqual([NaN,Infinity,-2,4,5,25].map(fenceLength),[3,3,3,3,6,24]);
  assert.equal(isFence('barricade'),false);
  for(const asset of FENCE_IDS){
    assert.equal(isFence(asset),true);
    const items=[{asset,x:10,z:10,rotation:0,length:6}];
    assert.deepEqual(snapFence({x:14.7,z:10.1},0,3,items),{x:14.5,z:10});
    assert.deepEqual(snapFence({x:13.1,z:8.6},90,3,items),{x:13,z:8.5});
    assert.deepEqual(snapFence({x:30,z:30},0,3,items),{x:30,z:30});
  }
});

test('security fences stay low-poly and share their geometry/materials across placements',()=>{
  const atlas=new T.Texture(),library=createSecurityFenceLibrary(atlas);
  let owned=0,released=0,atlasReleased=0;
  atlas.addEventListener('dispose',()=>atlasReleased++);
  for(const asset of SECURITY_FENCE_PROPS)for(const length of [3,12,24]){
    const first=library.create(asset.id,length),second=library.create(asset.id,length);
    assert.notEqual(first,second);let triangles=0;
    for(let i=0;i<first.children.length;i++){
      const mesh=first.children[i];assert.equal(mesh.geometry,second.children[i].geometry);assert.equal(mesh.material,second.children[i].material);
      assert.ok(mesh.geometry.index);triangles+=mesh.geometry.index.count/3;
      for(const attr of Object.values(mesh.geometry.attributes))assert.ok(attr.array.every(Number.isFinite));
      owned++;mesh.geometry.addEventListener('dispose',()=>released++);
    }
    assert.ok(triangles<22000,`${asset.id} ${length}: ${triangles}`);assert.ok(first.children.length<=4);
    const bounds=new T.Box3().setFromObject(first),size=bounds.getSize(new T.Vector3());
    assert.ok(bounds.min.y>=-1e-6);assert.ok(size.x>=length+.5&&size.x<=length+.8);assert.ok(size.y>2.7&&size.y<3.1);assert.ok(size.z<=.95);
    const quantized=library.create(asset.id,length+1);
    assert.equal(quantized.children[0].geometry,first.children[0].geometry);
  }
  library.dispose();assert.equal(released,owned);assert.equal(atlasReleased,0);atlas.dispose();
});

test('dynamic fence collisions update navigation, rotation, length and deletion without changing static solids',()=>{
  const world=makeWorld();
  let center;
  // Use a genuinely open patch; authored geography can evolve independently.
  for(let z=7;z<65&&!center;z+=2)for(let x=8;x<136&&!center;x+=2){
    if([-4,-2,0,2,4].every(dx=>[-3,0,3].every(dz=>world.canStand({x:x+dx,z:z+dz}))))center={x,z};
  }
  assert.ok(center,'an open patch for the editor test');
  const start={x:center.x,z:center.z-2},end={x:center.x,z:center.z+2};
  assert.ok(world.routeStand(center));
  for(const asset of FENCE_IDS){
    const item={...center,asset,rotation:0,length:6};world.setEditorColliders(fenceColliders(item));
    assert.equal(world.canStand(center),false);assert.equal(world.routeStand(center),false);
    const path=findRoute(world,start,end);assert.ok(path.length);assert.ok(path.every(p=>world.canStand(p)));
    assert.equal(world.canStand({x:center.x+2.4,z:center.z}),false);
    world.setEditorColliders(fenceColliders({...item,length:3}));
    assert.equal(world.canStand({x:center.x+2.4,z:center.z}),true);
    world.setEditorColliders(fenceColliders({...item,rotation:90}));
    assert.equal(world.canStand({x:center.x+2.4,z:center.z}),true);
    assert.equal(world.canStand({x:center.x,z:center.z+2.4}),false);
    world.setEditorColliders(fenceColliders({...item,rotation:45}));
    assert.equal(world.canStand({x:center.x+2,z:center.z+2}),true,'diagonal AABB corner stays open');
    world.setEditorColliders([]);assert.equal(world.canStand(center),true);assert.equal(world.routeStand(center),true);
  }
});
