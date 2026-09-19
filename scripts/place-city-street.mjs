/** Remove only the previous task's 20 outskirts props from the fresh UI export.
 * The four placed buildings and all owner entries are retained byte-for-byte.
 * The roadway/traffic itself is scene-owned, like the elevated railway. */
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8').replace(/^\uFEFF/, ''));
const before = read('output/map-backups/base-before-city-traffic-2026-09-19.json');
const previous = read('output/map-backups/outskirts-additions-2026-09-19.json');
const removed = new Set(previous.filter(entry => entry.id.startsWith('prop:outskirts-') && !entry.source.startsWith('building-')).map(entry => entry.id));
if (removed.size !== 20) throw new Error('Unexpected outskirts manifest: review before replacing');
const after = { ...before, entries: before.entries.filter(entry => !removed.has(entry.id)) };
writeFileSync(new URL('output/map-backups/base-with-city-traffic-2026-09-19.json', root), JSON.stringify(after, null, 2));
console.log(`Removed ${before.entries.length - after.entries.length} outskirts props; kept ${after.entries.length} entries unchanged.`);
