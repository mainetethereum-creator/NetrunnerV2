import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import * as T from 'three';
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('.')&&context.parentURL&&!/\.[a-z]+$/i.test(specifier)){
  const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context);
 }
 return next(specifier,context);
}});
const {buildConcretePerimeter}=await import('../components/base/fence.ts');
const {courtyardFloorGeometry}=await import('../components/base/metro.ts');
const {FLOOR_EAST,FLOOR_NORTH,FLOOR_SOUTH,FLOOR_WEST}=await import('../components/base/layout.ts');

test('expanded pavement is solid across the old metro pit and new city pad',()=>{
 const geometry=courtyardFloorGeometry(),mesh=new T.Mesh(geometry,new T.MeshBasicMaterial());
 mesh.rotation.x=-Math.PI/2;mesh.updateMatrixWorld(true);
 const ray=new T.Raycaster();
 const hits=(x,z)=>{ray.set(new T.Vector3(x,5,z),new T.Vector3(0,-1,0));return ray.intersectObject(mesh).length;};
 for(const [x,z] of [[8,-8],[-30,-40],[30,-40],[-30,10],[30,10],[0,5]]) assert.ok(hits(x,z),`${x},${z} is tiled`);
 assert.equal(hits(FLOOR_WEST-.1,0),0);assert.equal(hits(FLOOR_EAST+.1,0),0);
 assert.equal(hits(0,FLOOR_NORTH-.1),0);assert.equal(hits(0,FLOOR_SOUTH+.1),0);
 geometry.dispose();mesh.material.dispose();
});

test('only the retained front fence line is generated',()=>{
 const scene=new T.Scene(),concrete=new T.MeshBasicMaterial(),steel=new T.MeshBasicMaterial(),walls=new Map();
 buildConcretePerimeter(scene,concrete,steel,(id,_name,build)=>{
  const start=scene.children.length;build();
  const bounds=new T.Box3();scene.children.slice(start).forEach(o=>bounds.expandByObject(o));walls.set(id,bounds);
 });
 assert.deepEqual([...walls.keys()],['base:wall:-14.8:11.35:14.8:11.35']);
 const front=walls.values().next().value;
 assert.ok(Math.abs(front.getCenter(new T.Vector3()).z-11.35)<.1);
 assert.ok(front.min.x< -14.7&&front.max.x>14.7);
 scene.traverse(o=>o.geometry?.dispose());concrete.dispose();steel.dispose();
});
