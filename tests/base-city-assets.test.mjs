import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';

const KIT_PATH = new URL('../public/base/models/implants-building.glb', import.meta.url);
const JSON_CHUNK = 0x4e4f534a;
const TRIANGLES = 4;

function readGlb(url) {
  const bytes = readFileSync(url);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'GLB magic');
  assert.equal(bytes.readUInt32LE(4), 2, 'GLB version');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB declared length');

  let offset = 12;
  let json;
  while (offset < bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === JSON_CHUNK) {
      json = JSON.parse(chunk.toString('utf8').replace(/[\u0000\s]+$/, ''));
    }
    offset += 8 + chunkLength;
  }
  assert.equal(offset, bytes.length, 'GLB chunks consume the file');
  assert.ok(json, 'GLB contains a JSON chunk');
  return json;
}

function assertFiniteBounds(accessor, label) {
  assert.ok(Array.isArray(accessor.min) && Array.isArray(accessor.max), `${label} has bounds`);
  assert.equal(accessor.min.length, accessor.max.length, `${label} bound dimensions match`);
  for (const [index, min] of accessor.min.entries()) {
    const max = accessor.max[index];
    assert.ok(Number.isFinite(min), `${label}.min[${index}] is finite`);
    assert.ok(Number.isFinite(max), `${label}.max[${index}] is finite`);
    assert.ok(min <= max, `${label}.min[${index}] <= max[${index}]`);
  }
}

function triangleCount(gltf) {
  let total = 0;
  for (const [meshIndex, mesh] of (gltf.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      const mode = primitive.mode ?? TRIANGLES;
      const position = gltf.accessors?.[primitive.attributes?.POSITION];
      assert.ok(position, `mesh ${meshIndex} primitive ${primitiveIndex} has POSITION`);
      const index = primitive.indices === undefined ? null : gltf.accessors?.[primitive.indices];
      const count = index?.count ?? position.count;
      assert.ok(Number.isInteger(count) && count >= 0, `mesh ${meshIndex} primitive ${primitiveIndex} count`);

      if (mode === TRIANGLES) total += Math.floor(count / 3);
      else if (mode === 5 || mode === 6) total += Math.max(0, count - 2);
      else if (mode === 0 || mode === 1 || mode === 2 || mode === 3) continue;
      else assert.fail(`mesh ${meshIndex} primitive ${primitiveIndex} has unknown mode ${mode}`);
    }
  }
  return total;
}

const gltf = readGlb(KIT_PATH);

test('retained asset contains only the selected Implants building and finite bounds', () => {
  const roots = new Set(
    (gltf.scenes ?? []).flatMap(scene => scene.nodes ?? []).map(index => gltf.nodes?.[index]?.name),
  );
  assert.deepEqual([...roots], ['Implants']);
  assert.ok(gltf.nodes.every(node => !/Armory|Noodle|Apartment|Train/.test(node.name ?? '')));
  // Keep a resolvable core fallback as well as the WebP extension image; mere
  // geometry/byte budgets do not catch broken runtime texture references.
  for (const texture of gltf.textures ?? []) {
    const image = gltf.images?.[texture.source];
    assert.ok(image, 'core texture source resolves to an embedded image');
    const view = gltf.bufferViews?.[image.bufferView];
    assert.ok(view, 'embedded image buffer view exists');
    assert.ok(gltf.buffers?.[view.buffer], 'image buffer exists');
  }

  for (const [index, node] of (gltf.nodes ?? []).entries()) {
    for (const property of ['translation', 'rotation', 'scale', 'matrix']) {
      if (node[property] === undefined) continue;
      assert.ok(Array.isArray(node[property]), `node ${index} ${property} is an array`);
      assert.ok(node[property].every(Number.isFinite), `node ${index} ${property} is finite`);
    }
  }

  for (const [meshIndex, mesh] of (gltf.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      const position = gltf.accessors?.[primitive.attributes?.POSITION];
      assert.ok(position, `mesh ${meshIndex} primitive ${primitiveIndex} POSITION accessor`);
      assertFiniteBounds(position, `mesh ${meshIndex} primitive ${primitiveIndex} POSITION`);
    }
  }
});

test('retained Implants building stays within standalone resource budgets', () => {
  const triangles = triangleCount(gltf);
  assert.ok(triangles > 0, 'kit contains triangles');
  assert.ok(triangles <= 7_000, `building triangles ${triangles} <= 7000`);
  assert.ok((gltf.materials?.length ?? 0) <= 6, 'building materials <= 6');
  assert.ok(statSync(KIT_PATH).size <= 1.1 * 1024 * 1024, 'implants-building.glb <= 1.1 MiB');
});

test('retained building contains no lights or character rigs', () => {
  assert.equal(gltf.lights?.length ?? 0, 0, 'no top-level lights');
  assert.equal(gltf.cameras?.length ?? 0, 0, 'no cameras');
  assert.equal(gltf.skins?.length ?? 0, 0, 'no skins');
  assert.equal(gltf.animations?.length ?? 0, 0, 'no animations');
  assert.doesNotMatch((gltf.extensionsUsed ?? []).join(','), /lights_punctual/i, 'no light extension');

  const characterNodes = (gltf.nodes ?? []).filter(node =>
    /(?:character|hero|npc|player|runner|avatar|human)/i.test(node.name ?? ''),
  );
  assert.deepEqual(characterNodes, [], 'no character-named nodes');
  assert.ok((gltf.nodes ?? []).every(node => node.skin === undefined), 'no node references a skin');
});
