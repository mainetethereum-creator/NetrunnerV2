import fs from "node:fs";
import path from "node:path";

const inputPath = path.resolve("public/base/models/night-market-kit.glb");
const outputPath = path.resolve("public/base/models/implants-building.glb");

const source = fs.readFileSync(inputPath);
if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2) {
  throw new Error(`${inputPath} is not a glTF 2.0 binary file`);
}

const jsonLength = source.readUInt32LE(12);
const jsonType = source.readUInt32LE(16);
if (jsonType !== 0x4e4f534a) throw new Error("Missing GLB JSON chunk");
const document = JSON.parse(source.subarray(20, 20 + jsonLength).toString("utf8"));

const binaryHeader = 20 + jsonLength;
const binaryLength = source.readUInt32LE(binaryHeader);
const binaryType = source.readUInt32LE(binaryHeader + 4);
if (binaryType !== 0x004e4942) throw new Error("Missing GLB binary chunk");
const binary = source.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength);

const rootIndex = document.nodes.findIndex((node) => node.name === "Implants");
if (rootIndex < 0) throw new Error("Implants root node not found");

const collectNodeTree = (index, found = new Set()) => {
  if (found.has(index)) return found;
  found.add(index);
  for (const child of document.nodes[index].children ?? []) collectNodeTree(child, found);
  return found;
};

const nodeIndices = [...collectNodeTree(rootIndex)].sort((a, b) => a - b);
const meshIndices = [...new Set(nodeIndices.flatMap((index) => {
  const mesh = document.nodes[index].mesh;
  return mesh === undefined ? [] : [mesh];
}))].sort((a, b) => a - b);

const materialIndices = new Set();
const accessorIndices = new Set();
for (const meshIndex of meshIndices) {
  for (const primitive of document.meshes[meshIndex].primitives) {
    if (primitive.material !== undefined) materialIndices.add(primitive.material);
    if (primitive.indices !== undefined) accessorIndices.add(primitive.indices);
    for (const accessor of Object.values(primitive.attributes ?? {})) accessorIndices.add(accessor);
    for (const target of primitive.targets ?? []) {
      for (const accessor of Object.values(target)) accessorIndices.add(accessor);
    }
  }
}

const textureIndices = new Set();
const visitTextureInfo = (value, key = "") => {
  if (!value || typeof value !== "object") return;
  if (key.endsWith("Texture") && Number.isInteger(value.index)) textureIndices.add(value.index);
  for (const [childKey, child] of Object.entries(value)) visitTextureInfo(child, childKey);
};
for (const index of materialIndices) visitTextureInfo(document.materials[index]);

const imageIndices = new Set();
const samplerIndices = new Set();
for (const index of textureIndices) {
  const texture = document.textures[index];
  if (texture.source !== undefined) imageIndices.add(texture.source);
  for (const extension of Object.values(texture.extensions ?? {})) {
    if (extension.source !== undefined) imageIndices.add(extension.source);
  }
  if (texture.sampler !== undefined) samplerIndices.add(texture.sampler);
}

const bufferViewIndices = new Set();
for (const index of accessorIndices) {
  const accessor = document.accessors[index];
  if (accessor.bufferView !== undefined) bufferViewIndices.add(accessor.bufferView);
  if (accessor.sparse) {
    bufferViewIndices.add(accessor.sparse.indices.bufferView);
    bufferViewIndices.add(accessor.sparse.values.bufferView);
  }
}
for (const index of imageIndices) {
  const image = document.images[index];
  if (image.bufferView !== undefined) bufferViewIndices.add(image.bufferView);
}

const sorted = (set) => [...set].sort((a, b) => a - b);
const makeMap = (indices) => new Map(indices.map((oldIndex, newIndex) => [oldIndex, newIndex]));
const maps = {
  node: makeMap(nodeIndices),
  mesh: makeMap(meshIndices),
  material: makeMap(sorted(materialIndices)),
  accessor: makeMap(sorted(accessorIndices)),
  texture: makeMap(sorted(textureIndices)),
  image: makeMap(sorted(imageIndices)),
  sampler: makeMap(sorted(samplerIndices)),
  bufferView: makeMap(sorted(bufferViewIndices)),
};

const clone = (value) => structuredClone(value);
const nodes = nodeIndices.map((index) => {
  const node = clone(document.nodes[index]);
  if (node.children) node.children = node.children.map((child) => maps.node.get(child));
  if (node.mesh !== undefined) node.mesh = maps.mesh.get(node.mesh);
  return node;
});
const meshes = meshIndices.map((index) => {
  const mesh = clone(document.meshes[index]);
  for (const primitive of mesh.primitives) {
    if (primitive.material !== undefined) primitive.material = maps.material.get(primitive.material);
    if (primitive.indices !== undefined) primitive.indices = maps.accessor.get(primitive.indices);
    for (const key of Object.keys(primitive.attributes ?? {})) {
      primitive.attributes[key] = maps.accessor.get(primitive.attributes[key]);
    }
    for (const target of primitive.targets ?? []) {
      for (const key of Object.keys(target)) target[key] = maps.accessor.get(target[key]);
    }
  }
  return mesh;
});
const materials = sorted(materialIndices).map((index) => {
  const material = clone(document.materials[index]);
  const remapTextureInfo = (value, key = "") => {
    if (!value || typeof value !== "object") return;
    if (key.endsWith("Texture") && Number.isInteger(value.index)) value.index = maps.texture.get(value.index);
    for (const [childKey, child] of Object.entries(value)) remapTextureInfo(child, childKey);
  };
  remapTextureInfo(material);
  return material;
});
const textures = sorted(textureIndices).map((index) => {
  const texture = clone(document.textures[index]);
  if (texture.source !== undefined) texture.source = maps.image.get(texture.source);
  for (const extension of Object.values(texture.extensions ?? {})) {
    if (extension.source !== undefined) extension.source = maps.image.get(extension.source);
  }
  // The source kit stores its WebP only in EXT_texture_webp. Keep a core source
  // fallback to prevent loaders from resolving json.images[undefined] when the
  // optional extension handler is unavailable or has not initialized yet.
  if (texture.source === undefined && texture.extensions?.EXT_texture_webp?.source !== undefined) {
    texture.source = texture.extensions.EXT_texture_webp.source;
  }
  if (texture.sampler !== undefined) texture.sampler = maps.sampler.get(texture.sampler);
  return texture;
});
const images = sorted(imageIndices).map((index) => {
  const image = clone(document.images[index]);
  if (image.bufferView !== undefined) image.bufferView = maps.bufferView.get(image.bufferView);
  return image;
});
const accessors = sorted(accessorIndices).map((index) => {
  const accessor = clone(document.accessors[index]);
  if (accessor.bufferView !== undefined) accessor.bufferView = maps.bufferView.get(accessor.bufferView);
  if (accessor.sparse) {
    accessor.sparse.indices.bufferView = maps.bufferView.get(accessor.sparse.indices.bufferView);
    accessor.sparse.values.bufferView = maps.bufferView.get(accessor.sparse.values.bufferView);
  }
  return accessor;
});

const binaryParts = [];
let byteOffset = 0;
const bufferViews = sorted(bufferViewIndices).map((index) => {
  const view = clone(document.bufferViews[index]);
  const padding = (4 - (byteOffset % 4)) % 4;
  if (padding) {
    binaryParts.push(Buffer.alloc(padding));
    byteOffset += padding;
  }
  const start = view.byteOffset ?? 0;
  binaryParts.push(binary.subarray(start, start + view.byteLength));
  view.buffer = 0;
  view.byteOffset = byteOffset;
  byteOffset += view.byteLength;
  return view;
});
const outputBinary = Buffer.concat(binaryParts);

const output = {
  asset: clone(document.asset),
  scene: 0,
  scenes: [{ name: "Implants", nodes: [maps.node.get(rootIndex)] }],
  nodes,
  meshes,
  materials,
  textures,
  images,
  samplers: sorted(samplerIndices).map((index) => clone(document.samplers[index])),
  accessors,
  bufferViews,
  buffers: [{ byteLength: outputBinary.length }],
};
if (document.extensionsUsed) output.extensionsUsed = clone(document.extensionsUsed);
if (document.extensionsRequired) output.extensionsRequired = clone(document.extensionsRequired);

const json = Buffer.from(JSON.stringify(output));
const jsonPadding = (4 - (json.length % 4)) % 4;
const paddedJson = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
const binaryPadding = (4 - (outputBinary.length % 4)) % 4;
const paddedBinary = Buffer.concat([outputBinary, Buffer.alloc(binaryPadding)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + paddedJson.length + 8 + paddedBinary.length, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(paddedJson.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binaryChunkHeader = Buffer.alloc(8);
binaryChunkHeader.writeUInt32LE(paddedBinary.length, 0);
binaryChunkHeader.writeUInt32LE(0x004e4942, 4);

fs.writeFileSync(outputPath, Buffer.concat([
  header,
  jsonHeader,
  paddedJson,
  binaryChunkHeader,
  paddedBinary,
]));

const triangles = meshes.reduce((total, mesh) => total + mesh.primitives.reduce((meshTotal, primitive) => {
  if (primitive.mode !== undefined && primitive.mode !== 4) return meshTotal;
  const count = primitive.indices === undefined
    ? accessors[primitive.attributes.POSITION].count
    : accessors[primitive.indices].count;
  return meshTotal + count / 3;
}, 0), 0);

console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  nodes: nodes.map((node) => node.name),
  meshes: meshes.length,
  materials: materials.length,
  triangles,
  bytes: fs.statSync(outputPath).size,
}, null, 2));
