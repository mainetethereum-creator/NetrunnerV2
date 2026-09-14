import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovementInput} from '../src/input/movement-input.ts';
import {EDITOR_PAN_KEYS,MOVE_KEYS} from '../src/input/keyboard/move-keys.ts';
import {stickVector} from '../src/input/touch/stick-vector.ts';
import {stickVector as legacyExport} from '../components/expedition/mobile-performance.ts';

// The movement code the base, expedition and metro scenes used before src/input.
function legacyMove(keys,stick,azimuth,deadZone,qIsBack=false){
  let sx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x;
  let sy=((keys.has('s')||qIsBack&&keys.has('q'))||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.y;
  const length=Math.hypot(sx,sy);
  if(length>deadZone){sx/=Math.max(1,length);sy/=Math.max(1,length);return {moving:true,x:sx*Math.cos(azimuth)+sy*Math.sin(azimuth),z:-sx*Math.sin(azimuth)+sy*Math.cos(azimuth)};}
  return {moving:false};
}

const KEY_POOL=['w','a','s','d','arrowup','arrowleft','q','shift'];
const STICKS=[[0,0],[.05,.05],[.1,0],[0,.11],[.3,-.2],[-.7,.7],[1,1],[-1,0],[.999,-.001]];

test('camera-relative direction is bit-identical to the legacy scene formula',()=>{
  let compared=0;
  for(let mask=0;mask<1<<KEY_POOL.length;mask++){
    const held=KEY_POOL.filter((_,i)=>mask&1<<i);
    for(const [x,y] of STICKS)for(const deadZone of [.12,.1])for(const editor of [false,true]){
      const input=createMovementInput();held.forEach(k=>input.keys.add(k));input.setStick(x,y);
      const out={x:NaN,z:NaN};
      const moving=input.resolve(out,.48,deadZone,editor?EDITOR_PAN_KEYS:MOVE_KEYS);
      const legacy=legacyMove(new Set(held),{x,y},.48,deadZone,editor);
      assert.equal(moving,legacy.moving);
      if(moving){assert.equal(out.x,legacy.x);assert.equal(out.z,legacy.z);}else{assert.ok(Number.isNaN(out.x));}
      compared++;
    }
  }
  assert.ok(compared>5000);
});

test('Q counts as back only for editor panning bindings',()=>{
  const input=createMovementInput();input.keys.add('q');
  const out={x:0,z:0};
  assert.equal(input.resolve(out,.48,.1),false);
  assert.equal(input.resolve(out,.48,.1,EDITOR_PAN_KEYS),true);
});

test('stick values are clamped, non-finite values become zero, clear resets everything',()=>{
  const input=createMovementInput();
  input.setStick(3,-Infinity);assert.deepEqual(input.stick,{x:1,y:0});
  input.setStick(NaN,-.4);assert.deepEqual(input.stick,{x:0,y:-.4});
  input.keys.add('shift');assert.equal(input.running,true);
  input.clear();assert.deepEqual(input.stick,{x:0,y:0});assert.equal(input.keys.size,0);assert.equal(input.running,false);
  input.setStick(.5,.5);input.clearStick();assert.deepEqual(input.stick,{x:0,y:0});
});

test('stickVector moved to src/input and is still exported from mobile-performance',()=>{
  assert.equal(legacyExport,stickVector);
  assert.deepEqual(stickVector(0,0,40),{x:0,z:0});
  const v=stickVector(30,40,40);assert.ok(Math.abs(Math.hypot(v.x,v.z)-1)<1e-9);
});
