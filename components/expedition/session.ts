import {RULES,POIS,EXTRACTIONS,ENCOUNTERS,EVENTS,LOOT_TABLES,ENEMY_TYPES,sectorAt,type LootKind,type Point} from './config.ts';
import {makeWorld,move} from './world.ts';
export type Bag=Partial<Record<LootKind,number>>;
export type Enemy=Point & {id:string;type:string;hp:number;maxHp:number;elite:boolean;cooldown:number;home:Point};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
export class ExpeditionSession {
  hp=100;bag:Bag={};status:'active'|'complete'|'failed'='active';discovered=new Set<string>();opened=new Set<string>();activated=new Set<string>();events=new Set<string>();enemies:Enemy[]=[];extraction=0;extractId:string|null=null;attackCooldown=0;kills=0;message='Пролом позади. Найдите ресурсы и точку эвакуации.';world=makeWorld();lastHit=0;
  random:()=>number;
  constructor(random:()=>number=Math.random){this.random=random;}
  loot(table:string,p:Point){const rows=LOOT_TABLES[table];const total=rows.reduce((n,r)=>n+r.weight,0);let roll=this.random()*total;const row=rows.find(r=>(roll-=r.weight)<0)??rows[0];const count=(row.min+Math.floor(this.random()*(row.max-row.min+1)))*sectorAt(p).lootMultiplier;this.bag[row.item]=(this.bag[row.item]??0)+count;this.message=`Найдено: ${row.item} × ${count}. Сохраните добычу эвакуацией.`;}
  interact(p:Point){if(this.status!=='active')return;
    const extraction=EXTRACTIONS.find(e=>distance(e,p)<RULES.interactionRadius);if(extraction){this.extractId=extraction.id;this.extraction=0;this.message='Эвакуация: оставайтесь в зоне. Урон прерывает вызов.';return;}
    const poi=POIS.find(o=>distance(o,p)<RULES.interactionRadius);if(poi){if(poi.access){this.message='Нужна ключ-карта. Доступ появится позже.';return;}if(poi.id==='core'&&!this.activated.has('cleared:warden')){this.message='Хранилище заблокировано: устраните стража.';return;}if(this.opened.has(poi.id)){this.message='Контейнер пуст.';return;}this.opened.add(poi.id);this.loot(poi.lootTable,p);return;}
    const drop=EVENTS.find(e=>e.id==='drop'&&this.events.has(e.id)&&distance(e,p)<3);if(drop&&!this.opened.has('drop')){this.opened.add('drop');this.loot('technical',p);return;}
    this.message='Подойдите к контейнеру или маяку эвакуации.';
  }
  attack(p:Point){if(this.status!=='active'||this.attackCooldown>0)return null;const target=this.enemies.filter(e=>e.hp>0&&distance(e,p)<RULES.attackRange&&this.lineOfSight(p,e)).sort((a,b)=>distance(a,p)-distance(b,p))[0];if(!target)return null;this.attackCooldown=RULES.attackCooldown;target.hp-=RULES.attackDamage;if(target.hp<=0){this.kills++;if(target.id.startsWith('warden')){this.activated.add('cleared:warden');this.message='Страж уничтожен. Хранилище прототипа открыто.';}}return target;}
  lineOfSight(a:Point,b:Point){const steps=Math.ceil(distance(a,b)*3);for(let i=1;i<steps;i++)if(!this.world.canStand({x:a.x+(b.x-a.x)*i/steps,z:a.z+(b.z-a.z)*i/steps},.05))return false;return true;}
  tick(dt:number,p:Point){if(this.status!=='active')return;dt=Math.max(0,Math.min(dt,.1));this.attackCooldown=Math.max(0,this.attackCooldown-dt);this.lastHit=Math.max(0,this.lastHit-dt);
    POIS.forEach(o=>{if(distance(o,p)<RULES.discoveryRadius)this.discovered.add(o.id);});
    EVENTS.forEach(e=>{if(p.x>e.triggerX&&!this.events.has(e.id)){this.events.add(e.id);this.message=e.id==='signal'?'Слабый сигнал: лагерь к северу от шоссе.':'Снабжение сброшено у промышленного шоссе. Ищите янтарный маяк.';}});
    for(const zone of ENCOUNTERS)if(distance(zone,p)<zone.activationDistance&&!this.activated.has(zone.id)){
      const count=zone.minEnemyCount+Math.floor(this.random()*(zone.maxEnemyCount-zone.minEnemyCount+1));if(this.enemies.filter(e=>e.hp>0).length+count>RULES.maxEnemies)continue;this.activated.add(zone.id);
      for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,pos={x:zone.x+Math.cos(angle)*zone.spawnRadius,z:zone.z+Math.sin(angle)*zone.spawnRadius};if(!this.world.canStand(pos))continue;const elite=this.random()<zone.eliteChance,type=elite?'warden':zone.enemyTypes[i%zone.enemyTypes.length],hp=ENEMY_TYPES[type].hp*sectorAt(zone).enemyMultiplier;this.enemies.push({...pos,id:`${zone.id}:${i}`,type,hp,maxHp:hp,elite,cooldown:1,home:{...pos}});}
    }
    for(const e of this.enemies){if(e.hp<=0||distance(e,p)>25)continue;const stats=ENEMY_TYPES[e.type];e.cooldown-=dt;const d=distance(e,p);if(d>1.5){const next=move(this.world,e,(p.x-e.x)/d*dt*stats.speed,(p.z-e.z)/d*dt*stats.speed);e.x=next.x;e.z=next.z;}else if(e.cooldown<=0){this.hp=Math.max(0,this.hp-stats.damage);e.cooldown=stats.cooldown;this.lastHit=.3;this.extractId=null;this.extraction=0;}}
    if(this.hp<=0){this.status='failed';for(const k of Object.keys(this.bag) as LootKind[])this.bag[k]=Math.floor(this.bag[k]!*(1-RULES.deathLoss));this.message='Вылазка потеряна. Склад базы сохранён.';return;}
    if(this.extractId){const point=EXTRACTIONS.find(e=>e.id===this.extractId)!;if(distance(point,p)>RULES.interactionRadius){this.extractId=null;this.extraction=0;}else{this.extraction+=dt;if(this.extraction>=RULES.extractionSeconds){this.status='complete';this.message='Эвакуация завершена. Добыча доставлена на базу.';}}}
  }
}
export function bankLoot(stash:Bag,bag:Bag):Bag{const result={...stash};for(const key of Object.keys(bag) as LootKind[])result[key]=(result[key]??0)+Math.max(0,bag[key]??0);return result;}
