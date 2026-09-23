/** Offline inventory only: no WebGL, decoder, Blender, server or model mutation.
 * Run: node --experimental-strip-types scripts/audit-runtime-models.mjs
 * Optional argument selects the output JSON path.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ASSET_URLS, registeredAssetFiles } from '../src/assets/registry.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = join(root, 'public');
const output = resolve(root, process.argv[2] ?? 'output/performance/model-audit-2026-09-24.json');
const registry = new Set(registeredAssetFiles());
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const sizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const usage = new Map([
  [ASSET_URLS.heroModel, { category: 'base-and-expedition-active', routes: ['base', 'expedition'], mode: 'default animated player', evidence: ['components/base/scene.ts', 'components/expedition/scene.ts'], defaultSceneCopies: 1 }],
  [ASSET_URLS.elevatedRail, { category: 'base-active', routes: ['base'], mode: 'default scenery; prototypes repeated and deck subdivided in runtime', evidence: ['src/renderer/environment/elevated-rail.ts'], defaultSceneCopies: null }],
  [ASSET_URLS.sakuraPark, { category: 'base-active', routes: ['base'], mode: 'default Sakura park scenery', evidence: ['components/base/scene.ts', 'src/renderer/environment/sakura-park.ts'], defaultSceneCopies: 1 }],
  [ASSET_URLS.canalKit, { category: 'base-fallback', routes: ['base'], mode: 'original canal kit loaded if the preferred KTX2 model fails', evidence: ['src/renderer/environment/canal.ts'], defaultSceneCopies: 0 }],
  [ASSET_URLS.canalKitKtx2, { category: 'base-active-preferred', routes: ['base'], mode: 'preferred canal kit; mixed KTX2 with original foliage mask', evidence: ['src/renderer/environment/canal.ts'], defaultSceneCopies: 1 }],
  [ASSET_URLS.sakuraParkKtx2, { category: 'disabled-variant', routes: [], mode: 'generated experiment; disabled after owner observed opaque canopy cards', evidence: ['src/renderer/environment/sakura-park.ts', 'docs/mobile-performance.md'], defaultSceneCopies: 0 }],
  [ASSET_URLS.eastDistrict, { category: 'base-active', routes: ['base'], mode: 'default east district and expedition transition scenery', evidence: ['components/base/scene.ts', 'src/renderer/environment/east-district.ts'], defaultSceneCopies: 1 }],
  [ASSET_URLS.railRuins, { category: 'base-active', routes: ['base'], mode: 'default ruined railway scenery', evidence: ['components/base/scene.ts', 'src/renderer/environment/rail-ruins.ts'], defaultSceneCopies: 1 }],
  [ASSET_URLS.implantsBuilding, { category: 'base-active', routes: ['base'], mode: 'loads by default, hidden/deleted by current owner map', evidence: ['components/base/scene.ts', 'src/renderer/environment/implants-building.ts'], defaultSceneCopies: 1 }],
  [ASSET_URLS.refugeBuilding('workshop'), { category: 'base-active', routes: ['base'], mode: 'loads by default, hidden/deleted by current owner map', evidence: ['components/base/scene.ts'], defaultSceneCopies: 1 }],
  [ASSET_URLS.refugeBuilding('oracle'), { category: 'base-active', routes: ['base'], mode: 'default building plus two shared-geometry background clones; saved deletions may hide copies', evidence: ['components/base/scene.ts'], defaultSceneCopies: 3 }],
  [ASSET_URLS.refugeBuilding('city-gate'), { category: 'base-active', routes: ['base'], mode: 'default scenery', evidence: ['components/base/scene.ts'], defaultSceneCopies: 1 }],
  [ASSET_URLS.referenceBuildings.mediaTower, { category: 'base-active-and-shared-catalogue', routes: ['base', 'expedition catalogue'], mode: 'default Base building plus on-demand shared editor catalogue', evidence: ['components/base/scene.ts', 'src/renderer/three/reference-building-library.ts'], defaultSceneCopies: 1 }],
  ...Object.entries(ASSET_URLS.referenceBuildings).filter(([name]) => name !== 'mediaTower').map(([, url]) => [url, { category: 'shared-catalogue-on-demand', routes: ['base saved map/catalogue', 'expedition catalogue'], mode: 'loaded when authored map or catalogue requests this building; not all are automatically placed', evidence: ['components/expedition/prop-assets.ts', 'src/renderer/three/reference-building-library.ts'], defaultSceneCopies: null }]),
  ['/game/models/anim/shoot.glb', { category: 'base-and-expedition-animation-donor', routes: ['base', 'expedition'], mode: 'ranger attack donor requested by combat.attach; mesh used for retargeting, not rendered as scenery', evidence: ['components/game/class-actions.ts', 'components/game/combat-driver.ts'], defaultSceneCopies: 0 }],
]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : /\.(glb|gltf)$/i.test(path) ? [path] : [];
  });
}

function dimensions(bytes) {
  if (bytes.length >= 24 && bytes.subarray(1, 4).toString() === 'PNG') {
    return { format: 'PNG', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    for (let offset = 12; offset + 8 < bytes.length;) {
      const tag = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8;
      if (tag === 'VP8X') return { format: 'WebP', width: bytes.readUIntLE(start + 4, 3) + 1, height: bytes.readUIntLE(start + 7, 3) + 1 };
      if (tag === 'VP8L') {
        const value = bytes.readUInt32LE(start + 1);
        return { format: 'WebP', width: (value & 0x3fff) + 1, height: ((value >>> 14) & 0x3fff) + 1 };
      }
      if (tag === 'VP8 ') return { format: 'WebP', width: bytes.readUInt16LE(start + 6) & 0x3fff, height: bytes.readUInt16LE(start + 8) & 0x3fff };
      offset = start + length + (length % 2);
    }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 4 < bytes.length;) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      let markerOffset = offset + 1;
      while (bytes[markerOffset] === 0xff) markerOffset++;
      const marker = bytes[markerOffset], start = markerOffset + 1;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker >= 0xd0 && marker <= 0xd7) { offset = start; continue; }
      const length = bytes.readUInt16BE(start);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { format: 'JPEG', width: bytes.readUInt16BE(start + 5), height: bytes.readUInt16BE(start + 3) };
      }
      offset = start + length;
    }
  }
  if (bytes.length >= 28 && bytes.toString('ascii', 1, 4) === 'KTX') {
    return { format: 'KTX2', width: bytes.readUInt32LE(20), height: bytes.readUInt32LE(24) };
  }
  return { format: 'unrecognized', width: null, height: null };
}

function mipRgbaBytes(width, height) {
  if (!width || !height) return null;
  let bytes = 0;
  while (true) {
    bytes += width * height * 4;
    if (width === 1 && height === 1) return bytes;
    width = Math.max(1, Math.floor(width / 2)); height = Math.max(1, Math.floor(height / 2));
  }
}

function readUri(uri, directory) {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    return Buffer.from(uri.slice(comma + 1), uri.slice(0, comma).includes(';base64') ? 'base64' : 'utf8');
  }
  if (/^https?:/.test(uri)) throw new Error('Audit never downloads model dependencies');
  if (uri.startsWith('/')) return readFileSync(join(publicRoot, uri.slice(1)));
  return readFileSync(resolve(directory, decodeURIComponent(uri)));
}

function audit(path) {
  const file = readFileSync(path), directory = dirname(path);
  let doc, binary;
  if (extname(path).toLowerCase() === '.glb') {
    if (file.toString('ascii', 0, 4) !== 'glTF' || file.readUInt32LE(8) !== file.length) throw new Error(`Invalid GLB: ${path}`);
    for (let offset = 12; offset < file.length;) {
      const length = file.readUInt32LE(offset), type = file.toString('ascii', offset + 4, offset + 8);
      const data = file.subarray(offset + 8, offset + 8 + length);
      if (type === 'JSON') doc = JSON.parse(data.toString());
      if (type === 'BIN\0') binary = data;
      offset += 8 + length;
    }
  } else doc = JSON.parse(file.toString());
  const buffers = (doc.buffers ?? []).map(buffer => buffer.uri ? readUri(buffer.uri, directory) : binary);
  const accessorBytes = index => { const a = doc.accessors[index]; return a.count * components[a.type] * sizes[a.componentType]; };
  const primitiveTriangles = primitive => {
    const count = doc.accessors[primitive.indices ?? primitive.attributes.POSITION]?.count ?? 0;
    return primitive.mode === undefined || primitive.mode === 4 ? count / 3 : primitive.mode === 5 || primitive.mode === 6 ? Math.max(0, count - 2) : 0;
  };
  const geometryAccessors = new Set(), geometryViews = new Set();
  const meshStats = (doc.meshes ?? []).map(mesh => {
    for (const primitive of mesh.primitives) {
      for (const index of [...Object.values(primitive.attributes), primitive.indices, ...(primitive.targets ?? []).flatMap(target => Object.values(target))].filter(value => value !== undefined)) {
        geometryAccessors.add(index);
        const accessor = doc.accessors[index];
        if (accessor.bufferView !== undefined) geometryViews.add(accessor.bufferView);
      }
      const draco = primitive.extensions?.KHR_draco_mesh_compression;
      if (draco) geometryViews.add(draco.bufferView);
    }
    return { name: mesh.name ?? '', triangles: mesh.primitives.reduce((sum, primitive) => sum + primitiveTriangles(primitive), 0), draws: mesh.primitives.length };
  });
  const descendants = (index, stack = new Set()) => {
    if (stack.has(index)) throw new Error('Cyclic scene graph');
    const node = doc.nodes[index], nextStack = new Set(stack).add(index);
    let triangles = 0, draws = 0, meshInstances = 0;
    if (node.mesh !== undefined) {
      const attributes = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
      const instances = attributes ? doc.accessors[Object.values(attributes)[0]].count : 1;
      triangles = meshStats[node.mesh].triangles * instances; draws = meshStats[node.mesh].draws; meshInstances = instances;
    }
    for (const child of node.children ?? []) {
      const sum = descendants(child, nextStack);
      triangles += sum.triangles; draws += sum.draws; meshInstances += sum.meshInstances;
    }
    return { triangles, draws, meshInstances };
  };
  const defaultScene = doc.scenes?.[doc.scene ?? 0];
  const roots = (defaultScene?.nodes ?? []).map(index => ({ name: doc.nodes[index].name ?? '', ...descendants(index) }));
  const materialImageUses = new Map();
  function collectTextureUses(value, materialName) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key.endsWith('Texture') && child?.index !== undefined) {
        const texture = doc.textures[child.index];
        const source = texture.source ?? texture.extensions?.EXT_texture_webp?.source ?? texture.extensions?.KHR_texture_basisu?.source;
        const materials = materialImageUses.get(source) ?? new Set();
        materials.add(materialName); materialImageUses.set(source, materials);
      } else collectTextureUses(child, materialName);
    }
  }
  for (const material of doc.materials ?? []) collectTextureUses(material, material.name ?? 'unnamed');
  const images = (doc.images ?? []).map((image, index) => {
    const view = image.bufferView === undefined ? null : doc.bufferViews[image.bufferView];
    const bytes = view ? buffers[view.buffer].subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength) : readUri(image.uri, directory);
    const size = dimensions(bytes);
    const usedByMaterials = [...(materialImageUses.get(index) ?? [])];
    const replacedReferenceConcrete = usedByMaterials.length > 0 && usedByMaterials.every(name => name.startsWith('CBR1_Concrete'));
    const replacedRailConcrete = usedByMaterials.length > 0 && usedByMaterials.every(name => name.startsWith('CBRail_Concrete'));
    return { index, name: image.name ?? '', embedded: image.bufferView !== undefined || image.uri?.startsWith('data:'), bytes: bytes.length, ...size,
      rgba8WithMipsEstimate: mipRgbaBytes(size.width, size.height), sha256: createHash('sha256').update(bytes).digest('hex'), usedByMaterials,
      runtimeNote: replacedReferenceConcrete
        ? 'Reference loader replaces concrete with shared atlas shader and disposes the unused embedded texture; included transfer is real, this source-image GPU estimate is not persistent runtime use.'
        : replacedRailConcrete
          ? 'Rail instance materials use shared atlas concrete instead. Original GLB material remains owned until rail teardown; embedded concrete is decoded but is not drawn by the rail instances.'
          : 'Image remains part of this source model; exact live GPU memory requires renderer measurement.',
    };
  });
  const animationAccessors = new Set((doc.animations ?? []).flatMap(animation => animation.samplers.flatMap(sampler => [sampler.input, sampler.output])));
  const url = '/' + relative(publicRoot, path).replaceAll('\\', '/');
  return {
    url, fileBytes: file.length, registered: registry.has(url),
    usage: usage.get(url) ?? { category: 'reserve-unreferenced', routes: [], mode: 'retained public file with no current Base/Expedition loader reference found', evidence: [], defaultSceneCopies: 0 },
    meshDefinitions: meshStats.length, materialDefinitions: doc.materials?.length ?? 0,
    uniqueMeshTriangles: meshStats.reduce((sum, mesh) => sum + mesh.triangles, 0),
    sourceScene: { roots, triangles: roots.reduce((sum, node) => sum + node.triangles, 0), draws: roots.reduce((sum, node) => sum + node.draws, 0), meshInstances: roots.reduce((sum, node) => sum + node.meshInstances, 0) },
    geometryDeclaredDecodedBytes: [...geometryAccessors].reduce((sum, index) => sum + accessorBytes(index), 0),
    geometryBufferViewBytes: [...geometryViews].reduce((sum, index) => sum + doc.bufferViews[index].byteLength, 0),
    dracoCompressed: doc.extensionsUsed?.includes('KHR_draco_mesh_compression') ?? false,
    skins: doc.skins?.length ?? 0, animations: doc.animations?.length ?? 0,
    animationAccessorBytes: [...animationAccessors].reduce((sum, index) => sum + accessorBytes(index), 0),
    images, imageBytes: images.reduce((sum, image) => sum + image.bytes, 0),
    imageRgba8WithMipsEstimate: images.reduce((sum, image) => sum + (image.rgba8WithMipsEstimate ?? 0), 0),
  };
}

const models = walk(publicRoot).map(audit).sort((a, b) => b.fileBytes - a.fileBytes);
const referenceSourceUsage = new Map([...usage].filter(([url]) => Object.values(ASSET_URLS.referenceBuildings).includes(url)));
for (const model of models) {
  const sourceUrl = model.url.replace(/-shared\.glb$/, '.glb');
  if (model.url.endsWith('-shared.glb') && referenceSourceUsage.has(sourceUrl)) {
    const source = referenceSourceUsage.get(sourceUrl);
    model.usage = { ...source, mode: `preferred exact-byte external-image variant; ${source.mode}`, evidence: [...source.evidence, 'scripts/externalize-building-images.mjs'] };
  } else if (referenceSourceUsage.has(model.url)) {
    model.usage = { category: 'reference-source-fallback', routes: ['base', 'expedition catalogue'], mode: 'original GLB fallback if shared variant or JPEG fails', evidence: ['src/renderer/three/reference-building-library.ts'], defaultSceneCopies: 0 };
  }
  if (model.url.endsWith('-ktx2.glb') && model.usage.category === 'reserve-unreferenced') {
    model.usage = { category: 'disabled-variant', routes: [], mode: 'generated facade experiment disabled after visual parity failure', evidence: ['src/renderer/three/reference-building-library.ts', 'docs/mobile-performance.md'], defaultSceneCopies: 0 };
  }
}
const hashes = new Map();
for (const model of models) for (const image of model.images) {
  const entry = hashes.get(image.sha256) ?? { bytes: image.bytes, width: image.width, height: image.height, sha256: image.sha256, occurrences: [] };
  entry.occurrences.push({ url: model.url, imageIndex: image.index, category: model.usage.category });
  hashes.set(image.sha256, entry);
}
const proceduralPath = join(root, '.cache/expedition-asset-audit.json');
const proceduralCatalogue = existsSync(proceduralPath) ? {
  source: '.cache/expedition-asset-audit.json', modified: statSync(proceduralPath).mtime.toISOString(),
  assets: JSON.parse(readFileSync(proceduralPath, 'utf8')),
} : null;
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'All GLB/GLTF files in public plus the existing offline procedural catalogue audit, if available',
  method: 'Header/accessor/scene metadata only. No geometry decoder, renderer or browser; Draco triangles use declared accessor counts.',
  limitations: [
    'Source scene draws exclude shadow/depth/reflection/postprocess passes and runtime clones, visibility, procedural scenery and particles.',
    'File bytes are uncompressed HTTP payload sizes, not downloaded bytes or GPU allocation.',
    'RGBA8 + full mip estimates are per source image, not a valid KTX2 GPU estimate; runtime replacement/disposal, GPU compression, source reuse and color-space duplicates can change actual memory.',
    'Runtime reference-aligned railway repeats/subdivides prototypes: full desktop assembly measured separately at 70,150 triangles / 32 draws; mobile 69,526 / 32. See current AI_HANDOFF.md; the rejected broad curve had different counts.',
    'Authored map placement counts are not inferred from old backups; this report does not read or change browser saves.',
  ],
  summary: {
    files: models.length, totalPublicBytes: models.reduce((sum, model) => sum + model.fileBytes, 0),
    activeOrOnDemandBytes: models.filter(model => !['reserve-unreferenced', 'disabled-variant', 'base-fallback', 'reference-source-fallback'].includes(model.usage.category)).reduce((sum, model) => sum + model.fileBytes, 0),
    losslessVariantBytes: models.filter(model => model.url.endsWith('-shared.glb')).reduce((sum, model) => sum + model.fileBytes, 0),
    fallbackBytes: models.filter(model => model.usage.category === 'base-fallback').reduce((sum, model) => sum + model.fileBytes, 0),
    referenceSourceFallbackBytes: models.filter(model => model.usage.category === 'reference-source-fallback').reduce((sum, model) => sum + model.fileBytes, 0),
    disabledVariantBytes: models.filter(model => model.usage.category === 'disabled-variant').reduce((sum, model) => sum + model.fileBytes, 0),
    reserveBytes: models.filter(model => model.usage.category === 'reserve-unreferenced').reduce((sum, model) => sum + model.fileBytes, 0),
  },
  models,
  duplicateImagePayloads: [...hashes.values()].filter(image => image.occurrences.length > 1),
  proceduralCatalogue,
  findings: [
    {
      topic: 'Low-poly classification',
      finding: 'New authored building GLBs use 6,301–10,430 triangles each; the portrait tower is 6,623. They are modest game buildings. The 68,132-triangle animated hero is materially heavier and should not be described as equally low-poly.',
      recommendation: 'Preserve the approved buildings/portrait; investigate editor hot-path stalls before reducing visible detail.',
    },
    {
      topic: 'Largest active model',
      finding: 'The hero is 3,391,124 bytes, 68,132 triangles and one material draw. Declared decoded geometry is 9,885,724 bytes; three embedded images would occupy about 32 MiB as RGBA8 with mips.',
      recommendation: 'If measured GPU/skinning cost remains excessive, add a separately validated mobile/distant LOD while preserving the current close model, rig, silhouette and animations. Do not decimate the only hero source automatically.',
    },
    {
      topic: 'Portrait texture',
      finding: 'The 3,071,264-byte media tower contains the exact 2,113,242-byte 1024×1536 approved PNG. Its geometry is only 6,623 triangles / 9 draws.',
      recommendation: 'Keep the original portrait unchanged. Its file size is not evidence of expensive geometry or the cause of a repeatable editor-open freeze.',
    },
    {
      topic: 'Repeated surface payloads',
      finding: 'The 17 reference-building source GLBs embed the same 284,227-byte surface JPEG; 16 also embed the same 205,702-byte concrete JPEG. Loading all 17 transfers 7,633,162 bytes of redundant source image payloads beyond one copy each. Runtime shares a compressed surface after load and disposes unused concrete; those source payloads are transfer and decode overhead, not persistent GPU memory.',
      recommendation: 'A future external/shared surface texture resource could preserve all pixels and avoid redundant transfer and uploads. Keep independent model lifetimes correct; verify actual retained textures before claiming memory savings.',
    },
    {
      topic: 'Railway',
      finding: 'The V2 GLB is a four-prototype kit with 7,080 source-scene triangles; the complete current runtime railway is 70,150 desktop / 69,526 mobile triangles and 32 draws after repetition, bending, train, cables and city details.',
      recommendation: 'If measured scene geometry cost is high, evaluate culling/distant detail on rail stretches outside the visible street before changing the nearby train, lamps or columns.',
    },
    {
      topic: 'Reserve files',
      finding: 'night-market-kit.glb, outlaw-refuge.glb and elevated-rail-v1.glb have no current Base/Expedition loader usage; they total 4,421,536 bytes on disk.',
      recommendation: 'Do not delete them as an FPS fix: unrequested files add no current frame rendering cost.',
    },
    {
      topic: 'Procedural catalogue',
      finding: 'Many editor buildings and street props are procedural rather than GLB. Their separately generated catalogue counts are included with an explicit timestamp; the largest entries must be considered alongside this GLB inventory.',
      recommendation: 'Avoid reconstructing the catalogue or traversing all geometry on every editor panel update. Profile allocations and CPU time around open/select/transform before assigning the freeze to polygon count.',
    },
  ],
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: relative(root, output), ...report.summary, models: models.map(model => ({
  url: model.url, category: model.usage.category, bytes: model.fileBytes, triangles: model.sourceScene.triangles, draws: model.sourceScene.draws,
  imageMiB: +(model.imageRgba8WithMipsEstimate / 1048576).toFixed(2), textures: model.images.map(image => `${image.width}x${image.height} ${image.format}`),
})) }, null, 2));
