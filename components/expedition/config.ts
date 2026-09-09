export type Point = { x:number; z:number };
export type Rect = Point & { w:number; d:number };
export const RULES = { chunkSize:24, activeRadius:1, maxEnemies:14, extractionSeconds:4, discoveryRadius:13, interactionRadius:3, attackRange:9, attackDamage:24, attackCooldown:.42, deathLoss:1 };
export const ENEMY_TYPES:Record<string,{hp:number;damage:number;speed:number;cooldown:number}>={scavenger:{hp:40,damage:7,speed:2.1,cooldown:1.1},drone:{hp:50,damage:8,speed:2.4,cooldown:1.3},warden:{hp:180,damage:18,speed:1.7,cooldown:1.1}};
export const SECTORS = [
  {id:'outskirts',name:'01 / OUTSKIRTS',from:0,to:72,difficulty:1,lootMultiplier:1,enemyMultiplier:1,eliteChance:0,enabled:true},
  {id:'industrial',name:'02 / INDUSTRIAL',from:72,to:144,difficulty:2,lootMultiplier:2,enemyMultiplier:1.3,eliteChance:.12,enabled:true},
  {id:'dead',name:'03 / DEAD DISTRICT',from:144,to:216,difficulty:3,lootMultiplier:3,enemyMultiplier:1.6,eliteChance:.2,enabled:false},
  {id:'contaminated',name:'04 / CONTAMINATED',from:216,to:288,difficulty:4,lootMultiplier:4,enemyMultiplier:2,eliteChance:.3,enabled:false},
  {id:'military',name:'05 / RESTRICTED',from:288,to:360,difficulty:5,lootMultiplier:5,enemyMultiplier:2.5,eliteChance:.4,enabled:false},
];
export type LootKind='scrap'|'electronics'|'batteries'|'weapon_parts'|'upgrade_module'|'prototype';
export const ITEMS:Record<LootKind,{name:string;rarity:string}>={scrap:{name:'Металлолом',rarity:'COMMON'},electronics:{name:'Электроника',rarity:'COMMON'},batteries:{name:'Батареи',rarity:'UNCOMMON'},weapon_parts:{name:'Детали оружия',rarity:'UNCOMMON'},upgrade_module:{name:'Модуль улучшения',rarity:'RARE'},prototype:{name:'Прототип',rarity:'EPIC'}};
export const LOOT_TABLES:Record<string,{item:LootKind;weight:number;min:number;max:number}[]>={
  salvage:[{item:'scrap',weight:6,min:2,max:5},{item:'electronics',weight:3,min:1,max:3},{item:'batteries',weight:1,min:1,max:2}],
  technical:[{item:'weapon_parts',weight:4,min:1,max:3},{item:'batteries',weight:3,min:2,max:4},{item:'upgrade_module',weight:2,min:1,max:1}],
  elite:[{item:'prototype',weight:1,min:1,max:1}],
};
export type POI=Point & {id:string;name:string;kind:'station'|'convoy'|'camp'|'warehouse'|'power'|'bunker';lootTable:string;access?:'keycard'|'hacking';event?:string};
export const POIS:POI[]=[
  {id:'fuel',name:'Последняя заправка',kind:'station',x:25,z:20,lootTable:'salvage'},
  {id:'convoy',name:'Разбитый конвой',kind:'convoy',x:43,z:38,lootTable:'salvage'},
  {id:'camp',name:'Лагерь эвакуации',kind:'camp',x:53,z:11,lootTable:'salvage'},
  {id:'shelter',name:'Закрытый архив',kind:'bunker',x:65,z:57,lootTable:'technical',access:'keycard'},
  {id:'warehouse',name:'Склад № 7',kind:'warehouse',x:87,z:23,lootTable:'technical'},
  {id:'power',name:'Релейная станция',kind:'power',x:103,z:50,lootTable:'technical'},
  {id:'core',name:'Хранилище прототипа',kind:'bunker',x:122,z:27,lootTable:'elite'},
  {id:'catwalk',name:'Технический мостик',kind:'camp',x:107,z:58,lootTable:'technical'},
];
export const EXTRACTIONS=[{id:'breach',name:'Пролом / возврат на базу',x:7,z:36},{id:'lift',name:'Грузовой подъёмник',x:133,z:51}];
export const ENCOUNTERS=[
  {id:'scouts',x:39,z:35,enemyTypes:['scavenger'],minEnemyCount:2,maxEnemyCount:3,difficultyLevel:1,eliteChance:0,respawnEnabled:false,spawnRadius:3,activationDistance:16},
  {id:'depot',x:82,z:34,enemyTypes:['drone'],minEnemyCount:2,maxEnemyCount:3,difficultyLevel:2,eliteChance:.1,respawnEnabled:false,spawnRadius:4,activationDistance:18},
  {id:'relay',x:104,z:48,enemyTypes:['drone'],minEnemyCount:2,maxEnemyCount:2,difficultyLevel:2,eliteChance:0,respawnEnabled:false,spawnRadius:3,activationDistance:14},
  {id:'warden',x:120,z:31,enemyTypes:['warden'],minEnemyCount:1,maxEnemyCount:1,difficultyLevel:3,eliteChance:1,respawnEnabled:false,spawnRadius:2,activationDistance:20},
];
export const EVENTS=[{id:'signal',type:'DISTRESS SIGNAL',triggerX:20,x:53,z:11},{id:'drop',type:'SUPPLY DROP',triggerX:70,x:95,z:39}];
export const SPAWN={x:9,z:36};
export const BOUNDS={w:144,d:72};
export const sectorAt=(p:Point)=>SECTORS.find(s=>s.enabled&&p.x>=s.from&&p.x<s.to)??SECTORS[0];
