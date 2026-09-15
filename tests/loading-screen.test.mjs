// Scene loading screen: pixel helmet with red eyes and real progress (ADR-021).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {WAKE_UP_MS,assetLabel,loadingStage,loadingTarget,pacedPercent} from '../src/ui/loading/loading-model.ts';
import {ASSET_URLS} from '../src/assets/registry.ts';

test('loading target warms up, follows real files, never goes back and waits for ready',()=>{
  assert.equal(loadingTarget({loaded:0,total:0,ready:false,elapsedMs:0},0),0);
  assert.equal(Math.round(loadingTarget({loaded:0,total:0,ready:false,elapsedMs:1250},0)),6);
  assert.equal(loadingTarget({loaded:5,total:10,ready:false,elapsedMs:4000},0),52);
  assert.equal(loadingTarget({loaded:5,total:20,ready:false,elapsedMs:4000},52),52,'newly queued files do not move the bar back');
  assert.equal(loadingTarget({loaded:10,total:10,ready:false,elapsedMs:9000},0),92);
  assert.equal(loadingTarget({loaded:10,total:10,ready:false,elapsedMs:9000},99),95,'capped until the scene is ready');
  assert.equal(loadingTarget({loaded:3,total:10,ready:true,elapsedMs:500},20),100);
});

test('fast cached loads still show the helmet waking up',()=>{
  assert.equal(pacedPercent(60,200),6,'darkness first');
  assert.equal(pacedPercent(60,850),18.5,'then the light sweep and eye ignition');
  assert.equal(pacedPercent(60,WAKE_UP_MS),60,'free after the wake-up');
  assert.equal(pacedPercent(5,850),5,'slow loads are not held back');
});

test('visual stages follow the loading sequence',()=>{
  assert.deepEqual([0,11.9,12,24.9,25,89.9,90,100].map(loadingStage),['void','void','awaken','awaken','watch','watch','lock','lock']);
});

test('asset labels name what is loading',()=>{
  assert.equal(assetLabel('/game/draco/draco_decoder.wasm'),'Draco decoder');
  assert.equal(assetLabel(ASSET_URLS.heroModel),'Neon Sentinel · rig & animations');
  assert.equal(assetLabel('/base/models/workshop.glb'),'Refuge buildings');
  assert.equal(assetLabel('/base/materials/metal-color.webp?v=4'),'Materials · concrete, metal, stone');
  assert.equal(assetLabel('/game/props/salvage/city-atlas.webp'),'Salvage props & buildings');
  assert.equal(assetLabel('blob:http://localhost:3000/1234'),'Textures');
});

test('base and expedition show the helmet loading screen with real progress',()=>{
  for(const url of Object.values(ASSET_URLS.ui.loading))assert.ok(existsSync(join('public',url)),url);
  assert.match(readFileSync('components/base/BaseApp.tsx','utf8'),/<LoadingScreen ready=\{ready\}/);
  assert.match(readFileSync('components/expedition/Expedition.tsx','utf8'),/<LoadingScreen ready=\{Boolean\(state\?\.ready\)\}/);
  const tracker=readFileSync('src/renderer/three/loading-progress.ts','utf8');
  assert.match(tracker,/DefaultLoadingManager/);
  assert.match(tracker,/previousProgress\?\.\(/,'keeps any existing progress handler');
  const screen=readFileSync('src/ui/loading/LoadingScreen.tsx','utf8');
  assert.doesNotMatch(screen,/from ['"]three['"]/,'the screen does not pull Three.js into the page bundle');
  assert.match(screen,/import\('\.\.\/\.\.\/renderer\/three\/loading-progress\.ts'\)/);
});
