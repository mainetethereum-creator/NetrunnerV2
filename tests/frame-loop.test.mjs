import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameLoop} from '../src/core/loop/frame-loop.ts';

function manualPlatform(){
  let time=0,hidden=false,nextId=1;const pending=new Map(),listeners=new Set();
  return {
    platform:{now:()=>time,requestFrame(cb){const id=nextId++;pending.set(id,cb);return id;},cancelFrame(id){pending.delete(id);},isHidden:()=>hidden,onVisibilityChange(fn){listeners.add(fn);return()=>listeners.delete(fn);}},
    /** Fires every pending frame callback at time t, like a display refresh. */
    frame(t){time=t;const due=[...pending.values()];pending.clear();for(const cb of due)cb(t);},
    setHidden(value,t=time){time=t;hidden=value;for(const fn of [...listeners])fn();},
    get pending(){return pending.size;},
    get listeners(){return listeners.size;},
  };
}

// The cadence/delta code the base and expedition scenes used before the shared loop.
function legacySceneLoop(startTime,targetFps){
  let last=startTime,lastPaint=startTime;const ticks=[];
  return {ticks,frame(now){
    const target=targetFps();
    if(target){const interval=1000/target;if(now-lastPaint<interval-.8)return;lastPaint=Math.max(lastPaint+interval,now-interval);}else lastPaint=now;
    const frameMs=now-last;const dt=Math.min(frameMs/1000,.05);last=now;ticks.push([now,frameMs,dt]);
  }};
}

test('frame timing matches the legacy scene loops, including the mobile cadence cap',()=>{
  const timestamps=[];let t=100;
  for(let i=0;i<700;i++){t+=8.33+((i*7)%5-2)*.6;if(i===300)t+=220;timestamps.push(Math.round(t*100)/100);}
  for(const target of [()=>null,()=>60,()=>30,()=>(timestampsIndex<350?60:30)]){
    var timestampsIndex=0;
    const host=manualPlatform(),legacy=legacySceneLoop(50,target),ticks=[];
    createFrameLoop({platform:host.platform,startTime:50,targetFps:target,update:tick=>ticks.push([tick.now,tick.frameMs,tick.dt])}).start();
    for(const [index,stamp] of timestamps.entries()){timestampsIndex=index;host.frame(stamp);legacy.frame(stamp);}
    assert.deepEqual(ticks,legacy.ticks);
    assert.ok(ticks.length>100);
  }
});

test('stop mode pauses while hidden, resynchronises on return and does not restart after stop()',()=>{
  const host=manualPlatform(),frames=[],changes=[];
  const loop=createFrameLoop({platform:host.platform,startTime:0,update:tick=>frames.push(tick.frameMs),onVisibilityChange:now=>changes.push(now)});
  loop.start();host.frame(16);host.frame(32);
  assert.deepEqual(frames,[16,16]);
  host.setHidden(true,40);assert.equal(host.pending,0);
  host.setHidden(false,1000);assert.equal(host.pending,1);
  host.frame(1016);assert.equal(frames.at(-1),16);
  loop.stop();host.setHidden(true,1100);host.setHidden(false,1200);
  assert.equal(host.pending,0);assert.deepEqual(changes,[40,1000,1100,1200]);
  loop.dispose();assert.equal(host.listeners,0);assert.equal(loop.running,false);
});

test('skip mode keeps scheduling while hidden and measures from the last hidden frame',()=>{
  const host=manualPlatform(),frames=[];
  createFrameLoop({platform:host.platform,startTime:0,hidden:'skip',update:tick=>frames.push(tick.frameMs)}).start();
  assert.equal(host.listeners,0);
  host.frame(16);host.setHidden(true);host.frame(1000);host.frame(2000);
  assert.deepEqual(frames,[16]);assert.equal(host.pending,1);
  host.setHidden(false);host.frame(2016);assert.deepEqual(frames,[16,16]);
});

test('fixed steps run before update and render, are capped, and report interpolation alpha',()=>{
  const host=manualPlatform(),order=[];let alpha=-1;
  createFrameLoop({platform:host.platform,startTime:0,maxDeltaSeconds:1,fixedStepSeconds:.1,maxFixedSteps:3,
    fixedUpdate:()=>order.push('fixed'),update:()=>order.push('update'),render:tick=>{order.push('render');alpha=tick.alpha;}}).start();
  host.frame(250);
  assert.deepEqual(order,['fixed','fixed','update','render']);assert.ok(Math.abs(alpha-.5)<1e-6,String(alpha));
  order.length=0;host.frame(1250);
  assert.equal(order.filter(o=>o==='fixed').length,3);assert.ok(alpha>=0&&alpha<1);
});

test('an exception in a phase does not stop the loop',()=>{
  const host=manualPlatform();
  createFrameLoop({platform:host.platform,startTime:0,update:()=>{throw new Error('boom');}}).start();
  assert.throws(()=>host.frame(16),/boom/);assert.equal(host.pending,1);
});
