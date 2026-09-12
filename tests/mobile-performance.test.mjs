import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptMobileBudget,initialMobileBudget,mobileRenderRatio,stickVector,usesTouchProfile,MOBILE_MIN_SCALE} from '../components/expedition/mobile-performance.ts';

test('touch profile covers phones and hybrid touch devices without catching narrow mouse windows',()=>{
  assert.equal(usesTouchProfile({pointerCoarse:true,anyPointerCoarse:false,hoverNone:true,width:844,height:390}),true);
  assert.equal(usesTouchProfile({pointerCoarse:false,anyPointerCoarse:true,hoverNone:false,width:1366,height:768}),true);
  assert.equal(usesTouchProfile({pointerCoarse:false,anyPointerCoarse:false,hoverNone:true,width:932,height:430}),true);
  assert.equal(usesTouchProfile({pointerCoarse:false,anyPointerCoarse:false,hoverNone:false,width:640,height:480}),false);
});

test('joystick dead zone, radial clamp and diagonal movement are consistent',()=>{
  assert.deepEqual(stickVector(2,2,40),{x:0,z:0});
  assert.deepEqual(stickVector(40,0,40),{x:1,z:0});
  const diagonal=stickVector(200,-200,40);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-10);
  assert.ok(diagonal.x>0&&diagonal.z<0);
  assert.deepEqual(stickVector(NaN,0,40),{x:0,z:0});
});
test('warmup, isolated stalls and alternating load cannot thrash resolution',()=>{
  let state=initialMobileBudget();
  for(let i=0;i<2;i++)state=adaptMobileBudget(state,35);
  assert.equal(state.scale,1);
  for(let i=0;i<40;i++)state=adaptMobileBudget(state,i%2?16.7:40);
  assert.equal(state.scale,1);
  assert.deepEqual(adaptMobileBudget(state,NaN),state);
  assert.deepEqual(adaptMobileBudget(state,600),state);
});
test('sustained load lowers resolution gradually, respects floor, then settles at 30',()=>{
  let state=initialMobileBudget(),previous=1;
  for(let i=0;i<80;i++){
    state=adaptMobileBudget(state,36);
    assert.ok(state.scale>=MOBILE_MIN_SCALE);
    assert.ok(previous-state.scale<=.071);
    previous=state.scale;
  }
  assert.equal(state.target,30);
  assert.equal(state.scale,MOBILE_MIN_SCALE);
  for(let i=0;i<80;i++)state=adaptMobileBudget(state,16);
  assert.equal(state.target,30);
});
test('resolution recovery needs 24 seconds of headroom and stays gradual',()=>{
  let state={...initialMobileBudget(),scale:.8,cooldown:0};
  for(let i=0;i<11;i++)state=adaptMobileBudget(state,16.7);
  assert.equal(state.scale,.8);
  state=adaptMobileBudget(state,16.7);
  assert.ok(state.scale>.8&&state.scale<.84);
  assert.ok(state.cooldown>0);
});
test('portrait / landscape share a bounded render budget while CSS stays native',()=>{
  for(const [width,height] of [[390,844],[844,390],[430,932],[932,430]]){
    const ratio=mobileRenderRatio(width,height,3,1),floor=mobileRenderRatio(width,height,3,MOBILE_MIN_SCALE);
    assert.ok(width*height*ratio*ratio<=1_100_001);
    assert.ok(ratio<=1.7);
    assert.ok(floor>=.75&&floor/ratio>=MOBILE_MIN_SCALE-.001);
    assert.equal(mobileRenderRatio(height,width,3,1),ratio);
  }
});
