import * as T from "three";
import {createRefugeNpc,isEditableNpcBatch} from "./npc";
import type {WorldEditor,EditorState} from "../world-editor/controller";
import {createLazyEditor} from "../world-editor/lazy-editor";
import {setBaseEditorColliders,setBaseStationOverride,clearBaseEditor,getBaseStations} from "./world";
import { createGltfLoader } from "../../src/renderer/three/gltf-loader";
import { disposeObjectTree } from "../../src/renderer/three/dispose";
import { ASSET_URLS } from "../../src/assets/registry";
import { createFrameLoop, type FrameTick } from "../../src/core/loop/frame-loop";
import { createMovementInput } from "../../src/input/movement-input";
import { physicalMovementKey } from "../../src/input/keyboard/physical-movement-key.ts";
import { BASE_CAMERA, createFollowCamera } from "../../src/renderer/camera/follow-camera";
import { createFrameCamera, type FrameCameraMode } from '../../src/renderer/camera/frame-camera.ts';
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createHeroAnimator, loadHero, type HeroAnimator } from "../../src/renderer/animations/hero/hero.ts";
import { CombatDriver } from "../game/combat-driver";
import { buildMetro, courtyardFloorGeometry } from "./metro";
import { createRefugeMaterials } from "./materials";
import { addRefugeSurfaceDetails } from "./details";
import { createWetFloor } from "./wet-floor";
import { BACKGROUND_NORTH, FLOOR_CENTER_X, FLOOR_CENTER_Z, FLOOR_DEPTH, FLOOR_EAST, FLOOR_SOUTH, FLOOR_WEST, FLOOR_WIDTH } from './layout.ts';
import { buildRefugeZones } from "./zones";
import { buildConcretePerimeter } from "./fence";
import { adaptQuality, initialQuality, renderRatio, type QualityMode } from "./quality";
import { adaptMobileBudget, initialMobileBudget, mobileRenderRatio, usesTouchProfile } from "../expedition/mobile-performance";
import { canStand, findPath, moveWithCollision, nearestStation, SPAWN, STATIONS, type Point, type StationId } from "./world";
import { createImplantsBuilding } from "../../src/renderer/environment/implants-building.ts";
import { createElevatedRail } from "../../src/renderer/environment/elevated-rail.ts";
import { createCityStreet } from "../../src/renderer/environment/city-street.ts";
import { createMetroOpening } from "../../src/renderer/environment/metro-opening.ts";
import { createMediaTower } from "../../src/renderer/environment/media-tower.ts";
import { createReferenceBuildingLibrary } from "../../src/renderer/three/reference-building-library.ts";

const DEV_TOOLS = process.env.CYBERBASE_DEV_TOOLS === "1";

export type BaseSnapshot = { x: number; z: number; near: StationId | null; fps: number; p95: number; draws: number; triangles: number; ratio: number; high: boolean; submitMs: number; timingLimited: boolean; target: 30 | 60; scale: number; cameraMode: FrameCameraMode };
export type BaseEngine = {
  editor:WorldEditor; setMaster(value:boolean):void;
  dispose(): void; setPaused(value: boolean): void; setStick(x: number, y: number): void;
  setRain(value: boolean): void; setTraffic(value: boolean): void; setQuality(value: QualityMode): void;
  resetCamera(): void; goTo(id: StationId): void;
  frameCamera(): void; zoomCamera(delta: number): void; fixCamera(): boolean;
  restoreCameraPreset2(): boolean;
};

export function createBaseScene(
  host: HTMLElement,
  onReady: (heroName: string) => void,
  onSnapshot: (value: BaseSnapshot) => void,
  onInteract: (id: StationId) => void,
  onError: (message: string) => void,
  onEditor: (state:EditorState) => void = () => {},
): BaseEngine {
  const scene = new T.Scene();
  scene.background = new T.Color("#101b23");
  scene.fog = new T.FogExp2("#101d28", 0.014);
  const mobile = usesTouchProfile({ pointerCoarse: matchMedia("(pointer:coarse)").matches, anyPointerCoarse: matchMedia("(any-pointer:coarse)").matches, hoverNone: matchMedia("(hover:none)").matches, width: window.innerWidth, height: window.innerHeight });
  let quality = initialQuality(mobile);
  let budget = initialMobileBudget(), resolutionScale = 1;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.localClippingEnabled = true;
  const metroOpening = createMetroOpening();
  renderer.setPixelRatio(mobile ? mobileRenderRatio(host.clientWidth, host.clientHeight, devicePixelRatio, resolutionScale) : renderRatio(host.clientWidth, host.clientHeight, devicePixelRatio, quality));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.info.autoReset = false;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const surfaces = createRefugeMaterials(Math.min(mobile ? 4 : Infinity, renderer.capabilities.getMaxAnisotropy()));
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
  // Touch Auto/Lite never allocate postprocessing buffers. Explicit High still
  // works, and desktop keeps its existing MSAA/bloom rendering.
  let composer: EffectComposer | undefined, bloom: UnrealBloomPass | undefined, output: OutputPass | undefined;
  const enablePostprocessing = () => {
    if (composer) return;
    composer = new EffectComposer(renderer, new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: Math.min(mobile ? 2 : 4, renderer.capabilities.maxSamples) }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new T.Vector2(800, 600), 0.32, 0.65, 1.05); composer.addPass(bloom);
    output = new OutputPass(); composer.addPass(output);
  };
  if (!mobile) enablePostprocessing();
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
  type EditLabel = { id: string; name: string };
  const editLabels = new Map<T.Object3D, EditLabel>();
  const boxLabels = new Map<T.Material, EditLabel[]>();
  const instanceLabels = new Map<T.InstancedMesh, readonly EditLabel[]>();
  let currentLabel: EditLabel | undefined, partId = 0;
  const section = (id: string, name: string, build: () => void) => {
    const previous = currentLabel, before = new Set(scene.children);
    currentLabel = { id, name };
    build();
    for (const object of scene.children) {
      if (!before.has(object) && !editLabels.has(object)) editLabels.set(object, currentLabel);
    }
    currentLabel = previous;
  };
  const dummy = new T.Object3D();
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: T.Material, ry = 0) => {
    dummy.position.set(x, y, z); dummy.scale.set(w, h, d); dummy.rotation.set(0, ry, 0); dummy.updateMatrix();
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat)!.push(dummy.matrix.clone());
    {
      const labels = boxLabels.get(mat) ?? [];
      labels.push(currentLabel ?? { id: `base:part:${++partId}`, name: `Деталь / ${partId} (${x.toFixed(1)}, ${z.toFixed(1)})` });
      boxLabels.set(mat, labels);
    }
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

  // The metro's live opening clips both structural layers and the paving.
  section("base:foundation", "Основание платформы", () => {
  box(FLOOR_CENTER_X, -0.68, FLOOR_CENTER_Z, FLOOR_WIDTH + 1, 1.3, FLOOR_DEPTH + 1, metroOpening.material(m.dark));
  box(FLOOR_CENTER_X, -0.11, FLOOR_CENTER_Z, FLOOR_WIDTH, .22, FLOOR_DEPTH, metroOpening.material(m.concrete));
  for (let x = FLOOR_WEST + .65; x < FLOOR_EAST; x += 1.3) {
    box(x, -0.6, FLOOR_SOUTH - .45, 1.17, 0.88, 0.18, m.edge);
    if (x % 2 < 1) box(x, -0.5, FLOOR_SOUTH - .34, 0.45, 0.1, 0.03, m.brass);
  }
  pipe([[FLOOR_WEST + .4, -0.7, FLOOR_SOUTH - .3], [0, -0.7, FLOOR_SOUTH - .3], [FLOOR_EAST - .4, -0.7, FLOOR_SOUTH - .3]], 0.08);

  });
  // The scan supplies aligned stone faces, chipped joints and normals.
  // A second geometric grid would cut across those joints, so use one receiver.
  const stone = surfaces.apply(new T.MeshStandardMaterial({ color: "#c9cfd3", roughness: .9, metalness: .02 }), "stone", .25);
  metroOpening.apply(stone);
  section("base:floor", "Покрытие двора", () => {
  const courtyardFloor = new T.Mesh(courtyardFloorGeometry(),stone);
  courtyardFloor.rotation.x = -Math.PI/2; courtyardFloor.position.y=.075;
  courtyardFloor.receiveShadow=true; scene.add(courtyardFloor);
  });
  section("base:markings", "Разметка двора", () => {
  for (let z = -8; z <= 9; z += 0.34) {
    box(-3.4, 0.076, z, 0.22, 0.026, 0.27, m.black);
    box(3.4, 0.076, z, 0.22, 0.026, 0.27, m.black);
  }
  for (let x = -9; x < 10; x += 0.7) box(x, 0.073, 7.8, 0.34, 0.025, 0.08, m.brass);

  });
  section("base:metro", "Метро · вход и лестница", () => buildMetro({ box, cylinder, pipe, sign, light, m, surface: surfaces.apply }));
  buildRefugeZones({ box, cylinder, pipe, sign, light, m, surface: surfaces.apply, section, groundMaterial: metroOpening.apply });

  section("base:city-gate", "Городской шлюз", () => {
  sign("NEON SPRAWL", "CITY AIRLOCK / SEALED", -14.3, 4.5, 0, 4, "#8cc5c3", Math.PI / 2);
  light(-13.95, 2.8, 0, 0x80d5e7, 18, 6);
  });
  const fenceConcrete = surfaces.apply(new T.MeshStandardMaterial({
    name: "Weathered precast concrete", color: "#a5a49b", roughness: .96, metalness: 0,
  }), "concrete", .65);
  fenceConcrete.normalScale.setScalar(.7);
  // Keep the already merged fence separate from the indexed pipe batches.
  section("base:perimeter", "Обломки периметра", () => buildConcretePerimeter(scene, fenceConcrete, m.edge.clone(), section));

  // A wide, damaged expedition passage branches from the refuge perimeter.
  section("base:annex-floor", "Дорога к пристройке", () => {
  box(19, -0.35, 7.5, 8, 0.7, 5.4, metroOpening.material(m.dark));
  box(26, -0.35, 7.5, 6.2, 0.7, 7.2, metroOpening.material(m.dark));
  });
  for (const z of [4.8, 10.2]) section(z < 7 ? "base:rail-north" : "base:rail-south", z < 7 ? "Ограда прохода · север" : "Ограда прохода · юг", () => {
    for (let x = 15; x <= 23; x++) {
      box(x, 0.75, z, 0.09, 1.5, 0.09, m.brass);
      if (x % 2 === 1) box(x, 1.52, z, 0.14, 0.07, 0.14, m.teal);
    }
    for (const y of [0.25, 0.65, 1.05, 1.45]) box(19, y, z, 8, 0.035, 0.035, m.edge);
    for (let x = 15.25; x < 23; x += 0.25) box(x, 0.82, z, 0.025, 1.2, 0.025, m.edge);
    box(19, 0.11, z + (z < 7 ? 0.16 : -0.16), 8, 0.025, 0.05, m.teal);
  });
  section("base:breach", "Проход в экспедицию", () => {
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
  });
  section("base:charge-back", "Задняя стена пристройки", () => box(26, 1.65, 4, 6.2, 3.3, 0.25, m.wall));
  section("base:charge-east", "Восточная стена пристройки", () => box(29, 1.15, 7.5, 0.25, 2.3, 7, m.wall));
  section("base:charge-front", "Парапет пристройки", () => box(26, 0.38, 11, 6, 0.75, 0.25, m.edge));
  for (const z of [5, 10]) section(z < 7 ? "base:charge-door-north" : "base:charge-door-south", "Стойка прохода", () => box(23, 0.6, z, 0.25, 1.2, 2, m.edge));
  box(26, 3.34, 4, 6.4, 0.18, 0.5, m.brass);
  sign("QUANTUM CHARGE", "DAILY CYCLE / STANDBY", 26, 2.55, 4.16, 4.6, "#9ae5ec");
  section("base:charge-dock", "Quantum Charge · станция", () => {
  box(26, 0.65, 5.1, 2, 1.2, 1.1, m.dark);
  box(26, 1.29, 5.1, 2.2, 0.12, 1.25, m.brass);
  cylinder(26, 1.4, 5.1, 0.45, 0.12, m.teal);
  for (const x of [25.25, 26.75]) {
    box(x, 1.8, 5.05, 0.16, 1.1, 0.18, m.edge);
    box(x, 1.8, 5.18, 0.07, 0.75, 0.04, m.teal);
  }
  });
  box(28.2, 0.55, 4.8, 0.7, 1.1, 0.8, m.rust);
  light(26, 2.4, 5.7, 0x78dfe9, 25, 7);

  function crate(x: number, z: number, size = 0.8, y = 0) {
    section(`base:crate:${x}:${z}`, `Ящик (${x}, ${z})`, () => {
    box(x, y + size / 2, z, size, size, size * 0.8, m.dark);
    for (const side of [-1, 1]) box(x + side * size * 0.37, y + size / 2, z + size * 0.41, 0.07, size, 0.08, m.brass);
    box(x, y + size * 0.78, z + size * 0.42, size * 0.4, 0.11, 0.04, m.concrete);
    });
  }
  crate(-10.7, 5, 0.6);
  crate(10.5, -5.2); crate(11.1, -4.1, 0.65); crate(-10.8, -5.4, 0.9);
  section("base:battery", "Батарейный док", () => {
  // Battery dock: physically present, but no timed or financial reward in stage 1.
  box(-7.4, 0.63, -5.6, 1.35, 1.2, 0.75, m.dark);
  box(-7.4, 1.26, -5.6, 1.55, 0.1, 0.95, m.brass);
  for (const x of [-7.78, -7.4, -7.02]) {
    cylinder(x, 1.53, -5.6, 0.12, 0.48, m.edge);
    cylinder(x, 1.74, -5.6, 0.13, 0.06, m.teal);
  }
  box(-7.4, 0.83, -5.2, 0.45, 0.25, 0.03, m.teal);

  });
  function planter(x: number, z: number, w: number) {
    section(x < 0 ? "base:planter-west" : "base:planter-east", x < 0 ? "Клумба · запад" : "Клумба · восток", () => {
    box(x, 0.28, z, w, 0.5, 1.25, m.edge);
    box(x, 0.55, z, w + 0.12, 0.12, 1.37, m.brass);
    box(x, 0.63, z, w - 0.2, 0.08, 1.0, m.black);
    for (let i = 0; i < 26; i++) {
      const xx = x + (rand() - 0.5) * (w - 0.3), zz = z + (rand() - 0.5) * 0.9;
      const h = 0.35 + rand() * 0.7;
      box(xx, 0.68 + h / 2, zz, 0.025, h, 0.025, m.rust);
    }
    });
  }
  planter(-5.4, 0.2, 2.8); planter(5.1, 0.2, 2.8);
  // Windblown debris.
  for (let i = 0; i < 85; i++) {
    const x = (rand() - 0.5) * 24, z = (rand() - 0.5) * 19;
    if (rand() < 0.6 && Math.abs(x) < 4) continue;
    box(x, 0.09, z, 0.06 + rand() * 0.12, 0.015, 0.06 + rand() * 0.19, rand() > 0.3 ? m.leaf : m.brass, rand() * 6);
  }
  // Four bollard lights and terminal rings.
  for (const [x, z] of [[-9, 7], [9, 7], [-3.7, -5.6], [3.7, -5.6]]) section(`base:lamp:${x}:${z}`, `Фонарь (${x}, ${z})`, () => {
    box(x, 0.53, z, 0.26, 1, 0.26, m.dark); box(x, 1.05, z, 0.28, 0.16, 0.28, m.amber);
  });
  const stationRings=new Map<StationId,T.Mesh>();
  for (const st of STATIONS) {
    const ring = new T.Mesh(new T.RingGeometry(0.58, 0.61, 40), new T.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.5, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(st.x, 0.1, st.z); scene.add(ring);stationRings.set(st.id,ring);
  }

  // Stylised service NPCs with layered coats, visors, backpacks and relaxed arms.
  const npcs: T.Group[] = [];
  function npc(x: number, z: number, accent: T.Material, coat: T.Material) {
    const group = createRefugeNpc(accent,coat,m);group.position.set(x,0.08,z);scene.add(group);
    npcs.push(group); return group;
  }
  npc(-7.3, -4.6, m.amber, m.rust); npc(0, -2.4, m.teal, m.dark); npc(8, -4.7, m.amber, m.black);
  npc(2.1, -5.4, m.teal, m.edge); npc(-8, 3, m.amber, m.green);

  for (const [mat, transforms] of batches) {
    const mesh = new T.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.018), mat, transforms.length);
    transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    instanceLabels.set(mesh, boxLabels.get(mat)!);
    mesh.castShadow = mat !== m.teal && mat !== m.amber; mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const excludedEditorObjects = new Set<T.Object3D>([hemi, sun, rim, courtyardFill, ...npcs, ...stationRings.values()]);
  const editableSources = scene.children.filter(object => !excludedEditorObjects.has(object));
  editableSources.forEach((object, i) => {
    if (!editLabels.has(object)) editLabels.set(object, { id: `base:surface:${i}`, name: object.name || `Поверхность / ${i + 1}` });
  });
  // Merge static pipes, fans and service rigs by material, reducing draw calls.
  // Batched building boxes already use instancing. Animated Outlaw is added later.
  scene.updateMatrixWorld(true);
  const staticMeshes = new Map<T.Material, T.Mesh[]>();
  scene.traverse((object) => {
    const mesh = object as T.Mesh;
    if (isEditableNpcBatch(mesh)) return;
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
    meshes.forEach((mesh) => { mesh.removeFromParent(); });
  }
  const editableRendered = scene.children.filter(object => !excludedEditorObjects.has(object));
  const npcStations=["smith","contracts","metro","oracle","market"] as const;
  let editableRender: import("./editable-render").EditableRender | undefined;
  let editorShadowDirty = false;
  const worldAssetLoads: Promise<unknown>[] = [];
  const editor=createLazyEditor(()=>import("./base-map-editor").then(async ({createBaseMapEditor}) => {
    await Promise.allSettled(worldAssetLoads);
    return () => {
      const result = createBaseMapEditor({
        scene, sources: editableSources, rendered: editableRendered, labels: editLabels, instanceLabels,
        npcs: npcs.map((object, i) => ({ id: `npc:${npcStations[i]}`, name: npcStations[i], object,
          onTransform: e => { setBaseStationOverride(npcStations[i],{x:e.x,z:e.z,deleted:!!e.deleted}); const ring=stationRings.get(npcStations[i]); if(ring){ring.position.set(e.x,.1,e.z);ring.visible=!e.deleted;} }
        })),
        onEditor: state => { editorShadowDirty = true; onEditor(state); },
        onColliders: setBaseEditorColliders,
        onPan: (x,z) => { pivot.x+=x;pivot.z+=z; },
        onFocus: (x,z) => { pivot.x=x;pivot.z=z; },
        onFloorVisibility: value => { floorVisible = value; },
        onMetroTransform: metroOpening.update,
      });
      editableRender = result.render;
      return result.editor;
    };
  }),()=>onError("Не удалось восстановить карту. Сохранение не изменено. Перезагрузите страницу для повторной попытки."));
  let publishedMap: ReturnType<typeof import("./published-map.ts").createPublishedMap> | undefined;
  const detailBefore = new Set(scene.children);
  const surfaceDetails = addRefugeSurfaceDetails(scene);
  for (const object of scene.children) {
    if (detailBefore.has(object)) continue;
    editableSources.push(object); editableRendered.push(object);
    editLabels.set(object, {id: `base:detail:${editableSources.length}`, name: "Декор поверхности"});
    if (object instanceof T.InstancedMesh) {
      instanceLabels.set(object, Array.from({length: object.count}, () => editLabels.get(object)!));
    }
    if (object instanceof T.InstancedMesh && object.count === 420) {
      instanceLabels.set(object, Array.from({length: 420}, (_, i) => ({
        id: i < 210 ? "base:planter-west" : "base:planter-east",
        name: i < 210 ? "Клумба · запад" : "Клумба · восток",
      })));
    }
  }

  let floorVisible = true;
  const puddle = createWetFloor(mobile, metroOpening); puddle.visible = quality.high; scene.add(puddle);

  const player = new T.Group(); player.position.set(SPAWN.x, 0.12, SPAWN.z); scene.add(player);
  // A small, unshadowed fill follows the runner and gently reaches nearby paving.
  const runnerFill = new T.PointLight(0xc8e4db, 3.2, 4.5, 2);
  runnerFill.position.set(0.4, 2.8, 1.1); player.add(runnerFill);
  const fallback = npc(0, 0, m.teal, m.edge); scene.remove(fallback); player.add(fallback); fallback.position.set(0, 0, 0);
  const heroVisualScale = 1.4;
  fallback.scale.setScalar(heroVisualScale);
  npcs.pop();
  const marker = new T.Mesh(new T.RingGeometry(0.38, 0.43, 48), new T.MeshBasicMaterial({ color: 0xc8e3d5, transparent: true, opacity: 0.8, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 0.01; player.add(marker);
  const targetMarker = new T.Mesh(new T.RingGeometry(0.23, 0.28, 40), new T.MeshBasicMaterial({ color: 0xb7decf, transparent: true, opacity: 0.8, depthWrite: false }));
  targetMarker.rotation.x = -Math.PI / 2; targetMarker.visible = false; scene.add(targetMarker);

  let disposed = false, paused = false, ready = false, contextLost = false, rainOn = !reducedMotion, path: Point[] = [];
  let assetsPending = 7, assetSettledAt = performance.now();
  const assetSettled = () => { assetsPending--; assetSettledAt = performance.now(); };
  // Never expose the authored fallback map while the owner's saved layout is loading.
  renderer.domElement.style.visibility = "hidden";
  let layoutReady = true, heroReadyName: string | undefined;
  const revealMap = () => {
    if (disposed || !layoutReady || !heroReadyName) return;
    ready = true;
    renderer.domElement.style.visibility = "visible";
    onReady(heroReadyName);
  };
  const markReady = (name: string) => { heroReadyName = name; revealMap(); };
  let heroAnimator: HeroAnimator | null = null;
  const combat = new CombatDriver(() => {}, () => 100);
  let hero: T.Object3D = fallback, previousWalking = false;
  const { loader, draco } = createGltfLoader();
  const mediaTower = createMediaTower(scene,
    createReferenceBuildingLibrary(mobile ? 2 : 4, url => loader.loadAsync(url)),
    onError, () => { assetSettled(); renderer.shadowMap.needsUpdate = true; });
  {
    worldAssetLoads.push(mediaTower.ready);
    editableSources.push(mediaTower.root); editableRendered.push(mediaTower.root);
    editLabels.set(mediaTower.root, { id: "base:media-tower", name: "Медиа-башня · стекло и портрет" });
  }
  const elevatedRail = createElevatedRail(scene, loader, mobile, onError, () => {
    assetSettled();
    renderer.shadowMap.needsUpdate = true;
  });
  let lastRailShadow = 0;
  const cityStreet = createCityStreet(scene, mobile);
  let trafficOn = !reducedMotion;
  const implantsBuilding = createImplantsBuilding(scene, loader, mobile, onError, () => {
    assetSettled();
    renderer.shadowMap.needsUpdate = true;
  });
  {
    worldAssetLoads.push(implantsBuilding.ready);
    editableSources.push(implantsBuilding.root); editableRendered.push(implantsBuilding.root);
    editLabels.set(implantsBuilding.root, { id: "base:implants", name: "Здание IMPLANTS" });
  }
  for (const [file, x, z] of [["workshop", -8.4, -8.6], ["oracle", 0, -9], ["city-gate", -14.8, 0]] as const) {
    const load = loader.loadAsync(ASSET_URLS.refugeBuilding(file)).then(({ scene: model }) => {
      if (disposed) { disposeObjectTree(model); return; }
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
      {
        editableSources.push(model); editableRendered.push(model);
        editLabels.set(model, {id: `base:${file}`, name: file === "workshop" ? "Здание CYBERSMITH" : file === "oracle" ? "Здание ORACLE" : "Городской шлюз"});
      }
      if (file === "oracle") {
        for (const [x, z, size] of [[-18, BACKGROUND_NORTH-3, .95], [10, BACKGROUND_NORTH-3, .78]]) {
          const neighbour = model.clone(true); neighbour.position.set(x, -.9, z); neighbour.scale.setScalar(size);
          neighbour.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = false; });
          scene.add(neighbour);
          { editableSources.push(neighbour); editableRendered.push(neighbour); editLabels.set(neighbour, {id:`base:neighbour:${x}`,name:`Соседний дом (${x})`}); }
        }
      }
      renderer.shadowMap.needsUpdate = true;
    }).catch(() => { if (!disposed) onError(`The ${file} building could not load. Reload to retry.`); }).finally(assetSettled);
    worldAssetLoads.push(load);
  }
  // The editor remains a development-only dynamic import. Restore saved scenery even
  // when MASTER is closed; its document readiness includes all placed model loads.
  if (DEV_TOOLS) {
    try {
      if (localStorage.getItem("cyberbase.world-editor.base.v1") !== null) {
        layoutReady = false;
        void editor.initialize().then(() => {
          if (disposed) return;
          layoutReady = true;
          revealMap();
        }).catch(() => { /* The lazy facade reports the error; keep the stale map hidden. */ });
      }
    } catch { onError("Сохранённая карта недоступна: браузер заблокировал локальное хранилище."); }
  }
  if (!DEV_TOOLS) {
    layoutReady = false;
    void Promise.all(worldAssetLoads).then(async () => {
      const { createPublishedMap } = await import("./published-map.ts");
      if (disposed) return;
      publishedMap = createPublishedMap({
        scene, sources: editableSources, rendered: editableRendered, labels: editLabels, instanceLabels,
        npcs: npcs.map((object, i) => ({ id: `npc:${npcStations[i]}`, object,
          onTransform: e => { setBaseStationOverride(npcStations[i], { x: e.x, z: e.z, deleted: !!e.deleted }); const ring = stationRings.get(npcStations[i]); if (ring) { ring.position.set(e.x, .1, e.z); ring.visible = !e.deleted; } }
        })),
        onColliders: setBaseEditorColliders,
        onFloorVisibility: value => { floorVisible = value; },
        onMetroTransform: metroOpening.update,
        onAssetsChanged: () => { renderer.shadowMap.needsUpdate = true; },
      });
      await publishedMap.ready;
      if (disposed) return;
      layoutReady = true;
      revealMap();
    }).catch(() => { if (!disposed) onError("Карта не загрузилась. Перезагрузите страницу для повторной попытки."); });
  }
  // Refuge character selection is independent of the legacy city.
  const character = "NEON SENTINEL";
  const loadTimeout = window.setTimeout(() => { if (!disposed) markReady("RUNNER"); }, 12000);
  loadHero(loader, ASSET_URLS.heroModel, (mesh) => {
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!(mat instanceof T.MeshStandardMaterial)) continue;
        mat.normalScale.setScalar(0.55);
        for (const texture of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap]) {
          if (!texture) continue;
          texture.anisotropy = Math.min(mobile ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
          texture.minFilter = T.LinearMipmapLinearFilter;
          texture.needsUpdate = true;
        }
      }
    })
    .then((gltf) => {
      if (disposed) { disposeObjectTree(gltf.scene); return; }
      const root = gltf.scene;
      player.remove(fallback);
      // Shared refuge materials must remain alive; only the temporary rig geometry is owned here.
      fallback.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).geometry.dispose(); });
      hero = new T.Group(); hero.add(root); player.add(hero);
      hero.scale.setScalar(heroVisualScale);
      heroAnimator = createHeroAnimator(root, gltf.animations, { idle: "clip-or-pose", run: /run|walk/i });
      combat.attach(root, heroAnimator.mixer, gltf.animations);
      clearTimeout(loadTimeout); markReady(character.toUpperCase());
      renderer.shadowMap.needsUpdate = true;
    }).catch(() => { clearTimeout(loadTimeout); if (!disposed) { markReady("RUNNER"); onError("Character model unavailable. A service rig is active; the refuge is still playable."); } }).finally(assetSettled);

  const rainCount = mobile ? 250 : 650, rainPositions = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainCount; i++) {
    const x = (rand() - 0.5) * 28, y = rand() * 16, z = (rand() - 0.5) * 22;
    rainPositions.set([x, y, z, x - 0.06, y + 0.35, z], i * 6);
  }
  const rainGeometry = new T.BufferGeometry(); rainGeometry.setAttribute("position", new T.BufferAttribute(rainPositions, 3));
  const rain = new T.LineSegments(rainGeometry, new T.LineBasicMaterial({ color: 0xb9d8d8, transparent: true, opacity: 0.19, depthWrite: false }));
  rain.frustumCulled = false; scene.add(rain);
  const input = createMovementInput(), moveDirection = { x: 0, z: 0 };
  const pivot = new T.Vector3(SPAWN.x, 1.05, SPAWN.z);
  const cameraRig = createFollowCamera(BASE_CAMERA, pivot);
  cameraRig.place(camera.position, camera.aspect, false); camera.lookAt(pivot);
  let cameraStorage: Storage | undefined;
  try { cameraStorage = localStorage; } catch { /* Framing remains available without storage. */ }
  const frameCamera = createFrameCamera(camera, renderer.domElement, cameraStorage, undefined, pivot);
  const loopStart = performance.now();
  let fpsTime = loopStart, frames = 0, fps = 0, reportTime = 0;
  let qualityWindow = loopStart, qualityFrames = 0, qualityElapsed = 0, lastResolution = 0;
  const startedAt = loopStart;
  let samples: number[] = [], p95 = 0, lastShadow = 0, submitMs = 0, timingLimited = false;
  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    const ratio = mobile ? mobileRenderRatio(w, h, devicePixelRatio, resolutionScale) : renderRatio(w, h, devicePixelRatio, quality);
    renderer.setPixelRatio(ratio); composer?.setPixelRatio(ratio);
    renderer.setSize(w, h); composer?.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const raycaster = new T.Raycaster(), pointer = new T.Vector2(), hit = new T.Vector3(), floor = new T.Plane(new T.Vector3(0, 1, 0), -0.08);
  let down: { x: number; y: number; id: number } | null = null;
  const onHover = (e: PointerEvent) => {
    if (!editor.active || frameCamera.mode === 'free') return;
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
    raycaster.setFromCamera(pointer,camera);
    if (raycaster.ray.intersectPlane(floor,hit)) editor.hover(hit);
  };
  const onDown = (e: PointerEvent) => {
    if (frameCamera.mode === 'free' || e.button !== 0 || down || paused || modalOpen || !ready) return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    renderer.domElement.focus({ preventScroll: true });
  };
  const onUp = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12;
    down = null;
    if (!tap || paused || modalOpen || !ready) return;
    const r = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if(editor.active){if(raycaster.ray.intersectPlane(floor,hit))editor.click(raycaster,hit);return;}
    if (raycaster.ray.intersectPlane(floor, hit)) {
      const end = { x: hit.x, z: hit.z };
      if (canStand(end)) { path = findPath(player.position, end); targetMarker.position.set(end.x, 0.1, end.z); targetMarker.visible = path.length > 0; }
    }
  };
  const editable = (e: KeyboardEvent) => e.target instanceof HTMLElement && !!e.target.closest("input, textarea, select, button, a, [role=dialog]");
  const keyDown = (e: KeyboardEvent) => {
    if (paused || modalOpen || !ready || e.isComposing || frameCamera.mode === 'free') return;
    const textEntry = e.target instanceof HTMLElement && !!e.target.closest('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])');
    if (textEntry) return;
    if (editor.active) { if (!editable(e)) editor.keyDown(e); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const movement = physicalMovementKey(e);
    if (editable(e) && !movement) return;
    // Reclaim play focus after ordinary HUD buttons, but never from a modal
    // or text input. A second click on the ground is no longer required to walk.
    if (movement) renderer.domElement.focus({ preventScroll: true });
    const key = movement ?? e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "q", "e", "r", " "].includes(key)) e.preventDefault();
    if (movement) input.keys.add(movement);
    if (key === "e" && !e.repeat && !paused) { const near = nearestStation(player.position); if (near) onInteract(near.id); }
  };
  const keyUp = (e: KeyboardEvent) => input.keys.delete(physicalMovementKey(e) ?? e.key.toLowerCase());
  const clearInput = () => { input.clear(); down = null; path = []; targetMarker.visible = false; };
  const resetInput = () => { clearInput(); window.dispatchEvent(new Event("netrunner:input-reset")); };
  let modalOpen = !!document.querySelector('[aria-modal="true"]');
  const modalObserver = new MutationObserver(() => {
    const next = !!document.querySelector('[aria-modal="true"]');
    if (next && !modalOpen) resetInput();
    modalOpen = next;
  });
  modalObserver.observe(host.parentElement ?? host, { childList: true, subtree: true });
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    if (paused || modalOpen || !ready) return;
    if (editor.active && frameCamera.mode === 'follow') cameraRig.zoomBy(e.deltaY);
  };
  const lostContext = (e: Event) => { e.preventDefault(); contextLost = true; resetInput(); loop.stop(); onError("Graphics connection lost. Reload the refuge to reconnect."); };
  renderer.domElement.addEventListener("pointermove",onHover);
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointercancel", clearInput);
  renderer.domElement.addEventListener("wheel", wheel, { passive: false });
  renderer.domElement.addEventListener("webglcontextlost", lostContext);
  window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", clearInput);
  window.addEventListener("netrunner:input-reset", clearInput);

  // Frame scheduling, hidden-tab handling, the mobile cadence cap and the delta
  // clamp live in the shared loop (src/core/loop); these are the per-frame phases.
  function updateFrame({ now, frameMs, dt }: FrameTick) {
    samples.push(frameMs);
    if (mobile) {
      if (ready && !paused && !modalOpen && (assetsPending === 0 || now - startedAt > 30000) && now - assetSettledAt > 2000 && frameMs > 0 && frameMs < 100) {
        qualityFrames++; qualityElapsed += frameMs;
        if (now - qualityWindow > 2000) {
          if (qualityFrames >= 10) budget = adaptMobileBudget(budget, qualityElapsed / qualityFrames);
          qualityFrames = qualityElapsed = 0; qualityWindow = now;
        }
      } else { qualityFrames = qualityElapsed = 0; qualityWindow = now; }
      if (now - lastResolution > 600 && Math.abs(resolutionScale - budget.scale) > .001) {
        resolutionScale += T.MathUtils.clamp(budget.scale - resolutionScale, -.025, .025); resize(); lastResolution = now;
      }
    }
    const time = now / 1000;
    cityStreet.update(!trafficOn || paused || modalOpen || editor.active ? 0 : dt);
    if (elevatedRail.update(paused || modalOpen || editor.active ? 0 : dt, reducedMotion)
      && !mobile && now - lastRailShadow > 100) {
      renderer.shadowMap.needsUpdate = true;
      lastRailShadow = now;
    }
    surfaceDetails.update(reducedMotion ? 0 : time);
    (puddle.material as T.ShaderMaterial).uniforms.waterTime.value = reducedMotion ? 0 : time;
    let walking = false;
    if (ready && !paused && !modalOpen && !editor.active && frameCamera.mode !== 'free') {
      let dx = 0, dz = 0;
      const azimuth = frameCamera.mode === 'follow' ? cameraRig.azimuth : frameCamera.azimuth;
      if (input.resolve(moveDirection, azimuth, 0.12)) {
        path = []; targetMarker.visible = false;
        dx = moveDirection.x; dz = moveDirection.z;
      } else if (path.length) {
        const p = path[0], distance = Math.hypot(p.x - player.position.x, p.z - player.position.z);
        if (distance < 0.12) path.shift();
        else { dx = (p.x - player.position.x) / distance; dz = (p.z - player.position.z) / distance; }
        if (!path.length) targetMarker.visible = false;
      }
      const speed = input.running ? 5 : 3.1;
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
    combat.tick(dt, paused || modalOpen || !ready || editor.active || frameCamera.mode === 'free');
    heroAnimator?.update(dt, walking, combat.weight);
    // Keep the original body-pivot damping; saved framing adds its composition offsets.
    if (frameCamera.mode !== 'free') {
      if (!editor.active) cameraRig.follow(player.position.x, player.position.y + 0.93, player.position.z, dt, reducedMotion);
      else cameraRig.follow(pivot.x, pivot.y, pivot.z, dt, reducedMotion);
      if (frameCamera.mode === 'fixed') frameCamera.place(pivot);
      else {
        cameraRig.place(camera.position, camera.aspect, editor.active);
        camera.lookAt(pivot);
      }
    }
    frameCamera.update(ready && !paused && !modalOpen);
    rain.visible = rainOn;
    puddle.visible = quality.high && floorVisible && !editor.active;
    if (rainOn) {
      for (let i = 0; i < rainCount; i++) {
        const k = i * 6;
        rainPositions[k + 1] -= dt * 9; rainPositions[k + 4] -= dt * 9;
        if (rainPositions[k + 1] < 0) { rainPositions[k + 1] = 15; rainPositions[k + 4] = 15.35; }
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
    editor.stream(editor.active?pivot:player.position);
    // Key repeat can emit much faster than rendering. Refresh changed scenery at
    // most 10 Hz in MASTER, and stop redrawing its shadows when the editor is idle.
    if (editorShadowDirty && (!editor.active || now - lastShadow > 100)) {
      renderer.shadowMap.needsUpdate = true; lastShadow = now; editorShadowDirty = false;
    }
    // Static lighting is cached; refresh shadows at a bounded rate while moving.
    if ((walking || (heroAnimator?.locomotionBlend ?? 0) > 0.001) && now - lastShadow > (mobile ? 100 : quality.high ? 33 : 65)) {
      renderer.shadowMap.needsUpdate = true; lastShadow = now;
    }
  }

  function renderFrame({ now }: FrameTick) {
    renderer.info.reset();
    const renderStart = performance.now();
    if (quality.high && composer) composer.render(); else renderer.render(scene, camera);
    submitMs = Math.round((performance.now() - renderStart) * 10) / 10;
    frames++;
    if (now - fpsTime > 2000) {
      fps = Math.round(frames * 1000 / (now - fpsTime));
      const ordered = samples.sort((a, b) => a - b); p95 = Math.round(ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? 0);
      frames = 0; fpsTime = now; samples = [];
      // Some embedded/background hosts force a 1 Hz rAF despite cheap rendering.
      // Flag that cadence rather than presenting it as a meaningful GPU benchmark.
      timingLimited = fps <= 2 && p95 >= 900 && p95 <= 1100 && submitMs < 50;
      if (!mobile && now - startedAt > 10000 && !timingLimited) {
        const next = adaptQuality(quality, fps);
        if (next.high !== quality.high || next.scale !== quality.scale) {
          quality = next; puddle.visible = quality.high; rainGeometry.setDrawRange(0, quality.high ? rainCount * 2 : Math.min(rainCount, 180) * 2); resize();
        } else quality = next;
      }
    }
    if (now - reportTime > 130) {
      onSnapshot({ x: player.position.x, z: player.position.z, near: nearestStation(player.position)?.id ?? null, fps, p95, draws: renderer.info.render.calls, triangles: renderer.info.render.triangles, ratio: renderer.getPixelRatio(), high: quality.high, submitMs, timingLimited, target: mobile ? budget.target : 60, scale: mobile ? resolutionScale : quality.scale, cameraMode: frameCamera.mode }); reportTime = now;
    }
  }
  const loop = createFrameLoop({
    startTime: loopStart,
    targetFps: () => (mobile ? budget.target : null),
    onVisibilityChange(now) {
      resetInput();
      fpsTime = qualityWindow = now; frames = qualityFrames = qualityElapsed = 0; samples = [];
    },
    update: updateFrame,
    render: renderFrame,
  });
  loop.start();
  return {
    editor,setMaster(value){editor.setActive(value);resetInput();},
    setPaused(value) { paused = value; resetInput(); },
    setStick(x, y) {
      if (frameCamera.mode === 'free' || editor.active || paused || modalOpen || !ready || document.hidden || contextLost) { input.clearStick(); return; }
      input.setStick(x, y);
    },
    setRain(value) { rainOn = value; },
    setTraffic(value) { trafficOn = value; },
    setQuality(value) { quality = initialQuality(mobile, value); if (quality.high) enablePostprocessing(); puddle.visible = quality.high; rainGeometry.setDrawRange(0, quality.high ? rainCount * 2 : Math.min(rainCount, 180) * 2); renderer.shadowMap.needsUpdate = true; resize(); },
    frameCamera() { resetInput(); frameCamera.start(pivot); },
    zoomCamera(delta) { frameCamera.zoomBy(delta); },
    fixCamera() { resetInput(); return frameCamera.fix(pivot); },
    restoreCameraPreset2() { resetInput(); return frameCamera.restorePreset2(pivot); },
    resetCamera() { frameCamera.follow(); cameraRig.moveTo(player.position.x, player.position.z); pivot.y = player.position.y + .93; resetInput(); },
    goTo(id) { const station = getBaseStations().find((s) => s.id === id); if (station && ready && !paused && !modalOpen && !editor.active) { path = findPath(player.position, { x: station.x, z: station.z + 1 }); targetMarker.position.set(station.x, 0.1, station.z + 1); targetMarker.visible = path.length > 0; } },
    dispose() {
      disposed = true; clearInput(); frameCamera.dispose(); loop.dispose(); clearTimeout(loadTimeout); observer.disconnect(); draco.dispose();
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clearInput);
      window.removeEventListener("netrunner:input-reset", clearInput); modalObserver.disconnect();
      editor.dispose(); editableRender?.dispose(); publishedMap?.dispose(); implantsBuilding.dispose(); mediaTower.dispose(); elevatedRail.dispose(); cityStreet.dispose(); clearBaseEditor();
      // Retained source geometries may be detached by the static merge.
      for (const object of editableSources) if (!object.parent && object !== implantsBuilding.root && object !== mediaTower.root) scene.add(object);
      renderer.domElement.removeEventListener("pointermove",onHover);
      renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", clearInput); renderer.domElement.removeEventListener("wheel", wheel);
      renderer.domElement.removeEventListener("webglcontextlost", lostContext);
      combat.dispose(); heroAnimator?.mixer.stopAllAction(); if (heroAnimator) heroAnimator.mixer.uncacheRoot(heroAnimator.mixer.getRoot());
      puddle.getRenderTarget().dispose(); disposeObjectTree(scene); environment.dispose(); surfaces.dispose(); bloom?.dispose(); output?.dispose(); composer?.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
