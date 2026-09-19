/** Add this task's scenery to the fresh owner export; never restore older maps. */
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const input = new URL('output/map-backups/base-before-outskirts-2026-09-19.json', root);
const before = JSON.parse(readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
if (before.entries.length !== 32) throw new Error('Expected the fresh 32-entry owner checkpoint');
const placements = [];
function add(id, source, x, z, rotation = 0, y = .08, scale = 1) {
  placements.push({ id: `prop:outskirts-${id}`, source, x, y, z, rx: 0,
    rotation, rz: 0, sx: scale, sy: scale, sz: scale });
}
// Side lots preserve the complete service row, rear towers clear the guideway.
add('corner-west', 'building-corner-chamfer', -20, 1);
add('corner-east', 'building-corner-rounded', 26, -2.6);
add('glass-rear', 'building-slender-glass', -25, -33);
add('terrace-rear', 'building-slender-terrace', 7, -37);
add('ground', 'outskirts-ground', 0, 25, 0, .015);
for (const [i, x] of [-13,-9.8,-6.6,6.6,9.8,13].entries()) {
  add(`boundary-${i}`, 'outskirts-barrier', x, 11.9, i % 2 ? -3 : 2);
}
add('wreck-west', 'outskirts-wreck', -10, 17, -53);
add('wreck-east', 'outskirts-wreck', 12.5, 20.7, 38);
add('wreck-distant', 'outskirts-wreck', -20, 29, 108);
add('fire-west', 'burning-drum', -7.1, 16.3);
add('fire-east', 'burning-drum', 9.1, 19.4);
add('drum-west', 'blue-drum', -12.9, 19, 15);
add('drums-east', 'kerosene', 17.4, 24.5, -17);
add('tires-west', 'tire-pile', -13, 15.7, 17, .08, .8);
add('tires-east', 'tire-pile', 14.8, 18.7, -17, .08, .8);
add('roadblock-west', 'outskirts-barrier', -5.8, 23.5, -22);
add('roadblock-east', 'outskirts-barrier', 7.9, 28.1, 24);
add('roadblock-far', 'outskirts-barrier', -16, 32, 13);
add('trash', 'garbage-bags', -17, 17, 34);
const wallId = 'base:wall:-14.8:11.35:14.8:11.35';
const wall = { id: wallId, source: wallId, x: 0, y: 0, z: 11.35,
  rx: 0, rotation: 0, rz: 0, sx: 1, sy: 1, sz: 1, deleted: true };
const after = { ...before, entries: [...before.entries, wall, ...placements] };
if (new Set(after.entries.map(e => e.id)).size !== after.entries.length) throw new Error('Duplicate map id');
writeFileSync(new URL('output/map-backups/outskirts-additions-2026-09-19.json', root), JSON.stringify([wall, ...placements], null, 2));
writeFileSync(new URL('output/map-backups/base-with-outskirts-2026-09-19.json', root), JSON.stringify(after, null, 2));
console.log(`Preserved ${before.entries.length} entries; ${placements.length} new objects and boundary replacement; ${after.entries.length} total.`);
