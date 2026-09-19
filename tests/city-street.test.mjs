import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { CITY_STREET, TRAFFIC_PERIOD, trafficVehicles, trafficPose } from '../src/renderer/environment/city-traffic-layout.ts';
import { createVehicleGeometry } from '../src/renderer/environment/city-vehicles.ts';
import { createCityStreet } from '../src/renderer/environment/city-street.ts';

test('opposing traffic stays in lanes with safe headway, including the loop seam', () => {
  for (const mobile of [false, true]) {
    const vehicles = trafficVehicles(mobile);
    for (const time of [0, 3.5, 30, TRAFFIC_PERIOD - .01, 9000]) {
      for (const lane of [0, 1]) {
        const poses = vehicles.filter(vehicle => vehicle.lane === lane).map(vehicle => trafficPose(vehicle, time));
        poses.sort((a, b) => a.x - b.x);
        for (const [index, pose] of poses.entries()) {
          assert.equal(pose.z, CITY_STREET.lanes[lane].z);
          assert.equal(pose.yaw, lane ? Math.PI : 0);
          assert.ok(pose.x >= -CITY_STREET.halfLength && pose.x < CITY_STREET.halfLength);
          const next = poses[(index + 1) % poses.length].x + (index === poses.length - 1 ? CITY_STREET.halfLength * 2 : 0);
          assert.ok(next - pose.x > 21, 'even two 9.2 m buses cannot overlap');
          assert.ok(pose.z - 1.65 > CITY_STREET.roadNorth && pose.z + 1.65 < CITY_STREET.roadSouth);
        }
      }
    }
    for (const vehicle of vehicles) {
      const start = trafficPose(vehicle, 0), end = trafficPose(vehicle, TRAFFIC_PERIOD);
      assert.ok(Math.abs(start.x - end.x) < 1e-9);
      assert.deepEqual(trafficPose(vehicle, NaN), start);
      const a = trafficPose(vehicle, 1), b = trafficPose(vehicle, 1.1);
      assert.ok(Math.abs(b.x - a.x - .1 * CITY_STREET.lanes[vehicle.lane].speed * CITY_STREET.lanes[vehicle.lane].direction) < 1e-9);
    }
  }
});

test('vehicle shells have finite geometry and fit within real street lanes', () => {
  for (const kind of ['sedan', 'taxi', 'bus']) {
    const geometry = createVehicleGeometry(kind);
    const bounds = new T.Box3();
    let triangles = 0;
    for (const buffer of geometry.values()) {
      bounds.union(buffer.boundingBox);
      triangles += buffer.attributes.position.count / 3;
      for (const attribute of Object.values(buffer.attributes)) {
        assert.ok([...attribute.array].every(Number.isFinite));
      }
      buffer.dispose();
    }
    const size = bounds.getSize(new T.Vector3());
    assert.ok(size.x >= 4.5 && size.x < 10);
    assert.ok(size.z >= 1.9 && size.z < 3.25, 'including bus mirrors');
    assert.ok(size.y > 1.6 && size.y < 3.3);
    assert.ok(bounds.min.y >= -1e-6, 'tires rest on the road');
    assert.ok(triangles < 3000 && geometry.size <= 9, 'bounded cost per instanced kind');
  }
});

test('street uses the caller clock, freezes without jumps and releases all GPU resources once', () => {
  const scene = new T.Scene();
  const street = createCityStreet(scene, false);
  const car = street.root.getObjectByName('City traffic / sedan / paint');
  const matrix = () => { const value = new T.Matrix4(); car.getMatrixAt(0, value); return value.elements.slice(); };
  const before = matrix();
  street.update(1 / 60);
  const after = matrix();
  assert.notDeepEqual(after, before);
  for (const dt of [0, -1, NaN, Infinity]) street.update(dt);
  assert.deepEqual(matrix(), after);
  street.update(1 / 60);
  assert.ok(Math.abs(matrix()[12] - after[12] - .125) < .0001);
  const resources = new Set();
  street.root.traverse(object => {
    if (object instanceof T.InstancedMesh || object instanceof T.Light) resources.add(object);
    if (!(object instanceof T.Mesh)) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof T.Texture) resources.add(value);
    }
  });
  const counts = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  street.dispose();
  street.dispose();
  street.update(1 / 60);
  assert.equal(scene.children.length, 0);
  assert.ok([...counts.values()].every(count => count === 1));
});

test('traffic motion is frame-rate independent and mobile has fewer instances/lights', () => {
  const positions = [];
  for (const fps of [30, 60, 144]) {
    const street = createCityStreet(new T.Scene(), false);
    for (let index = 0; index < fps * 2; index++) street.update(1 / fps);
    const matrix = new T.Matrix4();
    street.root.getObjectByName('City traffic / sedan / paint').getMatrixAt(0, matrix);
    positions.push(matrix.elements[12]);
    street.dispose();
  }
  assert.ok(Math.max(...positions) - Math.min(...positions) < .0001);
  const mobile = createCityStreet(new T.Scene(), true);
  assert.ok(trafficVehicles(true).length < trafficVehicles(false).length);
  let lights = 0;
  mobile.root.traverse(object => { if (object instanceof T.Light) lights++; });
  assert.equal(lights, 0);
  mobile.dispose();
});

test('city replacement preserves the live owner map and all four added buildings', () => {
  const read = path => JSON.parse(readFileSync(new URL(`../output/map-backups/${path}`, import.meta.url), 'utf8'));
  const before = read('base-before-city-traffic-2026-09-19.json');
  const after = read('base-with-city-traffic-2026-09-19.json');
  const manifest = read('outskirts-additions-2026-09-19.json');
  const removed = new Set(manifest.filter(entry => entry.id.startsWith('prop:outskirts-') && !entry.source.startsWith('building-')).map(entry => entry.id));
  assert.equal(before.entries.length - after.entries.length, 20);
  assert.deepEqual(after.entries, before.entries.filter(entry => !removed.has(entry.id)));
  assert.equal(after.entries.filter(entry => entry.id.startsWith('prop:outskirts-') && entry.source.startsWith('building-')).length, 4);
});
