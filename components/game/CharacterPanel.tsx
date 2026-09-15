'use client';
// Adapter between the game data (combat class, character draft, stash, expedition backpack) and the
// CyberBase UI kit panels in src/ui/character. Draft rules stay in character-draft.ts.
import {useState,type Ref} from 'react';
import {CLASSES,type CombatClass} from './combat';
import {ITEMS,type LootKind} from '../expedition/config';
import {ATTRIBUTES,ATTRIBUTE_BUDGET,TALENT_BUDGET,TALENT_MAX_RANK,TALENT_REQUIRED_RANK,DRAFT_KEY,GEAR,freshDraft,parseDraft,allocateAttribute,allocateTalent,spentTalents,talentBlockReason,type CharacterDraft} from './character-draft';
import {ASSET_URLS} from '../../src/assets/registry';
import RunnerPanel,{type RunnerTab} from '../../src/ui/character/RunnerPanel';
import Loadout,{type LoadoutItem} from '../../src/ui/character/Loadout';
import AbilityMatrix from '../../src/ui/character/AbilityMatrix';
import {CLASS_ROLES,TALENT_UPGRADES} from '../../src/ui/character/talent-upgrades';

const RUNNER='NEON SENTINEL';
const LEVEL=1;
const LOCKER_SLOTS=30;
const ATTRIBUTE_HINTS=['Physical power','Accuracy and reaction','Neural potential','Resilience'];
const LOOT_ICON:Record<LootKind,string>={scrap:'bag',electronics:'spark',batteries:'bolt',weapon_parts:'sword',upgrade_module:'burst',prototype:'target'};
const CLASS_IDS=Object.keys(CLASSES) as CombatClass[];

export default function CharacterPanel({classId,hp,energy,cooldowns,stash,bag,initialTab,onClose,panelRef}:{classId:CombatClass;hp:number;energy:number;cooldowns:number[];stash:Partial<Record<LootKind,number>>;bag:Partial<Record<LootKind,number>>;initialTab:RunnerTab;onClose:()=>void;panelRef?:Ref<HTMLDivElement>}) {
 const [tab,setTab]=useState<RunnerTab>(initialTab);
 const [draft,setDraft]=useState<CharacterDraft>(()=>{try{return parseDraft(localStorage.getItem(DRAFT_KEY));}catch{return freshDraft();}});
 const [selected,setSelected]=useState<string|null>('blade'),[notice,setNotice]=useState('');
 const persist=(next:CharacterDraft,message:string)=>{setDraft(next);try{localStorage.setItem(DRAFT_KEY,JSON.stringify(next));setNotice(message);}catch{setNotice('Storage unavailable · changes last until this window closes');}};

 const combatClass=CLASSES[classId];
 const upgrades=TALENT_UPGRADES[classId];
 const lootItems=(source:Partial<Record<LootKind,number>>,prefix:string,unsecured:boolean):LoadoutItem[]=>(Object.keys(ITEMS) as LootKind[]).filter(kind=>(source[kind]??0)>0).map(kind=>({id:`${prefix}:${kind}`,name:ITEMS[kind].name,rarity:ITEMS[kind].rarity,icon:LOOT_ICON[kind],count:source[kind]!,kind:'loot',unsecured}));
 const gear:LoadoutItem[]=GEAR.map(item=>({id:item.id,name:item.name,rarity:item.rarity,icon:item.icon,count:1,kind:'gear',slot:item.slot,equipped:draft.equipped.includes(item.id)}));
 const backpack=lootItems(bag,'bag',true);
 const attributePoints=ATTRIBUTE_BUDGET-draft.attributes.reduce((a,b)=>a+b,0);
 const talentPoints=TALENT_BUDGET-spentTalents(draft);
 const basic=combatClass.skills[0];
 const blockReason=(slot:number,tier:number)=>{
  const block=talentBlockReason(draft,classId,slot,tier);
  if(block==='prerequisite')return `REQUIRES ${upgrades[slot][tier-1].label.toUpperCase()} ${TALENT_REQUIRED_RANK}/${TALENT_MAX_RANK}`;
  if(block==='max-rank')return 'MAXIMUM RANK';
  if(block==='no-points')return 'NO SKILL POINTS LEFT';
  return block?'UNAVAILABLE':null;
 };

 return <RunnerPanel panelRef={panelRef} tab={tab} onTab={setTab} onClose={onClose} runnerName={RUNNER} className={combatClass.name} level={LEVEL} unsecured={backpack.reduce((sum,item)=>sum+item.count,0)} talentPoints={talentPoints} notice={notice} onReset={()=>persist(freshDraft(),'Draft reset · all points refunded')}>
  {tab==='inventory'
   ?<Loadout runnerName={RUNNER} className={combatClass.name} level={LEVEL} avatarUrl={ASSET_URLS.ui.runnerAvatar} frameUrl={ASSET_URLS.ui.kitPlayerFrame} hp={hp} energy={energy}
     gear={gear} locker={lootItems(stash,'stash',false)} backpack={backpack} lockerSlots={LOCKER_SLOTS}
     attributes={ATTRIBUTES.map((name,index)=>({name,hint:ATTRIBUTE_HINTS[index],value:10+draft.attributes[index]}))} attributePoints={attributePoints}
     onAddAttribute={index=>persist(allocateAttribute(draft,index),`${ATTRIBUTES[index]} +1`)}
     selectedId={selected} onSelect={setSelected}
     onToggleEquip={id=>{const on=draft.equipped.includes(id);persist({...draft,equipped:on?draft.equipped.filter(item=>item!==id):[...draft.equipped,id]},on?'Unequipped':'Equipped');}}
     stats={[['Basic skill',basic.name],['Base damage',String(basic.damage)],['Attack range',`${basic.range} m`],['Basic cooldown',`${basic.cooldown} s`],['Energy regeneration','8 / s'],['Maximum health','100'],['Maximum energy','100']]}/>
   :<AbilityMatrix classId={classId} classes={CLASS_IDS.map(id=>({id,name:CLASSES[id].name,role:CLASS_ROLES[id]}))} skills={combatClass.skills} upgrades={upgrades}
     maxRank={TALENT_MAX_RANK} requiredRank={TALENT_REQUIRED_RANK} budget={TALENT_BUDGET} pointsLeft={talentPoints}
     rank={(slot,tier)=>draft.talents[`${classId}.${slot}.${tier}`]??0} blockReason={blockReason}
     onInvest={(slot,tier)=>persist(allocateTalent(draft,classId,slot,tier),`${upgrades[slot][tier].label} · rank ${(draft.talents[`${classId}.${slot}.${tier}`]??0)+1}/${TALENT_MAX_RANK}`)}
     classLocked={cooldowns.some(value=>value>0)} onSelectClass={id=>window.dispatchEvent(new CustomEvent('netrunner:class',{detail:id}))}/>}
 </RunnerPanel>;
}
