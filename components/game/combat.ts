export type CombatClass = 'warrior' | 'mage' | 'ranger';
export type Skill = {name:string;icon:string;cost:number;cooldown:number;damage:number;range:number;area?:boolean;heal?:number;clip:string};
export const CLASSES:Record<CombatClass,{name:string;skills:Skill[]}> = {
 warrior:{name:'Warrior',skills:[
  {name:'Rending Strike',icon:'sword',cost:0,cooldown:.9,damage:38,range:3,clip:'GREAT_SWORD_DOWNWARD_SLASH'},
  {name:'Blade Combo',icon:'blades',cost:22,cooldown:6,damage:68,range:3.5,area:true,clip:'GREAT_SWORD_COMBO_SLASH'},
  {name:'Quantum Rift',icon:'burst',cost:35,cooldown:10,damage:85,range:5,area:true,clip:'GREAT_SWORD_CASTING'},
  {name:'Recovery',icon:'shield',cost:30,cooldown:18,damage:0,range:0,heal:30,clip:'MAGIC_AREA_PULSE'}]},
 mage:{name:'Mage',skills:[
  {name:'Pulse',icon:'spark',cost:0,cooldown:.85,damage:25,range:10,clip:'MAGIC_1H_ATTACK'},
  {name:'Neural Spike',icon:'bolt',cost:20,cooldown:5,damage:60,range:12,clip:'MAGIC_NEURAL_SPIKE'},
  {name:'Shockwave',icon:'burst',cost:35,cooldown:9,damage:50,range:6,area:true,clip:'MAGIC_AREA_PULSE'},
  {name:'Regeneration',icon:'shield',cost:30,cooldown:18,damage:0,range:0,heal:30,clip:'MAGIC_AREA_PULSE'}]},
 ranger:{name:'Ranger',skills:[
  {name:'Quick Shot',icon:'target',cost:0,cooldown:.42,damage:24,range:10,clip:'MAGIC_1H_ATTACK'},
  {name:'Piercing Shot',icon:'bolt',cost:20,cooldown:5,damage:65,range:14,clip:'MAGIC_NEURAL_SPIKE'},
  {name:'EMP Charge',icon:'burst',cost:35,cooldown:9,damage:45,range:6,area:true,clip:'MAGIC_AREA_PULSE'},
  {name:'Med Capsule',icon:'shield',cost:30,cooldown:18,damage:0,range:0,heal:30,clip:'MAGIC_AREA_PULSE'}]},
};
export class CombatState {
 classId:CombatClass='warrior'; energy=100; cooldowns=[0,0,0,0]; lock=0;
 select(id:CombatClass){if(this.lock>0||this.cooldowns.some(c=>c>0))return false;this.classId=id;return true;}
 tick(dt:number){dt=Math.max(0,Math.min(dt,.1));this.energy=Math.min(100,this.energy+dt*8);this.lock=Math.max(0,this.lock-dt);this.cooldowns=this.cooldowns.map(c=>Math.max(0,c-dt));}
 cast(slot:number){const s=CLASSES[this.classId].skills[slot];if(!s||this.lock>0||this.cooldowns[slot]>0||this.energy<s.cost)return null;this.energy-=s.cost;this.cooldowns[slot]=s.cooldown;this.lock=Math.min(s.cooldown,.85);return s;}
}
