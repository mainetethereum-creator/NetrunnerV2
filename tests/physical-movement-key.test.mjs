import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_CAMERA } from '../src/renderer/camera/follow-camera.ts';
import { createMovementInput } from '../src/input/movement-input.ts';
import { physicalMovementKey } from '../src/input/keyboard/physical-movement-key.ts';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} ≈ ${b}`);

test('physical WASD works in Tactical with English/Russian keys and releases across layouts', () => {
  const input=createMovementInput(), out={x:0,z:0}, azimuth=BASE_CAMERA.azimuth;
  for (const [code,key,expected] of [['KeyW','ц','w'],['KeyA','ф','a'],['KeyS','ы','s'],['KeyD','в','d']]) {
    const normalized=physicalMovementKey({code,key});
    assert.equal(normalized,expected); input.keys.add(normalized);
    assert.equal(input.resolve(out,azimuth,.12),true);
    const screenX=out.x*Math.cos(azimuth)-out.z*Math.sin(azimuth);
    const screenY=out.x*Math.sin(azimuth)+out.z*Math.cos(azimuth);
    close(screenX,expected==='a'?-1:expected==='d'?1:0);
    close(screenY,expected==='w'?-1:expected==='s'?1:0);
    input.keys.delete(physicalMovementKey({code,key:expected.toUpperCase()}));
    assert.equal(input.resolve(out,azimuth,.12),false);
  }
});

test('physical movement preserves arrows, Shift, fallback and normalized diagonal speed', () => {
  assert.equal(physicalMovementKey({code:'ArrowUp',key:'ArrowUp'}),'arrowup');
  assert.equal(physicalMovementKey({code:'',key:'W'}),'w');
  assert.equal(physicalMovementKey({code:'KeyZ',key:'w'}),null);
  assert.equal(physicalMovementKey({code:'KeyE',key:'e'}),null);
  const input=createMovementInput(), out={x:0,z:0};
  for (const [code,key] of [['KeyW','ц'],['KeyD','в'],['ShiftLeft','Shift']]) input.keys.add(physicalMovementKey({code,key}));
  input.resolve(out,BASE_CAMERA.azimuth,.12);
  close(Math.hypot(out.x,out.z),1); assert.equal(input.running,true);
  input.clear(); assert.equal(input.running,false); assert.equal(input.resolve(out,BASE_CAMERA.azimuth,.12),false);
});
