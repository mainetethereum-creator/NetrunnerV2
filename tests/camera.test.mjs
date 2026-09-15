// The shared follow camera must reproduce the per-scene camera code bit for bit.
// The legacy functions below are copied from base, expedition and metro scene.ts
// as they were before step 4 (three.js Vector3 arithmetic).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BASE_CAMERA,EXPEDITION_CAMERA,METRO_CAMERA,createFollowCamera} from '../src/renderer/camera/follow-camera.ts';

function random(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function scenario(seed,steps){
  const rnd=random(seed),player={x:31,y:0,z:74};const frames=[];
  const aspects=[0.46,0.84999,0.85,0.85001,1.33,1.78,2.4];
  for(let i=0;i<steps;i++){
    const r=rnd();
    if(r<0.02){player.x=rnd()*160-8;player.z=rnd()*90-8;}
    else{player.x+=(rnd()-.5)*0.4;player.z+=(rnd()-.5)*0.4;}
    player.y=rnd()<0.3?rnd()*2:player.y;
    frames.push({
      player:{...player},
      dt:rnd()<0.05?0:rnd()<0.1?0.05:rnd()*0.05,
      reduced:rnd()<0.08,
      editor:i%400>320,
      aspect:aspects[Math.floor(rnd()*aspects.length)],
      wheel:rnd()<0.2?(rnd()-.5)*400:0,
      dx:rnd()*2-1,dz:rnd()*2-1,
      nudge:rnd()<0.03?{x:(rnd()-.5)*20,z:(rnd()-.5)*20}:null,
      moveTo:rnd()<0.01?{x:rnd()*144,z:rnd()*72}:null,
      reset:rnd()<0.02,
    });
  }
  return frames;
}

const same=(a,b,label)=>{for(const k of ['x','y','z'])assert.ok(Object.is(a[k],b[k]),`${label}.${k}: ${a[k]} !== ${b[k]}`);};

test('base camera is bit-identical to the legacy base scene code',()=>{
  // legacy (components/base/scene.ts before step 4)
  const azimuth=0.48,lp=new T.Vector3(31.5,1.05,74),desiredPivot=lp.clone(),lc=new T.Vector3();let editorZoom=28;
  // new
  const np=new T.Vector3(31.5,1.05,74),rig=createFollowCamera(BASE_CAMERA,np),nc=new T.Vector3();
  scenario(1,6000).forEach((f,i)=>{
    const p=f.player;
    if(f.editor)editorZoom=T.MathUtils.clamp(editorZoom+f.wheel*.015,8,65);
    if(f.editor)rig.zoomBy(f.wheel);
    const portrait=f.aspect<0.85;
    if(!f.editor)desiredPivot.set(p.x,p.y+0.93,p.z);else desiredPivot.copy(lp);
    lp.lerp(desiredPivot,f.reduced?1:1-Math.exp(-f.dt*8));
    if(lp.distanceToSquared(desiredPivot)<0.000001)lp.copy(desiredPivot);
    const distance=f.editor?editorZoom:portrait?32:25;
    lc.set(lp.x+Math.sin(azimuth)*distance*0.86,lp.y+distance*0.62,lp.z+Math.cos(azimuth)*distance*0.86);
    if(!f.editor)rig.follow(p.x,p.y+0.93,p.z,f.dt,f.reduced);else rig.follow(np.x,np.y,np.z,f.dt,f.reduced);
    rig.place(nc,f.aspect,f.editor);
    same(np,lp,`pivot#${i}`);same(nc,lc,`camera#${i}`);
    if(f.reset){lp.copy(desiredPivot);rig.snapToTarget();same(np,lp,`reset#${i}`);}
  });
  assert.equal(rig.azimuth,azimuth);
});

test('expedition camera is bit-identical to the legacy expedition scene code, including MASTER pan, zoom and tree editor moves',()=>{
  const azimuth=.48,lp=new T.Vector3(31,1,74),followTarget=new T.Vector3(),lc=new T.Vector3();let editorZoom=22;
  const np=new T.Vector3(31,1,74),rig=createFollowCamera(EXPEDITION_CAMERA,np),nc=new T.Vector3();
  scenario(2,6000).forEach((f,i)=>{
    const p=f.player;
    if(f.editor){editorZoom=T.MathUtils.clamp(editorZoom+f.wheel*.015,5,42);rig.zoomBy(f.wheel);}
    if(f.editor){lp.x=T.MathUtils.clamp(lp.x+f.dx*f.dt*12,0,144);lp.z=T.MathUtils.clamp(lp.z+f.dz*f.dt*12,0,72);rig.pan(f.dx,f.dz,f.dt);}
    if(!f.editor)lp.lerp(followTarget.set(p.x,p.y+1,p.z),f.reduced?1:1-Math.exp(-f.dt*8));
    const distance=f.editor?editorZoom:f.aspect<.85?28:22;
    lc.set(lp.x+Math.sin(azimuth)*distance*.86,lp.y+distance*.62,lp.z+Math.cos(azimuth)*distance*.86);
    if(!f.editor)rig.follow(p.x,p.y+1,p.z,f.dt,f.reduced);
    rig.place(nc,f.aspect,f.editor);
    same(np,lp,`pivot#${i}`);same(nc,lc,`camera#${i}`);
    if(f.nudge){lp.x=T.MathUtils.clamp(lp.x+f.nudge.x,0,144);lp.z=T.MathUtils.clamp(lp.z+f.nudge.z,0,72);rig.nudge(f.nudge.x,f.nudge.z);same(np,lp,`nudge#${i}`);}
    if(f.moveTo){lp.x=f.moveTo.x;lp.z=f.moveTo.z;rig.moveTo(f.moveTo.x,f.moveTo.z);same(np,lp,`moveTo#${i}`);}
  });
});

test('metro camera is bit-identical to the legacy metro scene code',()=>{
  const azimuth=.48,lp=new T.Vector3(4,1,6),lc=new T.Vector3();
  const np=new T.Vector3(4,1,6),rig=createFollowCamera(METRO_CAMERA,np),nc=new T.Vector3();
  scenario(3,6000).forEach((f,i)=>{
    const p=f.player;
    lp.lerp(new T.Vector3(p.x,1,p.z),f.reduced?1:1-Math.exp(-f.dt*8));
    const distance=f.aspect<.85?28:22;
    lc.set(lp.x+Math.sin(azimuth)*distance*.86,lp.y+distance*.62,lp.z+Math.cos(azimuth)*distance*.86);
    rig.follow(p.x,1,p.z,f.dt,f.reduced);rig.zoomBy(f.wheel);rig.pan(f.dx,f.dz,f.dt);
    rig.place(nc,f.aspect,false);
    same(np,lp,`pivot#${i}`);same(nc,lc,`camera#${i}`);
  });
});

test('presets: distances, portrait threshold and editor capabilities',()=>{
  const rig=createFollowCamera(BASE_CAMERA,{x:0,y:0,z:0});
  assert.equal(rig.distance(0.84,false),32);assert.equal(rig.distance(0.85,false),25);assert.equal(rig.distance(1.7,true),28);
  rig.zoomBy(1e6);assert.equal(rig.zoom,65);rig.zoomBy(-1e6);assert.equal(rig.zoom,8);
  const pivot={x:5,y:1,z:5};createFollowCamera(BASE_CAMERA,pivot).pan(1,1,1);assert.deepEqual(pivot,{x:5,y:1,z:5});
  const metro=createFollowCamera(METRO_CAMERA,{x:0,y:1,z:0});
  assert.equal(metro.distance(1.7,true),22);assert.equal(metro.distance(0.5,true),28);
  const exp=createFollowCamera(EXPEDITION_CAMERA,{x:140,y:1,z:70});exp.nudge(10,10);assert.deepEqual(exp.pivot,{x:144,y:1,z:72});
});
