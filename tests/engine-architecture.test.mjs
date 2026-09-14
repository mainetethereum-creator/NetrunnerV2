// Guards for the incremental engine refactor (see ARCHITECTURE.md / DECISIONS.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {registeredAssetFiles} from '../src/assets/registry.ts';

const SCENES=['components/base/scene.ts','components/expedition/scene.ts','components/metro3d/scene.ts'];

test('every asset in the registry exists in public/',()=>{
  const files=registeredAssetFiles();assert.ok(files.length>=7);
  for(const url of files)assert.ok(existsSync(join('public',url)),url);
});

test('scenes load glTF through the shared loader and dispose through the shared helper',()=>{
  for(const file of SCENES){
    const code=readFileSync(file,'utf8');
    assert.match(code,/createGltfLoader\(\)/,file);
    assert.doesNotMatch(code,/new\s+(?:T\.)?DRACOLoader|setDecoderPath\(/,file);
    assert.doesNotMatch(code,/function disposeTree/,file);
    assert.doesNotMatch(code,/['"`]\/game\/models\/mixamo\//,file);
  }
});

test('scenes run through the shared frame loop instead of their own requestAnimationFrame loops',()=>{
  for(const file of SCENES){
    const code=readFileSync(file,'utf8');
    assert.match(code,/createFrameLoop\(\{/,file);
    assert.match(code,/loop\.dispose\(\)/,file);
    assert.doesNotMatch(code,/requestAnimationFrame\(|cancelAnimationFrame\(/,file);
  }
});

test('scenes resolve movement input through src/input',()=>{
  for(const file of SCENES){
    const code=readFileSync(file,'utf8');
    assert.match(code,/createMovementInput\(\)/,file);
    assert.match(code,/input\.resolve\(moveDirection,\s*azimuth,/,file);
    assert.doesNotMatch(code,/sx\s*\*\s*Math\.cos\(azimuth\)|new Set<string>\(\)[^;]*stick/,file);
  }
});

test('pure src layers never import Three.js, UI frameworks or legacy components',()=>{
  const pure=['src/core','src/gameplay','src/world','src/input','src/shared'].filter(existsSync);
  const files=['src/assets/registry.ts'];
  const walk=dir=>{for(const name of readdirSync(dir)){const path=join(dir,name);if(statSync(path).isDirectory())walk(path);else if(/\.tsx?$/.test(name))files.push(path);}};
  pure.forEach(walk);
  for(const file of files){
    const code=readFileSync(file,'utf8');
    assert.doesNotMatch(code,/from\s+['"](?:three|react|react-dom|next)(?:\/[^'"]*)?['"]/,file);
    assert.doesNotMatch(code,/from\s+['"][^'"]*components\//,file);
  }
});
