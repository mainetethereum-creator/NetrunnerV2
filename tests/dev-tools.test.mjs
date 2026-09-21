// Development tools (map editor, debug panel, test teleports, editor pages) never reach players (ADR-019).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

test('next.config turns dev tools and development pages on only in development',async()=>{
  delete process.env.CYBERBASE_DEV_TOOLS;
  const {default:nextConfig}=await import(pathToFileURL(resolve('next.config.ts')).href);
  const dev=nextConfig('phase-development-server'),production=nextConfig('phase-production-build');
  assert.deepEqual(dev.env,{CYBERBASE_DEV_TOOLS:'1'});
  assert.ok(dev.pageExtensions.includes('dev.tsx'));
  assert.deepEqual(production.env,{CYBERBASE_DEV_TOOLS:'0'});
  assert.equal(production.pageExtensions.includes('dev.tsx'),false);
  process.env.CYBERBASE_DEV_TOOLS='1';
  try{assert.deepEqual(nextConfig('phase-production-build').env,{CYBERBASE_DEV_TOOLS:'1'});}
  finally{delete process.env.CYBERBASE_DEV_TOOLS;}
});

test('production caches heavy game assets without repeat downloads',async()=>{
  const {default:nextConfig}=await import(pathToFileURL(resolve('next.config.ts')).href);
  const rules=await nextConfig('phase-production-build').headers();
  for(const source of ['/game/:path*','/base/models/:path*']){
    const rule=rules.find(candidate=>candidate.source===source);
    assert.ok(rule,source);
    assert.deepEqual(rule.headers,[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]);
  }
  assert.match(rules[0].source,/ktx2/);
  assert.match(rules[0].source,/wasm/);
});

test('editor pages are development-only page files',()=>{
  for(const dir of ['app/editor/vegetation','app/ui-kit-preview']){
    assert.ok(existsSync(`${dir}/page.dev.tsx`),dir);
    assert.equal(existsSync(`${dir}/page.tsx`),false,dir);
  }
});

test('MASTER editor, debug panel and test teleports are gated by the build-time flag',()=>{
  const base=readFileSync('components/base/BaseApp.tsx','utf8');
  const expedition=readFileSync('components/expedition/Expedition.tsx','utf8');
  for(const [name,source] of [['BaseApp',base],['Expedition',expedition]])
    assert.match(source,/const DEV_TOOLS ?= ?process\.env\.CYBERBASE_DEV_TOOLS ?=== ?["']1["']/,name);
  assert.match(base,/\{DEV_TOOLS && <button className=\{styles\.editorToggle\}/);
  assert.match(base,/\{DEV_TOOLS&&master&&worldEditor&&/);
  assert.match(expedition,/\{DEV_TOOLS&&<button className=\{styles\.masterButton\}/);
  assert.match(expedition,/\{DEV_TOOLS&&master&&<aside/);
  assert.match(expedition,/\{DEV_TOOLS&&debug&&<aside/);
  assert.match(expedition,/setDebugAllowed\(DEV_TOOLS&&params\.has\('debug'\)\)/);
  assert.match(expedition,/if\(DEV_TOOLS\)\{if\(params\.has\('van'\)\)/);
  assert.doesNotMatch(expedition,/^import WorldEditorPanel/m);
});
