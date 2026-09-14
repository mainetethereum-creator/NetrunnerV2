import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {HUB_NAV,HUB_CARDS,shortAddress} from '../src/ui/hub/hub-content.ts';

const routeExists=href=>existsSync(join('app',href.slice(1),'page.tsx'));
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);

test('hub navigation and cards link only to existing routes',()=>{
  for(const item of [...HUB_NAV,...HUB_CARDS])if(item.href)assert.ok(routeExists(item.href),item.href);
  assert.equal(HUB_NAV.find(item=>item.id==='play')?.href,'/base');
  assert.equal(HUB_NAV.filter(item=>item.tab).length,6,'portrait tab bar fits six items');
});

test('hub artwork exists as webp and kit references are not shipped to public/',()=>{
  for(const card of HUB_CARDS)assert.ok(existsSync(join('public',card.art)),card.art);
  const files=walk('public/ui');
  assert.ok(files.every(file=>file.endsWith('.webp')),'only compressed artwork in public/ui');
  assert.ok(files.every(file=>!/reference/i.test(file)),'references stay in docs/ui-kits');
});

test('hub is the landing page, the refuge lives at /base and game routes return to it',()=>{
  assert.match(readFileSync('app/page.tsx','utf8'),/import HubApp from "@\/src\/ui\/hub\/HubApp"/);
  assert.match(readFileSync('app/base/page.tsx','utf8'),/import BaseApp from "@\/components\/base\/BaseApp"/);
  const hub=readFileSync('src/ui/hub/HubApp.tsx','utf8');
  assert.doesNotMatch(hub,/from ['"](?:three|[^'"]*components\/|[^'"]*scene)/,'the hub loads no game code');
  for(const file of ['components/expedition/Expedition.tsx','components/metro3d/Metro3D.tsx','components/editor/VegetationEditor.tsx'])
    assert.doesNotMatch(readFileSync(file,'utf8'),/href=['"]\/['"]/,file);
});

test('wallet addresses are shortened for the header',()=>{
  assert.equal(shortAddress('0x3a12345678901234567890abcdef00000007f2e'),'0x3a12…7f2e');
  assert.equal(shortAddress('guest'),'guest');
});
