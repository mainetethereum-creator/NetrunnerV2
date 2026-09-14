// A fitting-room draft, deliberately separate from loot, rewards and combat saves.
export const DRAFT_KEY = 'netrunner.character-draft.v1';
export const ATTRIBUTES = ['Strength', 'Dexterity', 'Intelligence', 'Vitality'] as const;
export const ATTRIBUTE_BUDGET = 5;
export const TALENT_BUDGET = 8;
export type CharacterDraft = { attributes: number[]; talents: Record<string, number>; equipped: string[] };
export const GEAR = [
 {id:'blade',name:'Monoblade MK.01',slot:'Weapon',icon:'sword',rarity:'UNCOMMON'},
 {id:'visor',name:'Neural Visor',slot:'Head',icon:'target',rarity:'RARE'},
 {id:'armor',name:'Kinetic Armor',slot:'Body',icon:'shield',rarity:'COMMON'},
 {id:'boots',name:'Servo Boots',slot:'Legs',icon:'bolt',rarity:'COMMON'},
] as const;
export function freshDraft():CharacterDraft { return {attributes:[0,0,0,0],talents:{},equipped:['blade','armor']}; }
export const spentTalents = (draft:CharacterDraft) => Object.values(draft.talents).reduce((a,b)=>a+b,0);
export function allocateAttribute(draft:CharacterDraft,index:number):CharacterDraft {
 if(!Number.isInteger(index)||index<0||index>3||draft.attributes.reduce((a,b)=>a+b,0)>=ATTRIBUTE_BUDGET)return draft;
 return {...draft,attributes:draft.attributes.map((v,i)=>v+(i===index?1:0))};
}
export function allocateTalent(draft:CharacterDraft,classId:string,slot:number,tier:number):CharacterDraft {
 if(!['warrior','mage','ranger'].includes(classId)||!Number.isInteger(slot)||slot<0||slot>3||!Number.isInteger(tier)||tier<0||tier>2)return draft;
 const id=`${classId}.${slot}.${tier}`,rank=draft.talents[id]??0;
 if(rank>=5||spentTalents(draft)>=TALENT_BUDGET||(tier>0&&(draft.talents[`${classId}.${slot}.${tier-1}`]??0)<3))return draft;
 return {...draft,talents:{...draft.talents,[id]:rank+1}};
}
export function parseDraft(raw:string|null):CharacterDraft {
 try {
  const value=JSON.parse(raw??'null');if(!value||!Array.isArray(value.attributes)||value.attributes.length!==4)return freshDraft();
  if(!value.attributes.every((n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0)||value.attributes.reduce((a:number,b:number)=>a+b,0)>ATTRIBUTE_BUDGET)return freshDraft();
  let draft:CharacterDraft={attributes:value.attributes,talents:{},equipped:GEAR.filter(g=>Array.isArray(value.equipped)&&value.equipped.includes(g.id)).map(g=>g.id)};
  for(const cls of ['warrior','mage','ranger'])for(let slot=0;slot<4;slot++)for(let tier=0;tier<3;tier++) {
   const rank=value.talents?.[`${cls}.${slot}.${tier}`];if(!Number.isSafeInteger(rank)||rank<0||rank>5)continue;
   for(let n=0;n<rank;n++)draft=allocateTalent(draft,cls,slot,tier);
  }
  return draft;
 }catch{return freshDraft();}
}
