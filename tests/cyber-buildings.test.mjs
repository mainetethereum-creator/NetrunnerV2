import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CYBER_BUILDING_PROPS,createCyberBuildingLibrary} from '../components/expedition/cyber-buildings.ts';
import {AUTHORED_PROPS} from '../components/expedition/authored-layout.ts';

// Geometry/resource checks run without a GPU; browser validation checks the
// atlas, custom emissive shader and actual appearance separately.
const context=new Proxy({}, {get:()=>()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};

test('cyber architecture is finite, indexed, within budget and shares placement resources',()=>{
  const atlas=new T.Texture(),library=createCyberBuildingLibrary(atlas);
  try{
    for(const asset of CYBER_BUILDING_PROPS){
      const first=library.create(asset.id),second=library.create(asset.id);
      assert.notEqual(first,second);
      let triangles=0;
      for(let i=0;i<first.children.length;i++){
        const mesh=first.children[i],clone=second.children[i];
        assert.equal(mesh.geometry,clone.geometry);assert.equal(mesh.material,clone.material);
        assert.ok(mesh.geometry.index);
        triangles+=mesh.geometry.index.count/3;
        for(const attribute of Object.values(mesh.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite),asset.id);
      }
      assert.ok(triangles>1000&&triangles<=35000,asset.id);
      assert.ok(first.children.length<=7,asset.id);
      const placement=AUTHORED_PROPS.find(p=>p.asset===asset.id);
      assert.ok(placement?.collision,asset.id);
      const bounds=new T.Box3().setFromObject(first),collision=placement.collision;
      assert.ok(bounds.min.y>=-1e-6&&bounds.max.y<=collision.h,asset.id);
      assert.ok(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x))<=collision.w/2,`${asset.id}: collider width`);
      assert.ok(Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z))<=collision.d/2,`${asset.id}: collider depth`);
      assert.ok(first.userData.lightSources.length<=2);
    }
  }finally{library.dispose();atlas.dispose();}
});

test('disposing a building library releases each shared geometry exactly once',()=>{
  const atlas=new T.Texture(),library=createCyberBuildingLibrary(atlas);
  let released=0,owned=0,atlasReleased=0;
  atlas.addEventListener('dispose',()=>atlasReleased++);
  for(const asset of CYBER_BUILDING_PROPS){
    const model=library.create(asset.id);library.create(asset.id);
    for(const mesh of model.children){owned++;mesh.geometry.addEventListener('dispose',()=>released++);}
  }
  library.dispose();assert.equal(released,owned);assert.equal(atlasReleased,0);
  atlas.dispose();
});
