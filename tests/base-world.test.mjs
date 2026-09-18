import test from 'node:test';
import assert from 'node:assert/strict';
import { canStand, findPath, moveWithCollision, nearestStation, SPAWN, STATIONS, COLLIDERS, LIMIT, BASE_NORTH } from '../components/base/world.ts';
import { railPierFootprints } from '../src/renderer/environment/elevated-rail-layout.ts';

test('expanded city pad is reachable far to both sides and behind the buildings', () => {
  assert.ok(LIMIT.x > 31);
  assert.ok(BASE_NORTH < -41);
  for (const x of [-30, 30]) {
    assert.ok(findPath(SPAWN, { x, z: 7 }).length);
  }
  for (const point of [{x:-30,z:-40},{x:30,z:-40},{x:17,z:-30}]) assert.ok(findPath(SPAWN,point).length);
});

test('north extension is reachable and stops at the platform edge',()=>{
  for(const point of [{x:0,z:-15},{x:-5,z:-35},{x:25,z:-35}]){
    const path=findPath(SPAWN,point);assert.ok(path.length);
    assert.ok(path.every(p=>canStand(p)));
  }
  for(const point of [{x:0,z:-42},{x:0,z:BASE_NORTH-.1},{x:32,z:-18}]){
    assert.equal(canStand(point),false);assert.deepEqual(findPath(SPAWN,point),[]);
  }
  const end=moveWithCollision({x:-3,z:-35},0,-20);
  assert.ok(end.z>BASE_NORTH&&end.z<-40);assert.ok(canStand(end));
});

test('rail pier feet block walking while the passage under the span stays open',()=>{
  const pier=railPierFootprints().find(rect=>rect.x>1&&rect.x<3);
  assert.ok(pier,'the rear support exists behind the two towers');
  const start={x:pier.x,z:pier.z+5};
  const destination={x:pier.x,z:pier.z-5};
  assert.equal(canStand(pier),false);
  assert.equal(canStand({x:22.1233,z:-5.7246}),true,'the old reference support must not retain a ghost obstacle');
  assert.equal(canStand({x:13.4,z:-2}),true,'the rejected plaza-side bend leaves no support obstacle');
  const path=findPath(start,destination);
  assert.ok(path.length);assert.ok(path.every(p=>canStand(p)));
  assert.ok(path.some(p=>Math.abs(p.x-pier.x)>pier.w/2));
  const stop=moveWithCollision(start,0,-10);
  assert.ok(stop.z>pier.z+pier.d/2);assert.ok(canStand(stop));
  const eastApproach={x:27.3,z:3.5};
  assert.ok(findPath(SPAWN,eastApproach).length,'the east support leaves the route toward metro and the annex open');
});

test('spawn and every interaction approach are reachable', () => {
  assert.equal(canStand(SPAWN), true);
  for (const station of STATIONS) {
    const approach = { x: station.x, z: station.z + 1 };
    const path = findPath(SPAWN, approach);
    assert.ok(path.length, `${station.id} needs a route`);
    assert.ok(path.every((p) => canStand(p)));
    assert.equal(nearestStation(approach)?.id, station.id);
  }
});

test('walls and props remain solid even with a large movement step', () => {
  for (const collider of COLLIDERS) assert.equal(canStand(collider), false);
  const end = moveWithCollision({ x: 2, z: -4 }, 0, -20);
  assert.ok(end.z > -7);
  assert.ok(canStand(end));
});

test('click path goes around the planter without clipping diagonal corners', () => {
  const path = findPath({ x: -5.4, z: 3 }, { x: -5.4, z: -3 });
  assert.ok(path.length);
  let previous = { x: -5.4, z: 3 };
  for (const point of path) {
    for (let t = 0; t <= 1; t += 0.05) {
      assert.ok(canStand({ x: previous.x + (point.x - previous.x) * t, z: previous.z + (point.z - previous.z) * t }));
    }
    previous = point;
  }
});

test('invalid and blocked click destinations are rejected', () => {
  for (const p of [{ x: NaN, z: 0 }, { x: 100, z: 0 }, { x: -8.4, z: -8.6 }]) {
    assert.equal(canStand(p), false); assert.deepEqual(findPath(SPAWN, p), []);
  }
  assert.equal(nearestStation(SPAWN), null);
});

test('quantum annex and wide expedition breach are reachable while their edges remain solid', () => {
  for (const p of [{x:26,z:7.5}, {x:16,z:7.5}, {x:21,z:5.5}, {x:21,z:9.5}]) assert.ok(findPath(SPAWN,p).length);
  for (const p of [{x:19,z:4.8}, {x:19,z:10.2}, {x:26,z:5.1}]) assert.equal(canStand(p),false);
  assert.ok(canStand({x:30,z:7.5}),'the expanded east lot continues beyond the old annex');
  const end = moveWithCollision({x:19,z:7.5},0,-10);
  assert.ok(end.z > 4.8); assert.ok(canStand(end));
});

test('expanded west and east lots are buildable while the outer void stays closed', () => {
  for (const point of [{ x: -30, z: -1.5 }, { x: -20.5, z: -1.5 }, {x:30,z:-20}]) assert.ok(findPath(SPAWN,point).length);
  for (const point of [{x:-33,z:0},{x:33,z:0},{x:0,z:-43}]) assert.equal(canStand(point),false);
  assert.deepEqual(STATIONS.map(s => s.id).sort(), ['charge', 'city', 'contracts', 'expedition', 'market', 'metro', 'oracle', 'smith', 'stash']);
});
