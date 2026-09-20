import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {createFrameCamera,parseCameraFrame,FRAME_CAMERA_KEY,FRAME_CAMERA_PRESET_2_KEY} from '../src/renderer/camera/frame-camera.ts';

function fixture(initial,anchor=new T.Vector3(0,1,0)){
 const data=new Map(initial?[[FRAME_CAMERA_KEY,initial]]:[]),camera=new T.PerspectiveCamera(38,1,.15,140);
 camera.position.set(12,16,25);let controls;
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const rig=createFrameCamera(camera,undefined,storage,c=>{controls=new OrbitControls(c);controls.dispose=()=>{};return controls;},anchor);
 return {rig,camera,data,controls};
}

test('frame can orbit/pan/zoom, lock its composition, restore and return to default',()=>{
 const a=fixture();assert.equal(a.rig.mode,'follow');
 a.rig.start(new T.Vector3(0,1,0));assert.equal(a.controls.enabled,true);
 a.camera.position.set(-20,25,35);a.controls.target.set(3,4,-12);a.rig.update(true);
 const position=a.camera.position.toArray(),target=a.controls.target.toArray();
 assert.ok(a.rig.fix());assert.equal(a.rig.mode,'fixed');assert.equal(a.controls.enabled,false);
 a.rig.update(true);assert.deepEqual(a.camera.position.toArray(),position);
 const b=fixture(a.data.get(FRAME_CAMERA_KEY));assert.equal(b.rig.mode,'fixed');
 assert.deepEqual(b.camera.position.toArray(),position);assert.deepEqual(b.controls.target.toArray(),target);
 b.rig.start(new T.Vector3(100,100,100));assert.deepEqual(b.controls.target.toArray(),target,'editing a locked frame does not jump to player');
 b.rig.update(false);assert.equal(b.controls.enabled,false,'modal blocks camera gestures');
 b.rig.follow();assert.equal(b.rig.mode,'follow');assert.equal(b.data.has(FRAME_CAMERA_KEY),false);
 assert.equal(b.data.has(FRAME_CAMERA_PRESET_2_KEY),true,'reset keeps Standard 2 available');
 a.rig.dispose();b.rig.dispose();
});

test('camera buttons dolly free framing and respect the same distance limits as OrbitControls',()=>{
 const a=fixture();
 a.rig.start(new T.Vector3(0,1,0));
 a.controls.target.set(0,1,0);a.camera.position.set(0,1,20);
 a.rig.zoomBy(4);assert.ok(Math.abs(a.camera.position.distanceTo(a.controls.target)-24)<1e-9,'minus button moves farther');
 a.rig.zoomBy(-8);assert.ok(Math.abs(a.camera.position.distanceTo(a.controls.target)-16)<1e-9,'plus button moves closer');
 a.rig.zoomBy(-1000);assert.ok(Math.abs(a.camera.position.distanceTo(a.controls.target)-4)<1e-9,'near limit');
 a.rig.zoomBy(1000);assert.ok(Math.abs(a.camera.position.distanceTo(a.controls.target)-100)<1e-9,'far limit');
 a.rig.fix();const fixed=a.camera.position.clone();a.rig.zoomBy(-10);
 assert.deepEqual(a.camera.position.toArray(),fixed.toArray(),'buttons only adjust the unlocked framing mode');
 a.rig.dispose();
});

test('locked framing translates with the damped player pivot, retaining angle, distance and pan on either map',()=>{
 const a=fixture();
 a.rig.start(new T.Vector3(0,1,0));
 a.camera.position.set(17,26,32);a.controls.target.set(2,3,-4);a.camera.lookAt(a.controls.target);a.rig.fix();
 const saved=a.data.get(FRAME_CAMERA_KEY),rotation=a.camera.quaternion.clone(),azimuth=a.rig.azimuth;
 for(const pivot of [new T.Vector3(4,1,7),new T.Vector3(80,6,40),new T.Vector3(0,1,0)]){
   a.rig.place(pivot);
   assert.deepEqual(a.camera.position.toArray(),[pivot.x+17,pivot.y+25,pivot.z+32]);
   assert.deepEqual(a.controls.target.toArray(),[pivot.x+2,pivot.y+2,pivot.z-4]);
   assert.ok(a.camera.quaternion.angleTo(rotation)<1e-7);
   assert.equal(a.rig.azimuth,azimuth);
 }
 const expedition=fixture(saved,new T.Vector3(12,1,36));
 assert.deepEqual(expedition.camera.position.toArray(),[29,26,68]);
 assert.deepEqual(expedition.controls.target.toArray(),[14,3,32]);
 assert.equal(expedition.rig.azimuth,azimuth);
 assert.equal(a.data.get(FRAME_CAMERA_KEY),saved,'walking never rewrites the selected frame');
 a.rig.dispose();expedition.rig.dispose();
});

test('the first saved composition becomes Standard 2 and survives later camera edits',()=>{
 const original=JSON.stringify({version:1,position:[17,26,32],target:[2,3,-4],anchor:[0,1,0]});
 const a=fixture(original,new T.Vector3(0,1,0));
 assert.equal(a.data.get(FRAME_CAMERA_PRESET_2_KEY),original,'existing owner frame is captured once');
 a.rig.start(new T.Vector3(0,1,0));
 a.camera.position.set(-9,18,21);a.controls.target.set(4,2,3);a.rig.update(true);a.rig.fix();
 assert.notEqual(a.data.get(FRAME_CAMERA_KEY),original,'normal locking may replace the active frame');
 assert.equal(a.data.get(FRAME_CAMERA_PRESET_2_KEY),original,'Standard 2 is not overwritten');
 assert.equal(a.rig.restorePreset2(new T.Vector3(10,2,20)),true);
 assert.equal(a.rig.mode,'fixed');
 assert.deepEqual(a.camera.position.toArray(),[27,27,52]);
 assert.deepEqual(a.controls.target.toArray(),[12,4,16]);
 assert.equal(a.data.get(FRAME_CAMERA_KEY),original,'restored preset becomes the active persisted frame');
 a.rig.dispose();
});

test('a fixed composition can explicitly replace the V2 preset',()=>{
 const a=fixture();a.rig.start(new T.Vector3(0,1,0));
 a.camera.position.set(13,15,21);a.controls.target.set(2,1,3);a.rig.update(true);a.rig.fix();
 assert.equal(a.rig.savePreset2(),true);
 const saved=parseCameraFrame(a.data.get(FRAME_CAMERA_PRESET_2_KEY));
 assert.ok(new T.Vector3().fromArray(saved.position).distanceTo(new T.Vector3(13,15,21))<1e-9);
 a.rig.dispose();
});

test('legacy Base world frame migrates relative to its original spawn without changing its composition',()=>{
 const saved=JSON.stringify({version:1,position:[18,24,36],target:[2,2,-4]});
 const base=fixture(saved,new T.Vector3(0,1.05,5));
 assert.deepEqual(base.camera.position.toArray(),[18,24,36]);
 assert.deepEqual(base.controls.target.toArray(),[2,2,-4]);
 const expedition=fixture(saved,new T.Vector3(10,1.05,35));
 assert.deepEqual(expedition.camera.position.toArray(),[28,24,66]);
 assert.deepEqual(expedition.controls.target.toArray(),[12,2,26]);
 base.rig.dispose();expedition.rig.dispose();
});

test('invalid persisted frames never poison the camera; storage failure still permits session locking',()=>{
 for(const text of ['{','null',JSON.stringify({version:1,position:[0,0,0],target:[0,0,0]}),JSON.stringify({version:1,position:[0,10,10000],target:[0,0,0]})])assert.equal(parseCameraFrame(text),null);
 const camera=new T.PerspectiveCamera();camera.position.set(10,10,10);
 const rig=createFrameCamera(camera,undefined,{getItem(){throw Error('blocked');},setItem(){throw Error('full');},removeItem(){}},c=>{const controls=new OrbitControls(c);controls.dispose=()=>{};return controls;});
 assert.equal(rig.mode,'follow');rig.start(new T.Vector3());assert.equal(rig.fix(),false);assert.equal(rig.mode,'fixed');rig.dispose();
});
