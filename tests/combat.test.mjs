import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatState,CLASSES} from '../components/game/combat.ts';
import {ExpeditionSession} from '../components/expedition/session.ts';
test('skills spend energy once and class switching cannot bypass cooldowns',()=>{
 const c=new CombatState();assert.ok(c.cast(1));assert.equal(c.energy,78);assert.equal(c.cast(1),null);assert.equal(c.select('mage'),false);
 for(let i=0;i<61;i++)c.tick(.1);assert.equal(c.select('mage'),true);c.energy=10;assert.equal(c.cast(2),null);assert.equal(c.energy,10);assert.equal(c.cast(8),null);
});
test('sword range, mage area damage, healing and defeated enemies obey combat rules',()=>{
 const s=new ExpeditionSession();s.world={...s.world,canStand:()=>true};const enemy=(id,x)=>({id,x,z:0,hp:100,maxHp:100,type:'scavenger',elite:false,cooldown:1,home:{x,z:0}});s.enemies=[enemy('a',2),enemy('b',5)];
 s.useSkill({x:0,z:0},CLASSES.warrior.skills[0]);assert.equal(s.enemies[0].hp,62);assert.equal(s.enemies[1].hp,100);
 s.useSkill({x:0,z:0},CLASSES.mage.skills[2]);assert.equal(s.enemies[0].hp,12);assert.equal(s.enemies[1].hp,50);
 s.useSkill({x:0,z:0},CLASSES.mage.skills[2]);assert.equal(s.kills,2);s.useSkill({x:0,z:0},CLASSES.mage.skills[2]);assert.equal(s.kills,2);
 s.hp=85;s.useSkill({x:0,z:0},CLASSES.mage.skills[3]);assert.equal(s.hp,100);s.status='failed';s.hp=0;s.useSkill({x:0,z:0},CLASSES.mage.skills[3]);assert.equal(s.hp,0);
});
