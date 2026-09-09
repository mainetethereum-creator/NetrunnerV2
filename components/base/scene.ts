import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PoseController } from "../game/pose-controller";
import { buildMetro, courtyardWithMetroOpening, METRO_PIT } from "./metro";
import { createRefugeMaterials } from "./materials";
import { addRefugeSurfaceDetails } from "./details";
import { createWetFloor } from "./wet-floor";
import { buildRefugeZones } from "./zones";
import { buildConcretePerimeter } from "./fence";
import { adaptQuality, initialQuality, renderRatio, type QualityMode } from "./quality";
import { canStand, findPath, moveWithCollision, nearestStation, BASE_EXPANSION, SPAWN, STATIONS, type Point, type StationId } from "./world";

export type BaseSnapshot = { x: number; z: number; near: StationId | null; fps: number; p95: number; draws: number; triangles: number; ratio: number; high: boolean; submitMs: number; timingLimited: boolean };
export type BaseEngine = {
  dispose(): void; setPaused(value: boolean): void; setStick(x: number, y: number): void;
  setRain(value: boolean): void; setQuality(value: QualityMode): void;
  resetCamera(): void; goTo(id: StationId): void;
};

function disposeTree(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse((o) => {
    const mesh = o as T.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value instanceof T.Texture) textures.add(value);
    }
  });
  geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
}

export function createBaseScene(
  host: HTMLElement,
  onReady: (heroName: string) => void,
  onSnapshot: (value: BaseSnapshot) => void,
  onInteract: (id: StationId) => void,
  onError: (message: string) => void,
): BaseEngine {
  const scene = new T.Scene();
  scene.background = new T.Color("#101b23");
  scene.fog = new T.FogExp2("#101d28", 0.014);
  const mobile = window.matchMedia("(pointer: coarse)").matches;
  let quality = initialQuality(mobile);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(renderRatio(host.clientWidth, host.clientHeight, devicePixelRatio, quality));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.info.autoReset = false;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const surfaces = createRefugeMaterials(renderer.capabilities.getMaxAnisotropy());
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(surfaces.skyTexture);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();
  renderer.domElement.setAttribute("aria-label", "CyberBase starter refuge. Use WASD or arrow keys to walk, E to interact.");
  renderer.domElement.tabIndex = 0;
  host.appendChild(renderer.domElement);
  const camera = new T.PerspectiveCamera(38, 1, 0.15, 140);
  // Canvas antialiasing does not apply to the composer's offscreen scene.
  // Resolve MSAA before bloom so window slats and facade edges stay smooth at rest.
  const sceneTarget = new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    samples: Math.min(mobile ? 2 : 4, renderer.capabilities.maxSamples),
  });
  const composer = new EffectComposer(renderer, sceneTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(800, 600), 0.32, 0.65, 1.05);
  composer.addPass(bloom);
  const output = new OutputPass(); composer.addPass(output);
  const hemi = new T.HemisphereLight(0x9cb9d6, 0x302a23, 0.45); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffd9ab, 2.2);
  sun.position.set(-14, 19, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -23, right: 23, top: 23, bottom: -23, near: 1, far: 65 });
  sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.00015; sun.shadow.radius = 3;
  sun.shadow.blurSamples = mobile ? 4 : 8;
  scene.add(sun);
  const rim = new T.DirectionalLight(0x86b9cc, .85); rim.position.set(10, 8, -10); scene.add(rim);
  const courtyardFill = new T.DirectionalLight(0x99bddc, 0.28);
  courtyardFill.position.set(-5, 14, 16); scene.add(courtyardFill);

  let seed = 90421;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const material = (color: string, roughness = 0.7, metalness = 0.25) => new T.MeshStandardMaterial({ color, roughness, metalness });
  const m = {
    dark: material("#29333a"), wall: material("#898b84", 0.85, 0.03), concrete: material("#93958b", 0.91, 0.02),
    edge: material("#303c3d"), brass: material("#99836a", 0.48, 0.65), rust: material("#784d37"),
    black: material("#101b1e"), green: material("#606c3c"), leaf: material("#a59749", 0.95, 0),
    teal: new T.MeshStandardMaterial({ color: "#78c7c1", emissive: "#55b6b2", emissiveIntensity: 1.3, roughness: 0.3 }),
    amber: new T.MeshStandardMaterial({ color: "#ffd5a1", emissive: "#ffb052", emissiveIntensity: 1.7 }),
    red: new T.MeshStandardMaterial({ color: "#f58764", emissive: "#c53d17", emissiveIntensity: 1.4 }),
  };
  for (const name of ["edge", "brass", "rust"] as const) surfaces.apply(m[name], "metal", 0.55);
  surfaces.apply(m.wall, "concrete", 0.55);
  surfaces.apply(m.concrete, "concrete", 0.45);
  const batches = new Map<T.Material, T.Matrix4[]>();
  const dummy = new T.Object3D();
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: T.Material, ry = 0) => {
    dummy.position.set(x, y, z); dummy.scale.set(w, h, d); dummy.rotation.set(0, ry, 0); dummy.updateMatrix();
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat)!.push(dummy.matrix.clone());
  };
  const cylinder = (x: number, y: number, z: number, r: number, h: number, mat: T.Material, rotation?: T.Euler) => {
    const mesh = new T.Mesh(new T.CylinderGeometry(r, r, h, 10), mat);
    mesh.position.set(x, y, z); if (rotation) mesh.rotation.copy(rotation);
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
  };
  const pipe = (points: number[][], radius: number, mat = m.brass) => {
    const curve = new T.CatmullRomCurve3(points.map(([x, y, z]) => new T.Vector3(x, y, z)), false, "centripetal");
    const mesh = new T.Mesh(new T.TubeGeometry(curve, 28, radius, 6, false), mat);
    mesh.castShadow = true; scene.add(mesh); return mesh;
  };
  const light = (x: number, y: number, z: number, color: number, power: number, distance: number) => {
    const lamp = new T.PointLight(color, power, distance, 2); lamp.position.set(x, y, z); scene.add(lamp);
  };
  function sign(text: string, sub: string, x: number, y: number, z: number, width: number, color = "#c0d8d0", rotation = 0) {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#14282c"; ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = "#60746b"; ctx.lineWidth = 5; ctx.strokeRect(14, 14, 996, 228);
    ctx.fillStyle = color; ctx.font = "bold 69px monospace"; ctx.textAlign = "center";
    ctx.fillText(text, 512, 114); ctx.font = "25px monospace"; ctx.fillStyle = "#a6b4a8"; ctx.fillText(sub, 512, 177);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
    const mesh = new T.Mesh(new T.PlaneGeometry(width, width / 4), new T.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.7 }));
    mesh.position.set(x, y, z); mesh.rotation.y = rotation; scene.add(mesh);
  }

  // A layered slab with service conduits and an exposed foundation.
  const slabWithOpening = (w: number, d: number, y: number, h: number, mat: T.Material) => {
    const {left:l,right:r,back:b,front:f}=METRO_PIT;
    box((-w/2+l)/2,y,0,l+w/2,h,d,mat);
    box((r+w/2)/2,y,0,w/2-r,h,d,mat);
    box((l+r)/2,y,(-d/2+b)/2,r-l,h,b+d/2,mat);
    box((l+r)/2,y,(f+d/2)/2,r-l,h,d/2-f,mat);
  };
  slabWithOpening(28 * BASE_EXPANSION, 23 * BASE_EXPANSION, -0.68, 1.3, m.dark);
  slabWithOpening(27.5 * BASE_EXPANSION, 22.5 * BASE_EXPANSION, -0.11, .22, m.concrete);
  for (let x = -13 * BASE_EXPANSION; x < 14 * BASE_EXPANSION; x += 1.3) {
    box(x, -0.6, 11.55 * BASE_EXPANSION, 1.17, 0.88, 0.18, m.edge);
    if (x % 2 < 1) box(x, -0.5, 11.66 * BASE_EXPANSION, 0.45, 0.1, 0.03, m.brass);
  }
  pipe([[-13 * BASE_EXPANSION, -0.7, 11.7 * BASE_EXPANSION], [0, -0.7, 11.7 * BASE_EXPANSION], [13 * BASE_EXPANSION, -0.7, 11.7 * BASE_EXPANSION]], 0.08);

  // The scan supplies aligned stone faces, chipped joints and normals.
  // A second geometric grid would cut across those joints, so use one receiver.
  const stone = surfaces.apply(new T.MeshStandardMaterial({ color: "#c9cfd3", roughness: .9, metalness: .02 }), "stone", .25);
  const courtyardFloor = new T.Mesh(courtyardWithMetroOpening(),stone);
  courtyardFloor.rotation.x = -Math.PI/2; courtyardFloor.position.y=.075;
  courtyardFloor.receiveShadow=true; scene.add(courtyardFloor);
  for (let z = -8; z <= 9; z += 0.34) {
    box(-3.4, 0.076, z, 0.22, 0.026, 0.27, m.black);
    box(3.4, 0.076, z, 0.22, 0.026, 0.27, m.black);
  }
  for (let x = -9; x < 10; x += 0.7) box(x, 0.073, 7.8, 0.34, 0.025, 0.08, m.brass);

  buildMetro({ box, cylinder, pipe, sign, light, m, surface: surfaces.apply });
  buildRefugeZones({ box, cylinder, pipe, sign, light, m, surface: surfaces.apply });

  sign("NEON SPRAWL", "CITY AIRLOCK / SEALED", -14.3, 4.5, 0, 4, "#8cc5c3", Math.PI / 2);
  light(-13.95, 2.8, 0, 0x80d5e7, 18, 6);
  const fenceConcrete = surfaces.apply(new T.MeshStandardMaterial({
    name: "Weathered precast concrete", color: "#a5a49b", roughness: .96, metalness: 0,
  }), "concrete", .65);
  fenceConcrete.normalScale.setScalar(.7);
  // Keep the already merged fence separate from the indexed pipe batches.
  buildConcretePerimeter(scene, fenceConcrete, m.edge.clone());

  // A wide, damaged expedition passage branches from the refuge perimeter.
  box(19, -0.35, 7.5, 8, 0.7, 5.4, m.dark);
  box(26, -0.35, 7.5, 6.2, 0.7, 7.2, m.dark);
  for (let x = 15; x < 29; x++) for (let z = 4; z < 11; z++) {
    if (x < 23 && (z < 5 || z >= 10)) continue;
    box(x + 0.5, 0.025, z + 0.5, 0.965, 0.1, 0.965, stone);
  }
  for (const z of [4.8, 10.2]) {
    for (let x = 15; x <= 23; x++) {
      box(x, 0.75, z, 0.09, 1.5, 0.09, m.brass);
      if (x % 2 === 1) box(x, 1.52, z, 0.14, 0.07, 0.14, m.teal);
    }
    for (const y of [0.25, 0.65, 1.05, 1.45]) box(19, y, z, 8, 0.035, 0.035, m.edge);
    for (let x = 15.25; x < 23; x += 0.25) box(x, 0.82, z, 0.025, 1.2, 0.025, m.edge);
    box(19, 0.11, z + (z < 7 ? 0.16 : -0.16), 8, 0.025, 0.05, m.teal);
  }
  // Nothing spans the whole opening: the uneven beam stumps keep it reading as
  // a torn wall rather than a purpose-built doorway.
  box(14.94, 2.94, 5.28, .5, .34, 1.18, m.edge, -.12);
  box(14.94, 2.82, 9.7, .5, .38, 1.34, m.edge, .16);
  box(15.08, 2.56, 5, .72, .82, .38, m.rust, -.18);
  box(15.08, 2.5, 10.02, .72, .74, .38, m.rust, .2);
  sign("OUTLANDS", "EXPEDITION ROUTE / ENTER OUTLANDS", 15.26, 2.18, 5.62, 2.25, "#e0b070", Math.PI / 2);
  for (const [z, y, angle] of [[5.6, 2.9, -.22], [5.82, 2.62, .35], [9.4, 2.82, .18], [9.65, 2.5, -.3]] as const) {
    box(14.72, y, z, .92, .045, .045, m.edge, angle);
  }
  for (const z of [5.15, 9.85]) {
    box(15.35, .65, z, .28, 1.3, .28, m.rust);
    box(15.35, 1.34, z, .38, .12, .38, m.brass);
    light(15.15, 1.65, z, 0xff9f55, 7, 3.5);
  }
  for (const [x, z, angle] of [[15.55, 5.62, .25], [16.18, 9.35, -.2], [17.05, 5.34, -.35], [18.1, 9.62, .3]] as const) {
    box(x, .14, z, .78, .12, .42, m.concrete, angle);
  }
  for (let x = 15.6; x < 22.5; x += 1.35) box(x, .105, 7.5, .82, .035, .09, m.rust, (x % 2) * .08);
  box(26, 1.65, 4, 6.2, 3.3, 0.25, m.wall);
  box(29, 1.15, 7.5, 0.25, 2.3, 7, m.wall);
  box(26, 0.38, 11, 6, 0.75, 0.25, m.edge);
  for (const z of [5, 10]) box(23, 0.6, z, 0.25, 1.2, 2, m.edge);
  box(26, 3.34, 4, 6.4, 0.18, 0.5, m.brass);
  sign("QUANTUM CHARGE", "DAILY CYCLE / STANDBY", 26, 2.55, 4.16, 4.6, "#9ae5ec");
  box(26, 0.65, 5.1, 2, 1.2, 1.1, m.dark);
  box(26, 1.29, 5.1, 2.2, 0.12, 1.25, m.brass);
  cylinder(26, 1.4, 5.1, 0.45, 0.12, m.teal);
  for (const x of [25.25, 26.75]) {
    box(x, 1.8, 5.05, 0.16, 1.1, 0.18, m.edge);
    box(x, 1.8, 5.18, 0.07, 0.75, 0.04, m.teal);
  }
  box(28.2, 0.55, 4.8, 0.7, 1.1, 0.8, m.rust);
  light(26, 2.4, 5.7, 0x78dfe9, 25, 7);

  function crate(x: number, z: number, size = 0.8, y = 0) {
    box(x, y + size / 2, z, size, size, size * 0.8, m.dark);
    for (const side of [-1, 1]) box(x + side * size * 0.37, y + size / 2, z + size * 0.41, 0.07, size, 0.08, m.brass);
    box(x, y + size * 0.78, z + size * 0.42, size * 0.4, 0.11, 0.04, m.concrete);
  }
  crate(-10.7, 5, 0.6);
  crate(10.5, -5.2); crate(11.1, -4.1, 0.65); crate(-10.8, -5.4, 0.9);
  // Battery dock: physically present, but no timed or financial reward in stage 1.
  box(-7.4, 0.63, -5.6, 1.35, 1.2, 0.75, m.dark);
  box(-7.4, 1.26, -5.6, 1.55, 0.1, 0.95, m.brass);
  for (const x of [-7.78, -7.4, -7.02]) {
    cylinder(x, 1.53, -5.6, 0.12, 0.48, m.edge);
    cylinder(x, 1.74, -5.6, 0.13, 0.06, m.teal);
  }
  box(-7.4, 0.83, -5.2, 0.45, 0.25, 0.03, m.teal);

  function planter(x: number, z: number, w: number) {
    box(x, 0.28, z, w, 0.5, 1.25, m.edge);
    box(x, 0.55, z, w + 0.12, 0.12, 1.37, m.brass);
    box(x, 0.63, z, w - 0.2, 0.08, 1.0, m.black);
    for (let i = 0; i < 26; i++) {
      const xx = x + (rand() - 0.5) * (w - 0.3), zz = z + (rand() - 0.5) * 0.9;
      const h = 0.35 + rand() * 0.7;
      box(xx, 0.68 + h / 2, zz, 0.025, h, 0.025, m.rust);
    }
  }
  planter(-5.4, 0.2, 2.8); planter(5.1, 0.2, 2.8);
  // Windblown debris.
  for (let i = 0; i < 85; i++) {
    const x = (rand() - 0.5) * 24, z = (rand() - 0.5) * 19;
    if (rand() < 0.6 && Math.abs(x) < 4) continue;
    box(x, 0.09, z, 0.06 + rand() * 0.12, 0.015, 0.06 + rand() * 0.19, rand() > 0.3 ? m.leaf : m.brass, rand() * 6);
  }
  // Four bollard lights and terminal rings.
  for (const [x, z] of [[-9, 7], [9, 7], [-3.7, -5.6], [3.7, -5.6]]) {
    box(x, 0.53, z, 0.26, 1, 0.26, m.dark); box(x, 1.05, z, 0.28, 0.16, 0.28, m.amber);
  }
  for (const st of STATIONS) {
    const ring = new T.Mesh(new T.RingGeometry(0.58, 0.61, 40), new T.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.5, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(st.x, 0.1, st.z); scene.add(ring);
  }

  // Stylised service NPCs with layered coats, visors, backpacks and relaxed arms.
  const npcs: T.Group[] = [];
  function npc(x: number, z: number, accent: T.Material, coat: T.Material) {
    const group = new T.Group(); group.position.set(x, 0.08, z); scene.add(group);
    function part(w: number, h: number, d: number, px: number, py: number, pz: number, mat: T.Material) {
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat); mesh.position.set(px, py, pz); mesh.castShadow = true; group.add(mesh); return mesh;
    }
    part(0.48, 0.67, 0.3, 0, 0.96, 0, coat);
    part(0.6, 0.3, 0.36, 0, 0.6, 0, coat);
    part(0.29, 0.32, 0.29, 0, 1.46, 0, m.edge);
    part(0.27, 0.065, 0.035, 0, 1.49, 0.16, accent);
    part(0.29, 0.4, 0.18, 0, 1, -0.23, m.brass);
    for (const side of [-1, 1]) {
      part(0.18, 0.5, 0.2, side * 0.16, 0.29, 0, m.dark);
      part(0.2, 0.15, 0.34, side * 0.16, 0.09, 0.07, m.edge);
      const arm = part(0.15, 0.56, 0.2, side * 0.34, 0.95, 0.05, coat); arm.rotation.z = side * 0.12;
      part(0.17, 0.14, 0.2, side * 0.36, 0.62, 0.05, m.brass);
    }
    npcs.push(group); return group;
  }
  npc(-7.3, -4.6, m.amber, m.rust); npc(0, -2.4, m.teal, m.dark); npc(8, -4.7, m.amber, m.black);
  npc(2.1, -5.4, m.teal, m.edge); npc(-8, 3, m.amber, m.green);

  for (const [mat, transforms] of batches) {
    const mesh = new T.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.018), mat, transforms.length);
    transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = mat !== m.teal && mat !== m.amber; mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Merge static pipes, fans and service rigs by material, reducing draw calls.
  // Batched building boxes already use instancing. Animated Outlaw is added later.
  scene.updateMatrixWorld(true);
  const staticMeshes = new Map<T.Material, T.Mesh[]>();
  scene.traverse((object) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh || (mesh as T.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material) || mesh.material.transparent) return;
    if (!staticMeshes.has(mesh.material)) staticMeshes.set(mesh.material, []);
    staticMeshes.get(mesh.material)!.push(mesh);
  });
  for (const [mat, meshes] of staticMeshes) {
    if (meshes.length < 2) continue;
    const copies = meshes.map((mesh) => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const merged = mergeGeometries(copies); copies.forEach((g) => g.dispose());
    if (!merged) continue;
    const combined = new T.Mesh(merged, mat); combined.castShadow = true; combined.receiveShadow = true; scene.add(combined);
    meshes.forEach((mesh) => { mesh.removeFromParent(); mesh.geometry.dispose(); });
  }
  npcs.length = 0;
  const surfaceDetails = addRefugeSurfaceDetails(scene);

  const puddle = createWetFloor(mobile); scene.add(puddle);

  const player = new T.Group(); player.position.set(SPAWN.x, 0.12, SPAWN.z); scene.add(player);
  // A small, unshadowed fill follows the runner and gently reaches nearby paving.
  const runnerFill = new T.PointLight(0xc8e4db, 3.2, 4.5, 2);
  runnerFill.position.set(0.4, 2.8, 1.1); player.add(runnerFill);
  const fallback = npc(0, 0, m.teal, m.edge); scene.remove(fallback); player.add(fallback); fallback.position.set(0, 0, 0);
  npcs.pop();
  const marker = new T.Mesh(new T.RingGeometry(0.38, 0.43, 48), new T.MeshBasicMaterial({ color: 0xc8e3d5, transparent: true, opacity: 0.8, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 0.01; player.add(marker);
  const targetMarker = new T.Mesh(new T.RingGeometry(0.23, 0.28, 40), new T.MeshBasicMaterial({ color: 0xb7decf, transparent: true, opacity: 0.8, depthWrite: false }));
  targetMarker.rotation.x = -Math.PI / 2; targetMarker.visible = false; scene.add(targetMarker);

  let disposed = false, paused = false, rainOn = !reducedMotion, path: Point[] = [];
  let mixer: T.AnimationMixer | null = null, runAction: T.AnimationAction | null = null, idleAction: T.AnimationAction | null = null;
  let locomotionBlend = 0;
  let pose: PoseController | null = null;
  let hero: T.Object3D = fallback, previousWalking = false;
  const draco = new DRACOLoader(); draco.setDecoderPath("/game/draco/");
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  for (const [file, x, z] of [["workshop", -8.4, -8.6], ["oracle", 0, -9], ["city-gate", -14.8, 0]] as const) {
    loader.loadAsync(`/base/models/${file}.glb`).then(({ scene: model }) => {
      if (disposed) { disposeTree(model); return; }
      const mapped = new Set<T.Material>();
      model.position.set(x, 0.08, z);
      if (file === "city-gate") model.rotation.y = Math.PI / 2;
      model.traverse((object) => {
        const mesh = object as T.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true; mesh.receiveShadow = true;
        for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (mapped.has(mat)) continue; mapped.add(mat);
          if (mat instanceof T.MeshStandardMaterial) {
            if (/concrete/.test(mat.name)) surfaces.apply(mat, "concrete", .65);
            else if (/steel/.test(mat.name)) { surfaces.apply(mat, "metal", .4); mat.normalScale.setScalar(.05); mat.roughness = Math.max(.62, mat.roughness); mat.envMapIntensity = .4; }
            if (/amber/.test(mat.name)) { mat.emissive.set("#ff9c3b"); mat.emissiveIntensity = .7; }
            if (/cyan/.test(mat.name)) mat.emissiveIntensity = 1.2;
          }
        }
      });
      scene.add(model);
      if (file === "oracle") {
        for (const [x, z, size] of [[-18, -18, .95], [10, -18, .78]]) {
          const neighbour = model.clone(true); neighbour.position.set(x, -.9, z); neighbour.scale.setScalar(size);
          neighbour.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = false; });
          scene.add(neighbour);
        }
      }
      renderer.shadowMap.needsUpdate = true;
    }).catch(() => { if (!disposed) onError(`The ${file} building could not load. Reload to retry.`); });
  }
  // Refuge character selection is independent of the legacy city.
  const character = "NEON SENTINEL";
  const loadTimeout = window.setTimeout(() => { if (!disposed) onReady("RUNNER"); }, 12000);
  loader.loadAsync("/game/models/mixamo/neon-sentinel-mixamo-test.glb")
    .then((gltf) => {
      if (disposed) { disposeTree(gltf.scene); return; }
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const run = gltf.animations.find((a) => /run|walk/i.test(a.name));
      const bounds = new T.Box3().setFromObject(root);
      const size = bounds.getSize(new T.Vector3()); const scale = 1.85 / size.y;
      root.scale.multiplyScalar(scale); root.updateMatrixWorld(true);
      const scaledBounds = new T.Box3().setFromObject(root);
      root.position.y -= scaledBounds.min.y;
      root.traverse((o) => {
        const mesh = o as T.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        // The cached sun map contains an older skeletal pose. Receiving it on
        // the animated skin projects stale limbs across the back every few frames.
        // Keep the ground shadow, but light the runner without this self-shadow.
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (!(mat instanceof T.MeshStandardMaterial)) continue;
          mat.normalScale.setScalar(0.55);
          for (const texture of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap]) {
            if (!texture) continue;
            texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            texture.minFilter = T.LinearMipmapLinearFilter;
            texture.needsUpdate = true;
          }
        }
      });
      player.remove(fallback);
      // Shared refuge materials must remain alive; only the temporary rig geometry is owned here.
      fallback.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).geometry.dispose(); });
      hero = new T.Group(); hero.add(root); player.add(hero);
      mixer = new T.AnimationMixer(root);
      const idle = gltf.animations.find((a) => /idle/i.test(a.name));
      if (idle) idleAction = mixer.clipAction(idle).play();
      else { pose = new PoseController(root); pose.buildIdle(root); }
      if (run) {
        // Keep locomotion in world code: retain pelvis height but remove clip X/Z travel.
        const inPlace = run.clone();
        for (const track of inPlace.tracks) if (/hips\.position$/i.test(track.name)) for (let i = 0; i < track.values.length; i += 3) { track.values[i] = track.values[0]; track.values[i + 2] = track.values[2]; }
        runAction = mixer.clipAction(inPlace); runAction.setEffectiveWeight(0).play();
      }
      clearTimeout(loadTimeout); onReady(character.toUpperCase());
      renderer.shadowMap.needsUpdate = true;
    }).catch(() => { clearTimeout(loadTimeout); if (!disposed) { onReady("RUNNER"); onError("Character model unavailable. A service rig is active; the refuge is still playable."); } });

  const rainCount = mobile ? 250 : 650, rainPositions = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainCount; i++) {
    const x = (rand() - 0.5) * 28, y = rand() * 16, z = (rand() - 0.5) * 22;
    rainPositions.set([x, y, z, x - 0.06, y + 0.35, z], i * 6);
  }
  const rainGeometry = new T.BufferGeometry(); rainGeometry.setAttribute("position", new T.BufferAttribute(rainPositions, 3));
  const rain = new T.LineSegments(rainGeometry, new T.LineBasicMaterial({ color: 0xb9d8d8, transparent: true, opacity: 0.19, depthWrite: false }));
  rain.frustumCulled = false; scene.add(rain);
  const keys = new Set<string>(); let stick = { x: 0, y: 0 };
  const azimuth = 0.48;
  const pivot = new T.Vector3(SPAWN.x, 1.05, SPAWN.z), desiredPivot = pivot.clone();
  let frame = 0, last = performance.now(), fpsTime = last, frames = 0, fps = 0, reportTime = 0;
  const startedAt = last;
  let samples: number[] = [], p95 = 0, lastShadow = 0, submitMs = 0, timingLimited = false;
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    const ratio = renderRatio(w, h, devicePixelRatio, quality);
    renderer.setPixelRatio(ratio); composer.setPixelRatio(ratio);
    renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const raycaster = new T.Raycaster(), pointer = new T.Vector2(), hit = new T.Vector3(), floor = new T.Plane(new T.Vector3(0, 1, 0), -0.08);
  let down: { x: number; y: number; id: number } | null = null;
  const onDown = (e: PointerEvent) => { if (e.button !== 0) return; down = { x: e.clientX, y: e.clientY, id: e.pointerId }; renderer.domElement.focus({ preventScroll: true }); };
  const onUp = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12; down = null;
    if (!tap || paused) return;
    const r = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(floor, hit)) {
      const end = { x: hit.x, z: hit.z };
      if (canStand(end)) { path = findPath(player.position, end); targetMarker.position.set(end.x, 0.1, end.z); targetMarker.visible = path.length > 0; }
    }
  };
  const editable = (e: KeyboardEvent) => e.target instanceof HTMLElement && !!e.target.closest("input, textarea, select, button, a, [role=dialog]");
  const keyDown = (e: KeyboardEvent) => {
    if (editable(e)) return;
    const key = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "q", "e", "r", " "].includes(key)) e.preventDefault();
    keys.add(key);
    if (key === "e" && !e.repeat && !paused) { const near = nearestStation(player.position); if (near) onInteract(near.id); }
  };
  const keyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  const clearInput = () => { keys.clear(); stick = { x: 0, y: 0 }; down = null; path = []; targetMarker.visible = false; };
  const wheel = (e: WheelEvent) => { e.preventDefault(); };
  const lostContext = (e: Event) => { e.preventDefault(); cancelAnimationFrame(frame); onError("Graphics connection lost. Reload the refuge to reconnect."); };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointercancel", clearInput);
  renderer.domElement.addEventListener("wheel", wheel, { passive: false });
  renderer.domElement.addEventListener("webglcontextlost", lostContext);
  window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", clearInput);
  document.addEventListener("visibilitychange", clearInput);

  function animate(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    if (document.hidden) { last = now; fpsTime = now; frames = 0; samples = []; return; }
    const frameMs = now - last;
    samples.push(frameMs);
    const dt = Math.min(frameMs / 1000, 0.05); last = now;
    const time = now / 1000;
    surfaceDetails.update(reducedMotion ? 0 : time);
    (puddle.material as T.ShaderMaterial).uniforms.waterTime.value = reducedMotion ? 0 : time;
    let walking = false;
    if (!paused) {
      let sx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0) + stick.x;
      let sy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0) + stick.y;
      let dx = 0, dz = 0;
      const length = Math.hypot(sx, sy);
      if (length > 0.12) {
        sx /= Math.max(1, length); sy /= Math.max(1, length); path = []; targetMarker.visible = false;
        dx = sx * Math.cos(azimuth) + sy * Math.sin(azimuth);
        dz = -sx * Math.sin(azimuth) + sy * Math.cos(azimuth);
      } else if (path.length) {
        const p = path[0], distance = Math.hypot(p.x - player.position.x, p.z - player.position.z);
        if (distance < 0.12) path.shift();
        else { dx = (p.x - player.position.x) / distance; dz = (p.z - player.position.z) / distance; }
        if (!path.length) targetMarker.visible = false;
      }
      const speed = keys.has("shift") ? 5 : 3.1;
      const next = moveWithCollision(player.position, dx * speed * dt, dz * speed * dt);
      walking = Math.hypot(next.x - player.position.x, next.z - player.position.z) > 0.0001;
      player.position.x = next.x; player.position.z = next.z;
      if (walking) {
        const yaw = Math.atan2(dx, dz), difference = Math.atan2(Math.sin(yaw - hero.rotation.y), Math.cos(yaw - hero.rotation.y));
        hero.rotation.y += difference * Math.min(1, dt * 14);
      }
    }
    if (walking !== previousWalking) {
      renderer.shadowMap.needsUpdate = true;
      previousWalking = walking;
    }
    locomotionBlend = T.MathUtils.damp(locomotionBlend, walking ? 1 : 0, 16, dt);
    if (runAction) runAction.setEffectiveWeight(locomotionBlend);
    if (idleAction) idleAction.setEffectiveWeight(1 - locomotionBlend);
    mixer?.update(dt);
    pose?.apply(1 - locomotionBlend);
    const portrait = camera.aspect < 0.85;
    // Aim at the hero's body with no sideways or forward composition offset.
    desiredPivot.set(player.position.x, player.position.y + 0.93, player.position.z);
    pivot.lerp(desiredPivot, reducedMotion ? 1 : 1 - Math.exp(-dt * 8));
    // End the exponential tail below a subpixel world-space distance.
    if (pivot.distanceToSquared(desiredPivot) < 0.000001) pivot.copy(desiredPivot);
    const distance = portrait ? 32 : 25;
    camera.position.set(pivot.x + Math.sin(azimuth) * distance * 0.86, pivot.y + distance * 0.62, pivot.z + Math.cos(azimuth) * distance * 0.86);
    camera.lookAt(pivot);
    rain.visible = rainOn;
    if (rainOn) {
      for (let i = 0; i < rainCount; i++) {
        const k = i * 6;
        rainPositions[k + 1] -= dt * 9; rainPositions[k + 4] -= dt * 9;
        if (rainPositions[k + 1] < 0) { rainPositions[k + 1] = 15; rainPositions[k + 4] = 15.35; }
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
    npcs.forEach((n, i) => { if (!reducedMotion) n.position.y = 0.08 + Math.sin(time * 1.7 + i) * 0.015; });
    // Static lighting is cached; refresh shadows at a bounded rate while moving.
    if ((walking || locomotionBlend > 0.001) && now - lastShadow > (quality.high ? 33 : 65)) {
      renderer.shadowMap.needsUpdate = true; lastShadow = now;
    }
    renderer.info.reset();
    const renderStart = performance.now();
    if (quality.high) composer.render(); else renderer.render(scene, camera);
    submitMs = Math.round((performance.now() - renderStart) * 10) / 10;
    frames++;
    if (now - fpsTime > 2000) {
      fps = Math.round(frames * 1000 / (now - fpsTime));
      const ordered = samples.sort((a, b) => a - b); p95 = Math.round(ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? 0);
      frames = 0; fpsTime = now; samples = [];
      // Some embedded/background hosts force a 1 Hz rAF despite cheap rendering.
      // Flag that cadence rather than presenting it as a meaningful GPU benchmark.
      timingLimited = fps <= 2 && p95 >= 900 && p95 <= 1100 && submitMs < 50;
      if (now - startedAt > 10000 && !timingLimited) {
        const next = adaptQuality(quality, fps);
        if (next.high !== quality.high || next.scale !== quality.scale) {
          quality = next; puddle.visible = quality.high; rainGeometry.setDrawRange(0, quality.high ? rainCount * 2 : Math.min(rainCount, 180) * 2); resize();
        } else quality = next;
      }
    }
    if (now - reportTime > 130) {
      onSnapshot({ x: player.position.x, z: player.position.z, near: nearestStation(player.position)?.id ?? null, fps, p95, draws: renderer.info.render.calls, triangles: renderer.info.render.triangles, ratio: renderer.getPixelRatio(), high: quality.high, submitMs, timingLimited }); reportTime = now;
    }
  }
  frame = requestAnimationFrame(animate);
  return {
    setPaused(value) { paused = value; clearInput(); },
    setStick(x, y) { stick = { x, y }; },
    setRain(value) { rainOn = value; },
    setQuality(value) { quality = initialQuality(mobile, value); puddle.visible = quality.high; rainGeometry.setDrawRange(0, quality.high ? rainCount * 2 : Math.min(rainCount, 180) * 2); renderer.shadowMap.needsUpdate = true; resize(); },
    resetCamera() { pivot.copy(desiredPivot); },
    goTo(id) { const station = STATIONS.find((s) => s.id === id); if (station && !paused) { path = findPath(player.position, { x: station.x, z: station.z + 1 }); targetMarker.position.set(station.x, 0.1, station.z + 1); targetMarker.visible = path.length > 0; } },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); clearTimeout(loadTimeout); observer.disconnect(); draco.dispose();
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", clearInput);
      renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", clearInput); renderer.domElement.removeEventListener("wheel", wheel);
      renderer.domElement.removeEventListener("webglcontextlost", lostContext);
      mixer?.stopAllAction(); if (mixer) mixer.uncacheRoot(mixer.getRoot());
      puddle.getRenderTarget().dispose(); disposeTree(scene); environment.dispose(); surfaces.dispose(); bloom.dispose(); output.dispose(); composer.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
