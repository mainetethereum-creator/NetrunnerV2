import assert from 'node:assert/strict';
import test from 'node:test';
import { partitionSpatialInstances } from '../src/renderer/environment/spatial-instances.ts';

test('spatial cells cover every placement once at negative and positive edges', () => {
  const placements = [
    [-16.001, -16], [-16, -16], [-.001, -.001], [0, 0],
    [15.999, 15.999], [16, 16], [31.999, -16], [32, -16.001],
  ];
  const cells = partitionSpatialInstances(placements, 16);
  assert.deepEqual(cells.map(({ xCell, zCell, indices }) => [xCell, zCell, indices]), [
    [-2, -1, [0]], [-1, -1, [1, 2]], [0, 0, [3, 4]],
    [1, 1, [5]], [1, -1, [6]], [2, -2, [7]],
  ]);
  assert.deepEqual(cells.flatMap(cell => cell.indices).sort((a, b) => a - b), placements.map((_, i) => i));
  assert.throws(() => partitionSpatialInstances(placements, 0), RangeError);
  assert.throws(() => partitionSpatialInstances(placements, Infinity), RangeError);
});
