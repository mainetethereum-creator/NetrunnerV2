import * as T from 'three';
import { CITY_STREET, TRAFFIC_PERIOD, trafficPose, trafficVehicles, type TrafficVehicle } from './city-traffic-layout.ts';
import { StreetGeometry, roadGlowTexture, streetGrain } from './city-street-geometry.ts';
import { createVehicleGeometry } from './city-vehicles.ts';
import { disposeObjectTree } from '../three/dispose.ts';

/** City frontage and instanced traffic. Scene owns time/pause; this module owns
 * all GPU resources. No timers, network loads, gameplay colliders or extra RAF. */
export function createCityStreet(parent: T.Scene | T.Group, mobile: boolean) {
  const root = new T.Group();
  root.name = 'City avenue / street and traffic';
  parent.add(root);
  const standard = (color: number, roughness = .72, metalness = .15) =>
    new T.MeshStandardMaterial({ color, roughness, metalness });
  const glow = (color: number, strength: number) =>
    new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: .4 });
  const materials: Record<string, T.MeshStandardMaterial> = {
    concrete: standard(0x66716e, .9, .02),
    curb: standard(0x85908a, .82, .04),
    paving: standard(0x38464b, .62, .1),
    trim: standard(0x65757b, .36, .75),
    rubber: standard(0x0c151a, .9, .04),
    steel: standard(0x293b46, .54, .65),
    glass: standard(0x172f3e, .16, .65),
    white: standard(0xb2b8ac, .8, .02),
    yellow: standard(0xb69a53, .8, .03),
    paint: standard(0xffffff, .28, .58),
    taxiPaint: standard(0xc49836, .3, .48),
    busPaint: standard(0x487d82, .33, .5),
    headlight: glow(0xc5ecff, 3),
    red: glow(0xff3d29, 2.4),
    amber: glow(0xffc879, 1.8),
    cyan: glow(0x56b8ce, 1.3),
  };
  materials.glass.side = T.DoubleSide;
  Object.entries(materials).forEach(([name, material]) => { material.name = `City street / ${name}`; });

  const b = new StreetGeometry();
  const length = CITY_STREET.halfLength * 2 + 20;
  const centreZ = (CITY_STREET.roadNorth + CITY_STREET.roadSouth) / 2;
  b.box('concrete', 0, -.53, 23, length, .82, 22);
  b.box('paving', 0, -.02, 14.17, length, .18, 4.46);
  b.box('paving', 0, -.02, 30, length, .18, 7.2);
  b.box('curb', 0, .015, 16.32, length, .23, .22);
  b.box('curb', 0, .015, 26.48, length, .23, .22);
  const roadMaterial = standard(0x283138, .33, .24);
  roadMaterial.name = 'City street / damp asphalt';
  roadMaterial.map = streetGrain();
  roadMaterial.bumpMap = roadMaterial.map;
  roadMaterial.bumpScale = .016;
  const road = new T.Mesh(new T.PlaneGeometry(length, 10.0), roadMaterial);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, CITY_STREET.roadY, centreZ);
  road.receiveShadow = true;
  road.name = 'City avenue / carriageway';
  root.add(road);

  // Fine expansion joints, gutters and service covers carry the human scale.
  for (let x = -90; x <= 90; x += 1.4) {
    for (const [z, depth] of [[14.12, 4.15], [30, 6.8]]) b.box('steel', x, .075, z, .016, .004, depth);
  }
  for (const z of [13.45, 14.85, 27.4, 28.8, 30.2, 31.6]) b.box('steel', 0, .075, z, length, .004, .015);
  for (const z of [16.65, 26.15]) b.box('rubber', 0, -.045, z, length, .015, .21);
  for (let x = -100; x <= 100; x += 12) for (const z of [16.68, 26.12]) {
    b.box('trim', x, -.023, z, .85, .035, .3);
    for (let i = 0; i < 7; i++) b.box('rubber', x - .33 + i * .11, -.003, z, .06, .009, .26);
  }
  for (const x of [-23, 9, 36]) {
    b.cylinder('steel', x, -.043, 20.1, .42, .025);
    for (let i = -2; i <= 2; i++) b.box('trim', x, -.026, 20.1 + i * .1, .5, .006, .024);
  }
  for (const z of [21.23, 21.57]) b.box('yellow', 0, -.043, z, length, .007, .105);
  for (const z of [16.95, 25.85]) for (let x = -130; x < 130; x += 6) {
    b.box('white', x, -.041, z, 3.2, .009, .09);
  }
  // Bus-bay edge marks keep the centre of each moving lane clear.
  for (const [x, z] of [[-15, 17.2], [17, 25.6]]) {
    b.box('yellow', x, -.038, z, 9.3, .012, .1);
    for (const dx of [-4.65, 4.65]) b.box('yellow', x + dx, -.038, z, .1, .012, .55);
  }

  // A low, continuous plaza divider replaces the high concrete fence.
  b.box('concrete', 0, .23, 12.22, 64, .34, .43);
  b.box('curb', 0, .414, 12.22, 64, .045, .48);
  b.box('steel', 0, .72, 12.22, 64, .06, .075);
  for (let x = -32; x <= 32; x += 2) b.box('steel', x, .56, 12.22, .065, .43, .065);
  for (let x = -30; x <= 30; x += 6) b.box('cyan', x, .25, 12.447, .26, .07, .012);

  function shelter(x: number, z: number, facing: number) {
    // Opaque blue glazing with open entry and thin mullions, no expensive sorting.
    const back = z - facing * .85;
    b.box('concrete', x, .13, z, 6.7, .12, 2.2);
    for (const dx of [-3.02, 0, 3.02]) b.box('steel', x + dx, 1.6, back, .11, 2.9, .11);
    b.box('glass', x, 1.64, back, 5.95, 2.12, .045);
    for (const dx of [-3, 3]) {
      b.box('glass', x + dx, 1.63, z - facing * .25, .05, 2.1, 1.2);
      b.box('steel', x + dx, 2.77, z - facing * .22, .07, .1, 1.26);
    }
    b.box('steel', x, 3.02, z, 6.6, .19, 2.3);
    b.box('trim', x, 3.14, z, 6.7, .065, 2.35);
    b.box('cyan', x, 2.94, z + facing * 1.16, 5.95, .055, .022);
    b.box('amber', x, 2.904, z, 4.2, .026, .18);
    b.box('trim', x - .45, .66, z - facing * .32, 3.6, .11, .5);
    b.box('steel', x - .45, 1.05, z - facing * .61, 3.6, .46, .09);
    for (const dx of [-1.8, .9]) b.box('steel', x + dx, .4, z - facing * .32, .09, .48, .42);
    b.box('steel', x + 2.08, 1.5, z + facing * .25, .9, 2.7, .2);
    b.box('cyan', x + 2.08, 1.88, z + facing * .36, .68, 1.5, .018);
    b.box('glass', x + 2.08, 1.92, z + facing * .376, .56, 1.32, .018);
    // Route-line diagram and stop icon are geometry, legible without font loads.
    b.box('amber', x + 1.96, 1.9, z + facing * .39, .027, .95, .016);
    for (let i = 0; i < 4; i++) b.box('white', x + 2.13, 1.52 + i * .25, z + facing * .392, .22, .034, .017);
    b.box('steel', x + 3.9, 1.82, z + facing * .35, .085, 3.4, .085);
    b.box('cyan', x + 3.9, 3.1, z + facing * .35, .61, .75, .07);
    b.box('glass', x + 3.9, 3.12, z + facing * .399, .41, .4, .025);
    for (const dx of [-.13, .13]) b.box('white', x + 3.9 + dx, 2.84, z + facing * .402, .09, .08, .025);
  }
  shelter(-15, 14.4, 1);
  shelter(17, 28.55, -1);

  const lampLocations: [number, number, number][] = [];
  for (const x of [-42, -16, 10, 36, 62]) lampLocations.push([x, 15.8, 1]);
  for (const x of [-29, -3, 23, 49]) lampLocations.push([x, 27.1, -1]);
  for (const [x, z, direction] of lampLocations) {
    b.cylinder('steel', x, 3.45, z, .065, 6.8);
    b.box('steel', x, .33, z, .29, .51, .29);
    b.box('steel', x, 6.83, z + direction * .78, .11, .12, 1.66);
    b.box('trim', x, 6.8, z + direction * 1.64, .55, .13, 1.12);
    b.box('headlight', x, 6.726, z + direction * 1.64, .43, .02, .93);
  }
  for (const [x, z] of [[-6, 14.2], [31, 14.25], [-11, 29.4]]) {
    b.box('steel', x, .86, z, .71, 1.48, .6);
    b.box('trim', x, 1.62, z, .78, .08, .65);
    b.box('rubber', x, 1.37, z + .308, .5, .21, .018);
  }

  for (const [finish, geometry] of b.finish()) {
    const mesh = new T.Mesh(geometry, materials[finish]);
    mesh.name = `City avenue / ${finish}`;
    mesh.receiveShadow = true;
    mesh.castShadow = !['headlight', 'cyan', 'amber'].includes(finish);
    root.add(mesh);
  }
  const glowTexture = roadGlowTexture();
  const lampMaterial = new T.MeshBasicMaterial({ color: 0xa1bbce, map: glowTexture, transparent: true,
    opacity: .17, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
  const lampGeometry = new T.PlaneGeometry(5, 6).rotateX(-Math.PI / 2);
  const lampPools = new T.InstancedMesh(lampGeometry, lampMaterial, lampLocations.length);
  lampLocations.forEach(([x, z, direction], index) => {
    lampPools.setMatrixAt(index, new T.Matrix4().makeTranslation(x, -.032, z + direction * 2.8));
  });
  lampPools.name = 'City avenue / soft streetlight pools';
  root.add(lampPools);
  if (!mobile) for (const [x, z] of [[-16, 17.5], [10, 17.5]]) {
    const light = new T.PointLight(0xb9d6df, 25, 11, 2);
    light.position.set(x, 5.7, z);
    root.add(light);
  }

  const vehicles = trafficVehicles(mobile);
  const batches: { mesh: T.InstancedMesh; vehicles: TrafficVehicle[] }[] = [];
  for (const kind of ['sedan', 'taxi', 'bus'] as const) {
    const fleet = vehicles.filter(vehicle => vehicle.kind === kind);
    for (const [finish, geometry] of createVehicleGeometry(kind)) {
      const mesh = new T.InstancedMesh(geometry, materials[finish], fleet.length);
      mesh.name = `City traffic / ${kind} / ${finish}`;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      // Contact decals avoid re-rendering every city shadow map for each car.
      mesh.castShadow = false;
      if (finish === 'paint') fleet.forEach((vehicle, index) => mesh.setColorAt(index, new T.Color(vehicle.color)));
      batches.push({ mesh, vehicles: fleet });
      root.add(mesh);
    }
  }
  const contacts = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ color: 0x020609, map: glowTexture, transparent: true, opacity: .85, depthWrite: false }), vehicles.length);
  contacts.name = 'City traffic / contact shadows';
  const headlights = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ color: 0xc3e9ff, map: glowTexture, transparent: true, opacity: .34,
      depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }), vehicles.length);
  headlights.name = 'City traffic / headlight pools';
  for (const mesh of [contacts, headlights]) {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    root.add(mesh);
  }
  const transform = new T.Object3D();
  function place(elapsed: number) {
    for (const { mesh, vehicles: fleet } of batches) {
      fleet.forEach((vehicle, index) => {
        const pose = trafficPose(vehicle, elapsed);
        transform.position.set(pose.x, pose.y, pose.z);
        transform.rotation.set(0, pose.yaw, 0);
        transform.scale.set(1, 1, 1);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    vehicles.forEach((vehicle, index) => {
      const pose = trafficPose(vehicle, elapsed);
      const length = vehicle.kind === 'bus' ? 9.5 : 4.8;
      transform.rotation.set(0, pose.yaw, 0);
      transform.position.set(pose.x, CITY_STREET.roadY + .012, pose.z);
      transform.scale.set(length + .9, 1, vehicle.kind === 'bus' ? 3.2 : 2.7);
      transform.updateMatrix();
      contacts.setMatrixAt(index, transform.matrix);
      transform.position.x += (length / 2 + 1.55) * CITY_STREET.lanes[vehicle.lane].direction;
      transform.position.y = CITY_STREET.roadY + .022;
      transform.scale.set(4.6, 1, 2.8);
      transform.updateMatrix();
      headlights.setMatrixAt(index, transform.matrix);
    });
    contacts.instanceMatrix.needsUpdate = headlights.instanceMatrix.needsUpdate = true;
  }
  let elapsed = 0, disposed = false;
  place(0);
  return {
    root,
    update(dt: number) {
      if (disposed || !Number.isFinite(dt) || dt <= 0) return;
      elapsed = (elapsed + Math.min(dt, .1)) % TRAFFIC_PERIOD;
      place(elapsed);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      root.traverse(object => {
        if (object instanceof T.InstancedMesh || object instanceof T.Light) object.dispose();
      });
      disposeObjectTree(root);
      // Some palette finishes can be unused after quality-specific batching.
      const used = new Set<T.Material>();
      root.traverse(object => { if (object instanceof T.Mesh) used.add(object.material as T.Material); });
      Object.values(materials).forEach(material => { if (!used.has(material)) material.dispose(); });
      root.clear();
    },
  };
}
