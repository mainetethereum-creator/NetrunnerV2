import {mkdirSync,writeFileSync} from 'node:fs';
import {bakeVegetation,DEFAULT_BAKE} from '../components/editor/bake.ts';
import {validateAsset} from '../components/vegetation/format.ts';
const asset=bakeVegetation(DEFAULT_BAKE);
if(!validateAsset(asset))throw new Error('Generated vegetation exceeds asset limits');
mkdirSync('public/vegetation',{recursive:true});
writeFileSync('public/vegetation/test-patch.json',JSON.stringify(asset));
console.log('Baked triangles per tree:',asset.trees.map(t=>t.triangles),'grass:',asset.grass.triangles);
