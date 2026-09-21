// CyberBase 2D UI kit installed in the game world (branch feature/ui-kit-3d):
// NPC dialogue on the base, loadout and ability matrix in the character panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLASSES} from '../components/game/combat.ts';
import {CLASS_ROLES,TALENT_UPGRADES,talentEffect} from '../src/ui/character/talent-upgrades.ts';

test('every 3D skill has three talent modules that change a number the skill really has',()=>{
  for(const [id,combatClass] of Object.entries(CLASSES)){
    const modules=TALENT_UPGRADES[id];
    assert.ok(CLASS_ROLES[id],id);
    assert.equal(modules.length,combatClass.skills.length,id);
    combatClass.skills.forEach((skill,slot)=>{
      assert.equal(modules[slot].length,3,`${id}.${slot}`);
      for(const upgrade of modules[slot]){
        const where=`${id}.${slot} ${upgrade.label}`;
        assert.ok(upgrade.value>0,where);
        if(upgrade.stat==='damage')assert.ok(skill.damage>0,where);
        if(upgrade.stat==='cost')assert.ok(skill.cost>0,where);
        if(upgrade.stat==='range')assert.ok(skill.range>0,where);
        if(upgrade.stat==='radius')assert.ok(skill.area,where);
        if(upgrade.stat==='heal')assert.ok(skill.heal,where);
      }
    });
  }
});

test('effect lines print the outcome, not the rank',()=>{
  const strike=CLASSES.warrior.skills[0];
  const damage={label:'Monoblade Edge',description:'',stat:'damage',value:8};
  assert.equal(talentEffect(strike,damage,0),'+8% DAMAGE PER RANK');
  assert.equal(talentEffect(strike,damage,2),'+16% DAMAGE · 38 → 44');
  assert.equal(talentEffect(strike,{label:'Long Reach',description:'',stat:'range',value:6},2),'+12% RANGE · 3.0 m → 3.4 m');
  assert.equal(talentEffect(CLASSES.warrior.skills[1],{label:'Efficient Motor',description:'',stat:'cost',value:7},3),'−21% ENERGY COST · 22 → 17');
  assert.equal(talentEffect(CLASSES.warrior.skills[1],{label:'Wide Spectrum',description:'',stat:'radius',value:8},1),'+8% RADIUS');
});

test('the refuge talks through the kit dialogue and the character panel renders kit panels',()=>{
  const base=readFileSync('components/base/BaseApp.tsx','utf8');
  assert.match(base,/<NpcDialogue/);
  assert.doesNotMatch(base,/styles\.npcDialog/);
  const panel=readFileSync('components/game/CharacterPanel.tsx','utf8');
  assert.match(panel,/<RunnerPanel/);
  assert.match(panel,/<Loadout/);
  assert.match(panel,/<AbilityMatrix/);
  assert.match(readFileSync('components/game/GameHud.tsx','utf8'),/<CharacterPanel key=\{panel\} panelRef=\{modal\}/);
});

test('kit tokens stay scoped to the kit class so the hub and HUD skin keep their own',()=>{
  const css=readFileSync('src/ui/kit/kit.module.css','utf8');
  assert.doesNotMatch(css,/:root/);
  assert.match(css,/\.kit \{/);
  for(const file of ['src/ui/dialogue/NpcDialogue.tsx','src/ui/character/RunnerPanel.tsx'])assert.match(readFileSync(file,'utf8'),/aria-modal="true"/,file);
});

test('base test HUD keeps FPS visible and camera controls collapsible',()=>{
  const base=readFileSync('components/base/BaseApp.tsx','utf8');
  assert.match(base,/styles\.fpsBadge/);
  assert.match(base,/styles\.cameraToggle/);
  assert.match(base,/aria-expanded=\{cameraOpen\}/);
  assert.match(base,/cameraOpen &&/);
});
