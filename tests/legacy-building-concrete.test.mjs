import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import * as T from 'three';
import {prepareConcreteUv} from '../components/expedition/cyber-concrete.ts';

registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith('.')&&context.parentURL&&!/\.[a-z]+$/i.test(specifier)){
    const url=new URL(specifier+'.ts',context.parentURL);
    if(existsSync(url))return next(url.href,context);
  }
  return next(specifier,context);
}});
const {BUILDING_PROPS,createBuildingLibrary}=await import('../components/expedition/building-props.ts');
const context=new Proxy({}, {get:()=>()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
const budgets={
  'building-workshop':[5544,8], 'building-stack':[24792,10],
  'building-home2':[9756,9], 'building-ruin':[25144,6],
  'building-courtyard':[5122,12], 'building-tokyo':[8976,10],
  'building-tenement':[33744,8],
};
const manifest=JSON.parse(readFileSync(new URL('../public/game/props/salvage/building-manifest.json',import.meta.url)));

test('legacy buildings keep triangles and draws while only concrete gains metric coordinates',()=>{
  const originalLoad=T.TextureLoader.prototype.load,requests=[];
  T.TextureLoader.prototype.load=function(url){requests.push(url);return new T.Texture();};
  const library=createBuildingLibrary();
  try{
    for(const [id,[triangles,draws]] of Object.entries(budgets)){
      const root=library.create(id),clone=library.create(id);
      let actualTriangles=0,bytes=0,concreteCount=0;
      assert.equal(root.children.length,draws,id);
      for(const [i,mesh] of root.children.entries()){
        const g=mesh.geometry,m=mesh.material;
        assert.equal(g,clone.children[i].geometry);assert.equal(m,clone.children[i].material);
        actualTriangles+=g.index.count/3;bytes+=g.index.array.byteLength;
        for(const attribute of Object.values(g.attributes)){
          assert.ok(attribute.array.every(Number.isFinite),id);bytes+=attribute.array.byteLength;
        }
        if(m.name==='Cyber / cold cast concrete'){
          concreteCount++;assert.equal(g.attributes.concreteSurface.count,g.attributes.position.count);
          assert.equal(m.vertexColors,false);assert.equal(m.map,m.bumpMap);
          assert.equal(m.map.repeat.x,1);assert.equal(m.map.offset.x,0);
          assert.ok(m.color.r===m.color.g&&m.color.g===m.color.b);
          assert.ok([...g.attributes.uv.array].some(v=>Math.abs(v)>1),`${id}: metric tiling`);
        }else{
          assert.equal(g.attributes.concreteSurface,undefined,`${id}: preserve non-concrete`);
        }
      }
      assert.equal(concreteCount,1,id);assert.equal(actualTriangles,triangles,id);
      const recorded=manifest.models.find(model=>model.id===id);
      assert.equal(bytes,recorded.geometryBytes,`${id}: manifest bytes`);
      assert.equal(recorded.drawCalls,draws);assert.equal(recorded.triangles,triangles);
    }
    assert.deepEqual(requests,['/game/props/salvage/building-atlas.webp']);
  }finally{library.dispose();T.TextureLoader.prototype.load=originalLoad;}
});

test('concrete box coordinates repeat every 2.8 metres on every face',()=>{
  const g=new T.BoxGeometry(5.6,8.4,.28);
  prepareConcreteUv(g,0,0,0);
  const uv=g.attributes.uv,surface=g.attributes.concreteSurface;
  for(const group of g.groups){
    const vertices=[...new Set(Array.from({length:group.count},(_,j)=>g.index.getX(group.start+j)))];
    const range=axis=>Math.max(...vertices.map(i=>uv.getComponent(i,axis)))-Math.min(...vertices.map(i=>uv.getComponent(i,axis)));
    assert.ok(Math.abs(range(0)-surface.getZ(vertices[0])/2.8)<1e-6);
    assert.ok(Math.abs(range(1)-surface.getW(vertices[0])/2.8)<1e-6);
  }
  g.dispose();
});

test('torn extruded slabs retain shape and use projected metric UV on caps and sides',()=>{
  const shape=new T.Shape([new T.Vector2(0,0),new T.Vector2(5.6,0),new T.Vector2(4.2,2.8),new T.Vector2(0,1.4)]);
  const g=new T.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false});
  const positions=g.attributes.position.array.slice(),normals=g.attributes.normal.array.slice();
  prepareConcreteUv(g,2,3,4);
  assert.deepEqual(g.attributes.position.array,positions);assert.deepEqual(g.attributes.normal.array,normals);
  const surface=g.attributes.concreteSurface;
  for(let i=0;i<surface.count;i++){
    assert.ok(surface.getZ(i)>0&&surface.getW(i)>0);
    assert.ok(surface.getX(i)>=-1e-6&&surface.getX(i)<=surface.getZ(i)+1e-6);
    assert.ok(surface.getY(i)>=-1e-6&&surface.getY(i)<=surface.getW(i)+1e-6);
  }
  g.dispose();
});

test('combined library owns each shared resource once and ignores a late atlas callback',()=>{
  const originalLoad=T.TextureLoader.prototype.load;
  let loaded,ready=0;
  const atlas=new T.Texture();
  T.TextureLoader.prototype.load=function(_url,callback){loaded=callback;return atlas;};
  const library=createBuildingLibrary(4,()=>ready++),resources=new Set([atlas]),counts=new Map();
  try{
    for(const asset of BUILDING_PROPS){
      const root=library.create(asset.id);library.create(asset.id);
      for(const mesh of root.children){
        resources.add(mesh.geometry);resources.add(mesh.material);
        for(const key of ['map','bumpMap','emissiveMap'])if(mesh.material[key])resources.add(mesh.material[key]);
      }
    }
    for(const resource of resources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
    library.dispose();library.dispose();loaded(atlas);
    assert.equal(ready,0);
    for(const count of counts.values())assert.equal(count,1);
    assert.throws(()=>library.create('building-workshop'),/disposed/);
  }finally{library.dispose();T.TextureLoader.prototype.load=originalLoad;}
});
