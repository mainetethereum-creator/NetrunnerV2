import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ELEVATED_RAIL, sampleRailRoute } from './elevated-rail-layout.ts';

type Finish = 'steel' | 'cable' | 'ceramic' | 'hazard' | 'amber' | 'cyan';
type ShapeBuckets = Record<Finish, T.BufferGeometry[]>;

/** Scenery for the curved railway, in world coordinates like its deck and piers.
 * Fixtures below walking headroom remain inside the existing support feet.
 * Six merged batches own their resources; there are no texture requests or timers. */
export function createRailCityDetails(parent: T.Group, mobile: boolean) {
  const root = new T.Group();
  root.name = 'Railway / suspended city services';
  parent.add(root);
  const materials: Record<Finish, T.MeshStandardMaterial> = {
    steel: new T.MeshStandardMaterial({ color: 0x384849, roughness: .74, metalness: .62 }),
    cable: new T.MeshStandardMaterial({ color: 0x101c20, roughness: .87, metalness: .18 }),
    ceramic: new T.MeshStandardMaterial({ color: 0x718380, roughness: .8, metalness: .05 }),
    hazard: new T.MeshStandardMaterial({ color: 0xad8443, roughness: .85, metalness: .15 }),
    amber: new T.MeshStandardMaterial({ color: 0xffd2a0, emissive: 0xffb36a, emissiveIntensity: 1.6, roughness: .5 }),
    cyan: new T.MeshStandardMaterial({ color: 0x9adcd8, emissive: 0x72ccc9, emissiveIntensity: 1.25, roughness: .5 }),
  };
  const shapes: ShapeBuckets = { steel: [], cable: [], ceramic: [], hazard: [], amber: [], cyan: [] };
  const geometryResources: T.BufferGeometry[] = [];
  const lights: T.PointLight[] = [];
  const frame = new T.Matrix4();
  const rotation = new T.Quaternion();
  const up = new T.Vector3(0, 1, 0);

  // Keep detail on the inhabited portion of the route; distant looping tails stay cheap.
  const nearCity = (distance: number) => {
    const point = sampleRailRoute(distance);
    return point.x > -40 && point.x < 48 && point.z > -50 && point.z < 14;
  };
  const piers = ELEVATED_RAIL.pierCentres.filter(nearCity);
  const spans = ELEVATED_RAIL.deckCentres.filter(nearCity);

  function routePoint(distance: number, y: number, side: number) {
    const point = sampleRailRoute(distance);
    return new T.Vector3(point.x + side * Math.sin(point.yaw), y, point.z + side * Math.cos(point.yaw));
  }

  function box(finish: Finish, station: number, x: number, y: number, side: number, w: number, h: number, d: number) {
    const point = sampleRailRoute(station);
    rotation.setFromAxisAngle(up, point.yaw);
    frame.compose(new T.Vector3(point.x, 0, point.z), rotation, new T.Vector3(1, 1, 1));
    const geometry = new T.BoxGeometry(w, h, d).translate(x, y, side).applyMatrix4(frame);
    shapes[finish].push(geometry);
  }

  function tube(finish: Finish, points: T.Vector3[], radius: number, radialSegments = 4) {
    const curve = new T.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = new T.TubeGeometry(curve, Math.max(2, points.length - 1), radius, radialSegments, false);
    shapes[finish].push(geometry);
  }

  function routeTube(finish: Finish, start: number, end: number, side: number, height: number, sag: number, radius: number) {
    const steps = Math.max(4, Math.ceil((end - start) / 1.2));
    const points = Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      return routePoint(start + (end - start) * t, height - sag * Math.sin(Math.PI * t), side);
    });
    tube(finish, points, radius);
  }

  const supportSide = ELEVATED_RAIL.pierOffsetZ;
  const cableHeight = ELEVATED_RAIL.deckY - 2.25;
  for (let index = 1; index < piers.length; index++) {
    const start = piers[index - 1], end = piers[index];
    for (let strand = 0; strand < (mobile ? 2 : 3); strand++) {
      // Sample the route throughout each span, so cables curve with the guideway
      // instead of drawing a chord through the advertising tower or courtyard.
      routeTube('cable', start, end, supportSide + .2 - strand * .17,
        cableHeight - strand * .14, 2.05 + strand * .11, strand ? .024 : .038);
    }
  }

  if (spans.length) {
    const start = spans[0] - ELEVATED_RAIL.deckLength / 2;
    const end = spans[spans.length - 1] + ELEVATED_RAIL.deckLength / 2;
    routeTube('steel', start, end, -1.55, ELEVATED_RAIL.deckY - 1.48, 0, .065);
  }

  for (const station of spans) {
    // A narrow service pipe is carried beneath the girder on visible U brackets.
    for (const side of [-1.82, -1.28]) {
      box('steel', station, 0, ELEVATED_RAIL.deckY - 1.25, side, .065, .48, .065);
    }
    box('steel', station, 0, ELEVATED_RAIL.deckY - 1.51, -1.55, .12, .07, .66);
    // Warm lenses face the street and underside. Short cyan ends mark the route
    // without turning the whole concrete girder into another advertising sign.
    box('cable', station, 0, ELEVATED_RAIL.deckY - 1.17, 1.81, 1.68, .18, .3);
    box('amber', station, 0, ELEVATED_RAIL.deckY - 1.19, 1.97, 1.42, .075, .018);
    box('amber', station, 0, ELEVATED_RAIL.deckY - 1.269, 1.81, 1.42, .018, .21);
    box('cyan', station, -.78, ELEVATED_RAIL.deckY - 1.17, 1.978, .065, .105, .022);
  }

  for (const station of piers) {
    const side = supportSide;
    // A side-mounted electrical cabinet fits wholly inside the 2.85 x 3 m foot.
    box('steel', station, 1.075, 1.38, side, .48, 1.38, .82);
    box('cable', station, 1.323, 1.39, side, .024, 1.2, .69);
    for (let vent = 0; vent < 5; vent++) {
      box('steel', station, 1.34, 1.22 + vent * .075, side, .025, .025, .43);
    }
    box('ceramic', station, 1.345, 1.81, side + .03, .028, .12, .25);
    box('cyan', station, 1.363, 1.81, side + .08, .012, .052, .055);
    box('hazard', station, 1.342, .85, side, .028, .075, .54);
    // A vertical feed hugs the column, then joins the suspended cable crosshead.
    box('cable', station, 1.07, (cableHeight + 2) / 2, side + .26, .072, cableHeight - 2, .072);
    box('steel', station, .4, cableHeight + .05, side, 1.5, .11, .65);
    for (let strand = 0; strand < (mobile ? 2 : 3); strand++) {
      for (let ring = 0; ring < 3; ring++) {
        box('ceramic', station, 0, cableHeight + .01 + ring * .06,
          side + .2 - strand * .17, .14, .026, .12);
      }
    }

    // Simple transit/service symbol made from geometry: it remains crisp at game
    // distance, needs no canvas texture, and shares the same six material batches.
    box('cable', station, 0, 3.4, side + 1.045, 1.13, .62, .09);
    box('steel', station, 0, 3.4, side + 1.098, 1.01, .5, .018);
    for (const x of [-.37, -.16, .05]) {
      box('amber', station, x, 3.4, side + 1.113, .068, .25, .012);
    }
    box('cyan', station, .31, 3.4, side + 1.114, .2, .07, .012);
    box('hazard', station, 0, .54, side + 1.23, 1.2, .1, .035);

    box('cable', station, 0, 7.55, side + 1.13, .58, .18, .3);
    box('amber', station, 0, 7.448, side + 1.13, .45, .025, .2);
  }

  // Two local pools touch nearby paving; emission carries the rest. No extra
  // shadow maps, and mobile gets no additional dynamic lights.
  if (!mobile) {
    const litStations = piers.filter(station => station >= 0).slice(0, 2);
    for (const station of litStations) {
      const light = new T.PointLight(0xffc58b, 16, 10, 2);
      light.name = 'Railway / service downlight';
      light.position.copy(routePoint(station, 7.3, supportSide + 1.19));
      light.castShadow = false;
      root.add(light);
      lights.push(light);
    }
  }

  for (const finish of Object.keys(shapes) as Finish[]) {
    const pieces = shapes[finish];
    materials[finish].name = `Rail city / ${finish}`;
    if (!pieces.length) continue;
    const geometry = mergeGeometries(pieces, false)!;
    pieces.forEach(piece => piece.dispose());
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometryResources.push(geometry);
    const mesh = new T.Mesh(geometry, materials[finish]);
    mesh.name = `Railway / ${finish} details`;
    mesh.castShadow = false;
    mesh.receiveShadow = finish !== 'amber' && finish !== 'cyan';
    root.add(mesh);
  }

  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      root.clear();
      geometryResources.forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
      lights.forEach(light => light.dispose());
    },
  };
}
