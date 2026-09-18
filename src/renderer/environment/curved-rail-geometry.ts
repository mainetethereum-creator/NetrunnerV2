import * as T from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type RouteSample = { x: number; z: number; yaw: number };

/** Split long Blender faces before bending. A single eight-metre edge would
 * otherwise cut across the curve while sleepers and lamps followed it. */
export function subdivideRailSpan(source: T.BufferGeometry, step = 1): T.BufferGeometry {
  const attributes = Object.entries(source.attributes);
  const offsets: number[] = [];
  let stride = 0;
  for (const [, attribute] of attributes) {
    offsets.push(stride);
    stride += attribute.itemSize;
  }
  const positionOffset = offsets[attributes.findIndex(([name]) => name === 'position')];
  const output: number[] = [];
  const indices: number[] = [];
  const read = (index: number) => attributes.flatMap(([, attribute]) =>
    Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(index, component)));
  const clip = (polygon: number[][], boundary: number, above: boolean) => {
    const result: number[][] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const da = a[positionOffset] - boundary, db = b[positionOffset] - boundary;
      const insideA = above ? da >= -1e-8 : da <= 1e-8;
      const insideB = above ? db >= -1e-8 : db <= 1e-8;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = da / (da - db);
        result.push(a.map((value, component) => value + (b[component] - value) * t));
      }
    }
    return result;
  };
  const count = source.index?.count ?? source.attributes.position.count;
  for (let triangle = 0; triangle < count; triangle += 3) {
    const points = [0, 1, 2].map(offset => read(source.index?.getX(triangle + offset) ?? triangle + offset));
    const min = Math.min(...points.map(point => point[positionOffset]));
    const max = Math.max(...points.map(point => point[positionOffset]));
    const first = Math.floor((min + 1e-7) / step);
    const last = Math.max(first, Math.ceil((max - 1e-7) / step) - 1);
    for (let cell = first; cell <= last; cell++) {
      const polygon = clip(clip(points, cell * step, true), (cell + 1) * step, false);
      if (polygon.length < 3) continue;
      const base = output.length / stride;
      for (const vertex of polygon) output.push(...vertex);
      for (let i = 1; i + 1 < polygon.length; i++) indices.push(base, base + i, base + i + 1);
    }
  }
  const geometry = new T.BufferGeometry();
  for (let i = 0; i < attributes.length; i++) {
    const [name, attribute] = attributes[i];
    const array = new Float32Array(output.length / stride * attribute.itemSize);
    for (let vertex = 0; vertex < output.length / stride; vertex++) {
      for (let component = 0; component < attribute.itemSize; component++) {
        array[vertex * attribute.itemSize + component] = output[vertex * stride + offsets[i] + component];
      }
    }
    geometry.setAttribute(name, new T.BufferAttribute(array, attribute.itemSize));
  }
  geometry.setIndex(indices);
  geometry.normalizeNormals();
  const merged = mergeVertices(geometry, 1e-5);
  geometry.dispose();
  return merged;
}

/** Bake all spans of one material into one curved mesh, retaining a small draw
 * count. Every joint samples the same arc distance, so rails and edges meet. */
export function curveRailSpans(
  source: T.BufferGeometry,
  centres: readonly number[],
  height: number,
  sample: (distance: number) => RouteSample,
): T.BufferGeometry {
  // A two-metre chord deviates by only ~2 cm on the 24 m bend. Keep the
  // continuous silhouette without multiplying this low-poly kit unnecessarily.
  const segment = subdivideRailSpan(source, 2);
  const vertexCount = segment.attributes.position.count;
  const geometry = new T.BufferGeometry();
  for (const [name, attribute] of Object.entries(segment.attributes)) {
    const array = new Float32Array(vertexCount * centres.length * attribute.itemSize);
    for (let span = 0; span < centres.length; span++) {
      for (let vertex = 0; vertex < vertexCount; vertex++) {
        const pose = sample(centres[span] + segment.attributes.position.getX(vertex));
        const sin = Math.sin(pose.yaw), cos = Math.cos(pose.yaw);
        for (let component = 0; component < attribute.itemSize; component++) {
          let value = attribute.getComponent(vertex, component);
          if (name === 'position') {
            const lateral = attribute.getZ(vertex);
            value = component === 0 ? pose.x + lateral * sin
              : component === 1 ? value + height : pose.z + lateral * cos;
          } else if (name === 'normal' || name === 'tangent') {
            if (component === 0) value = attribute.getX(vertex) * cos + attribute.getZ(vertex) * sin;
            else if (component === 2) value = -attribute.getX(vertex) * sin + attribute.getZ(vertex) * cos;
          }
          array[(span * vertexCount + vertex) * attribute.itemSize + component] = value;
        }
      }
    }
    geometry.setAttribute(name, new T.BufferAttribute(array, attribute.itemSize));
  }
  const indices: number[] = [];
  for (let span = 0; span < centres.length; span++) {
    for (let index = 0; index < segment.index!.count; index++) {
      indices.push(span * vertexCount + segment.index!.getX(index));
    }
  }
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  segment.dispose();
  return geometry;
}
