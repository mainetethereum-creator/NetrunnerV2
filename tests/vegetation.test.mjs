import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {validateAsset,TEST_TREES,TEST_PATCH} from '../components/vegetation/format.ts';
import {makeWorld,findRoute} from '../components/expedition/world.ts';
test('baked vegetation fits the bounded low-poly budget and rejects invalid geometry',()=>{
 const asset=JSON.parse(readFileSync(new URL('../public/vegetation/test-patch.json',import.meta.url),'utf8'));
 assert.ok(validateAsset(asset));assert.equal(asset.trees.length,3);const bad=structuredClone(asset);bad.trees[0].parts[0].positions[0]=Infinity;assert.equal(validateAsset(bad),false);assert.equal(validateAsset({version:1,seed:1,trees:[]}),false);
 assert.ok(TEST_TREES.length<=4);for(const t of TEST_TREES){assert.ok(Math.abs(t.x-TEST_PATCH.x)<=TEST_PATCH.w/2);assert.ok(Math.abs(t.z-TEST_PATCH.z)<=TEST_PATCH.d/2);}
});
test('the test patch is reachable and tree trunks block walking',()=>{
 const world=makeWorld();assert.ok(findRoute(world,world.spawn,{x:22,z:55}).length);for(const tree of TEST_TREES)assert.equal(world.canStand(tree),false);
});
test('playable scene dependency graph excludes the generator and editor',()=>{
 const seen=new Set();function visit(file){file=resolve(file);if(seen.has(file))return;seen.add(file);assert.ok(!file.includes('vendor')&&!file.includes(`${String.raw`components\editor`}`)&&!file.includes('components/editor'),file);
 const code=readFileSync(file,'utf8');for(const match of code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)){const base=resolve(dirname(file),match[1]);const next=[base,base+'.ts',base+'.tsx'].find(p=>existsSync(p));if(next&&/\.tsx?$/.test(next))visit(next);}}
 visit('components/expedition/scene.ts');assert.ok(seen.size>10);
});
