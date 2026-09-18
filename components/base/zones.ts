import * as T from "three";
import type { ArchitectureTools } from "./buildings";
import { BACKGROUND_NORTH } from './layout.ts';

export function buildRefugeZones({ box, cylinder, pipe, sign, light, m, surface, section = (_id, _name, build) => build() }: ArchitectureTools) {
  section('base:service-street', 'Служебная улица и фон', () => {
  // A service street below the raised refuge, with two restrained background blocks.
  const asphalt = new T.MeshStandardMaterial({ color: "#151d24", roughness: .94, metalness: .02 });
  surface(asphalt, "concrete", .42);
  asphalt.color.set("#182129");
  box(0, -1.25, -8, 100, .3, 100, asphalt);
  // Low service-wall silhouette closes the view without a distant skyline.
  for (let x = -27; x < 28; x += 3.4) {
    box(x, .1, BACKGROUND_NORTH, 3.32, 2.4, .5, m.dark);
    box(x, 1.35, BACKGROUND_NORTH, 3.42, .14, .66, m.edge);
    box(x - 1.65, .15, BACKGROUND_NORTH, .18, 2.6, .8, m.edge);
  }
  for (const z of [-14, -17]) {
    pipe([[-24, -.8, z], [0, -.8, z], [24, -.8, z]], .1, m.edge);
    for (let x = -23; x < 24; x += 3) box(x, -1.075, z, 1.3, .025, .07, m.concrete);
  }
  for (const x of [-16, 16]) {
    box(x, 1.5, -13, .12, 4.8, .12, m.edge);
    box(x + .5, 3.85, -13, 1.1, .08, .1, m.edge);
    box(x + .9, 3.78, -13, .4, .06, .3, m.amber);
  }
  });
  // The main contract kiosk leaves circulation open between the four services.
  section('base:contracts', 'Терминал CONTRACTS', () => {
  box(0, .65, -3.7, 2.25, 1.2, .75, m.dark);
  box(0, 1.3, -3.7, 2.4, .12, .95, m.brass);
  box(0, 1.55, -3.92, 1.55, .5, .08, m.teal);
  for (const x of [-1.1, 1.1]) {
    box(x, 1.5, -3.95, .09, 3, .09, m.edge);
    box(x, 2.85, -3.85, .12, .12, .2, m.amber);
  }
  sign("CONTRACTS", "CRYPTOMANCER / RUNNER TASKS", 0, 2.6, -3.8, 2.4, "#e0c8a0");
  });
  section('base:oracle', 'Здание ORACLE', () => {
  sign("ORACLE", "CLASS / ABILITIES", 0, 2.45, -6.84, 3.8, "#9cdbe5");
  light(0, 2.8, -6.1, 0x86cddd, 22, 8);
  });
  section('base:workshop', 'Здание CYBERSMITH', () => {
  sign("CYBERSMITH", "WEAPONS / FABRICATION", -8.4, 3.1, -6.28, 4.6, "#efc58a");
  light(-8.2, 2.6, -5.8, 0xffb164, 38, 9);
  });

  // An unstaffed herb market display; no purchase or inventory actions yet.
  section('base:market', 'Прилавок GREEN EXCHANGE', () => {
  const canvas = new T.MeshStandardMaterial({ color: "#54625b", roughness: .98 });
  box(-10.5, .55, 4.1, 2.1, 1.05, 2.3, m.dark);
  box(-10.5, 1.12, 4.1, 2.25, .1, 2.4, m.brass);
  for (const x of [-11.45, -9.55]) for (const z of [3.05, 5.15]) box(x, 1.55, z, .075, 3.05, .075, m.edge);
  box(-10.5, 3.1, 4.1, 2.5, .1, 2.7, canvas);
  for (let x = -11.55; x < -9.3; x += .35) box(x, 3.12, 4.1, .16, .035, 2.7, m.brass);
  sign("GREEN EXCHANGE", "CANNABIS / MARKET", -10.5, 2.55, 5.32, 2.4, "#b3d0a0");
  for (let x = -11.1; x <= -9.8; x += .43) for (let z = 3.5; z <= 4.8; z += .55) {
    cylinder(x, 1.26, z, .14, .23, m.rust);
    for (let leaf = 0; leaf < 5; leaf++) {
      const angle = leaf * Math.PI * .4;
      box(x + Math.cos(angle) * .09, 1.48, z + Math.sin(angle) * .09, .07, .045, .27, m.green, angle);
    }
  }
  light(-10.4, 2.55, 4.6, 0xf0c585, 16, 5);
  });

  // Street infrastructure: inset covers, slotted drains and concrete fence panels.
  for (const [x, z] of [[-3, 4.3], [6.8, 6.9]]) section(`base:drain:${x}`, `Люк и водосток (${x}, ${z})`, () => {
    box(x, .089, z, 1.35, .045, 1.35, m.edge);
    cylinder(x, .12, z, .51, .045, m.brass);
    cylinder(x, .145, z, .46, .025, m.dark);
    for (let dx = -.32; dx < .4; dx += .16) for (let dz = -.28; dz < .3; dz += .14) box(x + dx, .163, z + dz, .09, .012, .055, m.brass);
    for (let dx = -.55; dx < .6; dx += .14) box(x + dx, .11, z + .87, .07, .07, .4, m.black);
  });
}
