import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorld,findRoute,move,SOLIDS} from '../components/expedition/world.ts';
import {POIS,EXTRACTIONS,SPAWN,RULES} from '../components/expedition/config.ts';
import {ExpeditionSession,bankLoot} from '../components/expedition/session.ts';
import {terrainHeight,insideLandscape,HANGARS} from '../components/expedition/terrain.ts';
test('terrain mound is traversable and hangars and irregular edges block movement',()=>{const world=makeWorld();let p={x:35,z:56};for(let i=0;i<80;i++)p=move(world,p,.1,0);assert.ok(terrainHeight(p)>1.5);assert.equal(insideLandscape({x:40,z:71}),false);for(const h of HANGARS)assert.equal(world.canStand(h),false);});
test('all authored POIs and extraction points are reachable without crossing solids',()=>{
  const world=makeWorld();for(const p of [...POIS,...EXTRACTIONS]){assert.ok(world.canStand(p),p.name);const path=findRoute(world,SPAWN,p);assert.ok(path.length,p.name);for(const step of path)assert.ok(world.canStand(step));}
  for(const solid of SOLIDS)assert.equal(world.canStand(solid),false);
  assert.ok(world.canStand(move(world,SPAWN,250,0)));
});
test('loot cannot be collected twice and remains separate from stash until extraction',()=>{
  const run=new ExpeditionSession(()=>.5);const stash={scrap:10};run.interact(POIS[0]);const bag={...run.bag};run.interact(POIS[0]);assert.deepEqual(run.bag,bag);assert.deepEqual(stash,{scrap:10});
  run.interact(EXTRACTIONS[0]);for(let i=0;i<41;i++)run.tick(.1,EXTRACTIONS[0]);assert.equal(run.status,'complete');assert.ok(Object.keys(bankLoot(stash,run.bag)).length);const complete={...run.bag};run.interact(POIS[1]);assert.deepEqual(run.bag,complete);
});
test('extraction cancels outside area; defeat discards expedition bag only',()=>{
  const run=new ExpeditionSession();run.bag={prototype:1};run.interact(EXTRACTIONS[0]);run.tick(.1,POIS[0]);assert.equal(run.extractId,null);run.hp=0;run.tick(.1,SPAWN);assert.equal(run.status,'failed');assert.equal(run.bag.prototype,0);
});
test('encounters activate once, cap living enemies, and elite unlocks vault',()=>{
  const run=new ExpeditionSession(()=>.5);const p={x:120,z:31};run.tick(.1,p);const n=run.enemies.length;run.tick(.1,p);assert.equal(run.enemies.length,n);assert.ok(n<=RULES.maxEnemies);const elite=run.enemies.find(e=>e.elite);assert.ok(elite);for(let i=0;i<12;i++){run.attack(p);run.attackCooldown=0;}assert.ok(run.activated.has('cleared:warden'));run.interact(POIS.find(p=>p.id==='core'));assert.equal(run.bag.prototype,2);
});
test('signal and supply event fire once and locked archive stays locked',()=>{const run=new ExpeditionSession();run.tick(.1,{x:95,z:39});assert.equal(run.events.size,2);run.interact({x:95,z:39});const bag={...run.bag};run.interact({x:95,z:39});assert.deepEqual(run.bag,bag);run.interact(POIS.find(p=>p.id==='shelter'));assert.deepEqual(run.bag,bag);});
