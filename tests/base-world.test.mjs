import test from 'node:test';
import assert from 'node:assert/strict';
import { canStand, findPath, moveWithCollision, nearestStation, SPAWN, STATIONS, COLLIDERS, LIMIT } from '../components/base/world.ts';

test('expanded base adds 30 percent area and reachable side space', () => {
  assert.ok(Math.abs(LIMIT.x * LIMIT.z / (12.5 * 9.4) - 1.3) < 1e-10);
  for (const x of [-13.5, 13.5]) {
    assert.ok(findPath(SPAWN, { x, z: 7 }).length);
  }
  assert.ok(findPath(SPAWN, { x: 0, z: 10 }).length);
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
  for (const p of [{x:19,z:4.8}, {x:19,z:10.2}, {x:30,z:7.5}, {x:26,z:5.1}]) assert.equal(canStand(p),false);
  const end = moveWithCollision({x:19,z:7.5},0,-10);
  assert.ok(end.z > 4.8); assert.ok(canStand(end));
});
