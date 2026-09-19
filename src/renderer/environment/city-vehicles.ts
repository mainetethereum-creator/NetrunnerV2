import { StreetGeometry } from './city-street-geometry.ts';
import type { TrafficVehicle } from './city-traffic-layout.ts';

/** Small complete 3D shells, opaque glazing, separate lenses and rubber tires.
 * Forward is +X; all instances of a vehicle kind share the material batches. */
export function createVehicleGeometry(kind: TrafficVehicle['kind']) {
  const b = new StreetGeometry();
  const bus = kind === 'bus';
  const paint = bus ? 'busPaint' : kind === 'taxi' ? 'taxiPaint' : 'paint';
  if (bus) {
    b.profile(paint, [[-4.6, .45], [4.48, .45], [4.6, .85], [4.42, 2.8], [-4.4, 2.96], [-4.6, 2.68]], 1.16);
    b.box('rubber', 0, .43, 0, 8.7, .2, 2.16);
    b.box('trim', -.2, 3, 0, 4.4, .24, 1.6);
    for (const side of [-1, 1]) {
      b.box('glass', -.4, 2.06, side * 1.168, 7.7, 1.02, .016);
      b.box('white', -.3, 1.29, side * 1.18, 8.1, .11, .024);
      for (let x = -3.6; x < 3.8; x += 1.13) b.box('trim', x, 2.08, side * 1.18, .075, 1.16, .035);
      for (const x of [-2.4, 2.8]) {
        b.box('rubber', x, 1.3, side * 1.19, .85, 1.72, .026);
        b.box('glass', x, 1.75, side * 1.212, .73, .78, .02);
        b.box('trim', x, 1.3, side * 1.23, .04, 1.7, .02);
      }
    }
    b.quad('glass', [[4.606, 1.38, -1.05], [4.606, 1.38, 1.05], [4.439, 2.63, 1.05], [4.439, 2.63, -1.05]]);
    b.box('rubber', 4.5, 2.74, 0, .03, .22, 1.8);
    for (let i = 0; i < 9; i++) b.box('amber', 4.522, 2.75, -.7 + i * .17, .025, .075, .09);
    b.box('glass', -4.612, 2.03, 0, .016, .88, 1.9);
    for (const side of [-1, 1]) {
      b.box('headlight', 4.605, .94, side * .83, .035, .18, .38);
      b.box('red', -4.612, 1.05, side * .98, .027, .45, .15);
      b.box('trim', 4.15, 2.2, side * 1.38, .38, .14, .43);
    }
  } else {
    b.profile(paint, [[-2.3, .4], [2.24, .4], [2.4, .64], [2.25, .91], [1.25, 1.01], [-1.4, 1.02], [-2.26, .88]], .91);
    b.profile('glass', [[-1.42, .99], [1.3, .99], [.66, 1.61], [-.93, 1.61]], .805);
    b.profile(paint, [[-.97, 1.57], [.69, 1.57], [.63, 1.67], [-.93, 1.67]], .825);
    b.box('rubber', 0, .4, 0, 4.33, .18, 1.73);
    for (const side of [-1, 1]) {
      // Window belt, B pillar, door seam and recessed handles.
      b.box('trim', -.06, 1.015, side * .922, 2.8, .065, .04);
      b.box(paint, -.24, 1.32, side * .818, .12, .61, .05);
      b.box('trim', -.25, .76, side * .922, .024, .43, .018);
      for (const x of [-1.08, .23]) b.box('trim', x, .916, side * .926, .2, .035, .025);
      b.box(paint, .93, 1.09, side * 1.005, .25, .13, .24);
      b.box('headlight', 2.285, .785, side * .64, .065, .11, .4);
      b.box('red', -2.306, .76, side * .64, .034, .12, .4);
    }
    b.box('rubber', 2.34, .59, 0, .036, .15, 1.39);
    b.box('trim', -2.313, .52, 0, .03, .05, 1.48);
    b.box('white', -2.336, .67, 0, .015, .13, .37);
    for (const z of [-.4, -.2, 0, .2, .4]) b.box('trim', 2.365, .59, z, .022, .025, .12);
    if (kind === 'taxi') {
      b.box('rubber', -.2, 1.72, 0, .64, .08, .54);
      b.box('amber', -.2, 1.81, 0, .54, .13, .4);
      for (const side of [-1, 1]) for (let x = -.8; x <= .65; x += .18) {
        b.box('rubber', x, .73, side * .932, .085, .09, .02);
      }
    }
  }
  const wheels = bus ? [-2.8, 2.9] : [-1.47, 1.44];
  const radius = bus ? .48 : .35, width = bus ? 1.17 : .93;
  for (const x of wheels) for (const side of [-1, 1]) {
    b.cylinder('rubber', x, radius, side * width, radius, .22, true);
    b.cylinder('trim', x, radius, side * (width + .12), radius * .65, .032, true);
    b.cylinder('rubber', x, radius, side * (width + .141), radius * .23, .014, true);
  }
  return b.finish();
}
