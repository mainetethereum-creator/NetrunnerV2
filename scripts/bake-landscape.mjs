import {readFileSync,writeFileSync} from 'node:fs';
import {sanitizeLandscape} from '../components/expedition/landscape-state.ts';
if(!process.argv[2])throw new Error('Usage: node scripts/bake-landscape.mjs <MASTER-export.json>');
const patches=sanitizeLandscape(JSON.parse(readFileSync(process.argv[2],'utf8')));
writeFileSync('components/expedition/landscape-authored.ts',`import type {LandscapePatch} from './landscape-state';\n/** Release configuration. Browser MASTER drafts never override this data in gameplay. */\nexport const AUTHORED_LANDSCAPE:readonly LandscapePatch[]=Object.freeze(${JSON.stringify(patches,null,2)}.map(p=>Object.freeze(p)));\n`);
