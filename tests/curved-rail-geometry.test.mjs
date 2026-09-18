import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { curveRailSpans, subdivideRailSpan } from '../src/renderer/environment/curved-rail-geometry.ts';
import { RAIL_BEND, sampleRailRoute } from '../src/renderer/environment/elevated-rail-layout.ts';

test('long deck faces are cut into metre sections while retaining interpolated attributes', () => {
  const source = new T.BoxGeometry(8, .4, 4);
  const positions = source.attributes.position;
  source.setAttribute('metres', new T.Float32BufferAttribute(
    Array.from({ length: positions.count }, (_, index) => positions.getX(index)), 1));
  const section = subdivideRailSpan(source);
  for (let index = 0; index < section.index.count; index += 3) {
    const xs = [0, 1, 2].map(offset => section.attributes.position.getX(section.index.getX(index + offset)));
    assert.ok(Math.max(...xs) - Math.min(...xs) <= 1.00001);
  }
  for (let index = 0; index < section.attributes.position.count; index++) {
    assert.ok(Math.abs(section.attributes.metres.getX(index) - section.attributes.position.getX(index)) < 1e-6);
  }
  section.dispose(); source.dispose();
});

test('adjacent warped spans meet at the same rail edges across the approach/arc join', () => {
  const source = new T.BoxGeometry(8, .4, 4);
  const left = curveRailSpans(source, [RAIL_BEND.start - 4], 13.2, sampleRailRoute);
  const right = curveRailSpans(source, [RAIL_BEND.start + 4], 13.2, sampleRailRoute);
  const pose = sampleRailRoute(RAIL_BEND.start);
  for (const lateral of [-2, 2]) for (const y of [13, 13.4]) {
    const expected = new T.Vector3(pose.x + lateral * Math.sin(pose.yaw), y, pose.z + lateral * Math.cos(pose.yaw));
    for (const geometry of [left, right]) {
      let nearest = Infinity;
      const point = new T.Vector3();
      for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) {
        point.fromBufferAttribute(geometry.attributes.position, vertex);
        nearest = Math.min(nearest, point.distanceTo(expected));
      }
      assert.ok(nearest < 1e-5, 'both spans share an exact edge, without curve gaps');
      for (const attribute of Object.values(geometry.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite));
    }
  }
  left.dispose(); right.dispose(); source.dispose();
});
