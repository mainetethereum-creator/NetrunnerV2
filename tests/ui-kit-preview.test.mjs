import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const css=read('app/ui-kit-preview/ui-kit.css'),extra=read('app/ui-kit-preview/preview.css'),page=read('app/ui-kit-preview/preview.tsx');
test('kit is scoped and isolated with opaque 1px chamfer layers',()=>{
 assert.ok(css.startsWith('.ui-kit-preview {')); assert.doesNotMatch(css,/:root\s*\{/);
 assert.match(css,/isolation:\s*isolate/);assert.match(css,/::after\s*\{ inset: 1px/);
 for(const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))if(block[2].includes('clip-path:'))assert.match(block[1],/::(?:before|after)/);
 assert.doesNotMatch(extra,/clip-path/); assert.doesNotMatch(css+extra,/--bg:\s*(?:rgba|transparent)/);
 assert.match(extra,/font-variant-numeric:tabular-nums/);
 assert.match(page,/className="skill-art"/);assert.match(extra,/\.skill-art\{[^}]*background:url\('\/ui-kit\/skill-yellow\.png'\)/);
});
test('preview does not mount or mutate game surfaces',()=>{
 assert.doesNotMatch(page,/import.*(?:GameHud|CharacterPanel|LandscapePanel|Web3|wagmi)/);
 assert.doesNotMatch(page,/localStorage|sessionStorage|dispatchEvent|fetch\(|https?:\/\//);
 for(const surface of ['HUD','Character / Inventory','Landscape editor','Gap audit'])assert.ok(page.includes(surface));
 assert.match(page,/warrior.*mage.*ranger/s);assert.match(page,/COMMON','UNCOMMON','RARE','EPIC/);
 assert.match(page,/CLASSES\[classId\]\.skills\.map/);
 assert.doesNotMatch(read('app/globals.css'),/ui-kit-preview/);
});
test('local frame assets and responsive rules exist',()=>{
 for(const file of ['skill-yellow.png','panel-wide-yellow.png','player-frame-yellow-v2.png'])assert.ok(existsSync(new URL(`../public/ui-kit/${file}`,import.meta.url)));
 assert.match(extra,/max-width:700px/);assert.match(extra,/orientation:landscape/);
});

const matrix=await import('../app/ui-kit-preview/matrix-state.ts');
test('sandbox matrix enforces ordered ranks and a finite shared bank without mutation',()=>{
 let ranks=matrix.emptyMatrix(); const initial=structuredClone(ranks);
 assert.equal(matrix.pointsLeft(ranks),15);
 assert.match(matrix.unlockReason(ranks,0,1),/Requires Calibration 5\/5/);
 assert.strictEqual(matrix.allocatePoint(ranks,0,1),ranks);
 for(let i=0;i<5;i++)ranks=matrix.allocatePoint(ranks,0,0);
 assert.deepEqual(initial,matrix.emptyMatrix());
 assert.equal(ranks[0][0],5);assert.equal(matrix.pointsLeft(ranks),10);
 assert.strictEqual(matrix.allocatePoint(ranks,0,0),ranks);
 assert.equal(matrix.unlockReason(ranks,0,1),null);
 for(let tier=1;tier<3;tier++)for(let i=0;i<5;i++)ranks=matrix.allocatePoint(ranks,0,tier);
 assert.equal(matrix.pointsLeft(ranks),0);
 assert.match(matrix.unlockReason(ranks,1,0),/No skill points left/);
 assert.strictEqual(matrix.allocatePoint(ranks,1,0),ranks);
 for(const [branch,tier] of [[-1,0],[4,0],[0,3],[0,0.5]])assert.strictEqual(matrix.allocatePoint(ranks,branch,tier),ranks);
});
test('reset and separate class builds never share mutable rows',()=>{
 const warrior=matrix.allocatePoint(matrix.emptyMatrix(),0,0),mage=matrix.emptyMatrix();
 assert.equal(warrior[0][0],1);assert.equal(mage[0][0],0);
 const reset=matrix.emptyMatrix();assert.equal(matrix.pointsLeft(reset),15);
 assert.equal(warrior[0][0],1);assert.notStrictEqual(reset[0],reset[1]);
});
test('matrix presents current skills, concept effects, accessible gates and contained scrolling',()=>{
 const component=read('app/ui-kit-preview/ability-matrix.tsx');
 assert.match(page,/'Gap audit','Ability Matrix'/);
 assert.match(page,/Abilities \/ Matrix','Adapted'/);
 assert.match(component,/CLASSES\[classId\]\.skills\.map/);
 for(const text of ['skill.cost','skill.cooldown','CONCEPT UPGRADE','PREVIEW / SANDBOX','Reset sandbox points','aria-label','disabled={!!reason}'])assert.ok(component.includes(text));
 assert.doesNotMatch(component,/localStorage|sessionStorage|fetch\(|dispatchEvent/);
 assert.match(extra,/matrix-node\.is-locked::after\{background:repeating-linear-gradient/);
 assert.match(extra,/matrix-scroll\{[^}]*max-width:100%;overflow-x:auto/);
});

test('Ghost Signal is the sixth isolated preview surface',()=>{
 const ghost=read('app/ui-kit-preview/ghost-signal.tsx');
 assert.match(page,/\['HUD','Character \/ Inventory','Landscape editor','Gap audit','Ability Matrix','GHOST SIGNAL'\]/);
 assert.match(page,/screen==='GHOST SIGNAL'&&<GhostSignal\/>/);
 assert.match(ghost,/aria-label="Ghost Signal interface presentation"/);
 for(const region of ['ghost-nav','ghost-character','ghost-mission','ghost-focus','ghost-controls','ghost-skill-row'])assert.ok(ghost.includes(region));
 assert.doesNotMatch(ghost,/components\/(?:game|base|expedition)|localStorage|sessionStorage|fetch\(|https?:\/\//);
 assert.doesNotMatch(ghost,/[А-Яа-яЁё]/);
});

test('Ghost Signal interactions keep signal colours semantic and layout contained',()=>{
 const ghost=read('app/ui-kit-preview/ghost-signal.tsx');
 const ghostCss=extra.slice(extra.indexOf('/* Ghost Signal'));
 for(const interaction of ['chooseClass','activate','setCooldowns','setEnergy','setHealth','clearInterval','Field simulation reset'])assert.ok(ghost.includes(interaction));
 assert.match(ghost,/Object\.keys\(CLASS_DATA\)/);assert.match(ghost,/active\.skills\.map/);
 assert.match(ghostCss,/\.ghost-signal\{[^}]*aspect-ratio:16\/9;[^}]*overflow:hidden;[^}]*background:#090a13/);
 assert.match(ghostCss,/\.ghost-class-select button\[aria-pressed=true\]\{[^}]*border-color:var\(--cb-amber\);[^}]*color:var\(--cb-amber\)/);
 assert.match(ghostCss,/\.ghost-brand-mark\{[^}]*border:1px solid var\(--cb-edge-hi\);[^}]*color:var\(--cb-ink\)/);
 assert.match(ghostCss,/\.ghost-skill\{[^}]*--bd:var\(--cb-amber\)/);
 assert.match(ghostCss,/\.ghost-skill:disabled\{[^}]*--bd:var\(--cb-edge\)/);
 assert.match(ghostCss,/\.ghost-health i\{background:var\(--cb-tox\)/);
 assert.match(ghostCss,/\.ghost-energy i\{background:var\(--cb-ice\)/);
 assert.match(ghostCss,/max-width:700px/);assert.match(ghostCss,/orientation:landscape/);
 assert.doesNotMatch(ghostCss,/clip-path/);
});
