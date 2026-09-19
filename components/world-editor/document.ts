export type MapId = 'base' | 'expedition';
export type Transform = { x:number;y:number;z:number;rx:number;rotation:number;rz:number;sx:number;sy:number;sz:number };
export type Entry = Transform & {id:string;source:string;length?:number;deleted?:boolean};
export type WorldDocument = {version:1;map:MapId;entries:Entry[]};
export const emptyDocument=(map:MapId):WorldDocument=>({version:1,map,entries:[]});
export function parseDocument(text:string,map:MapId,sources:ReadonlySet<string>):WorldDocument {
 if(text.length>500000)throw new Error('JSON превышает 500 КБ');
 const value:unknown=JSON.parse(text);
 if(!value||typeof value!=='object')throw new Error('Неверный документ');
 const d=value as WorldDocument;
 if(d.version!==1||d.map!==map||!Array.isArray(d.entries)||d.entries.length>500)throw new Error('Неверная версия, карта или лимит объектов');
 const ids=new Set<string>();
 const entries=d.entries.map(raw=>{
  if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||ids.has(raw.id)||!sources.has(raw.source))throw new Error('Неизвестный объект или повторяющийся ID');
  // Authored wall IDs contain decimal world coordinates. Accept these only
  // when the ID exactly names a registered source; new prop IDs stay strict.
  const knownAuthoredId=raw.id===raw.source&&sources.has(raw.id)&&raw.id.length<=120;
  if(!knownAuthoredId&&!/^[a-zA-Z0-9:_-]{1,120}$/.test(raw.id))throw new Error('Неизвестный объект или повторяющийся ID');
  if(sources.has(raw.id)&&raw.source!==raw.id)throw new Error("Нельзя подменить исходный объект");
  ids.add(raw.id);
  const keys=['x','y','z','rx','rotation','rz','sx','sy','sz'] as const;
  for(const key of keys)if(!Number.isFinite(raw[key])||Math.abs(raw[key])>1000)throw new Error('Некорректные координаты');
  if([raw.sx,raw.sy,raw.sz].some(n=>n<.05||n>20)||Math.abs(raw.y)>100)throw new Error('Масштаб 0.05–20; высота ±100');
  if(raw.length!==undefined&&(!Number.isFinite(raw.length)||raw.length<3||raw.length>24))throw new Error('Длина 3–24');
  if(raw.deleted!==undefined&&typeof raw.deleted!=='boolean')throw new Error('Неверное удаление');
  return {id:raw.id,source:raw.source,...Object.fromEntries(keys.map(k=>[k,raw[k]])),...(raw.length===undefined?{}:{length:raw.length}),...(raw.deleted?{deleted:true}:{})} as Entry;
 });
 return {version:1,map,entries};
}
export function createHistory(initial:WorldDocument){
 let current=structuredClone(initial);const past:WorldDocument[]=[],future:WorldDocument[]=[];
 return {get current(){return structuredClone(current);},get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},commit(next:WorldDocument){if(JSON.stringify(current)===JSON.stringify(next))return;past.push(current);if(past.length>100)past.shift();current=structuredClone(next);future.length=0;},undo(){if(past.length){future.push(current);current=past.pop()!;}return this.current;},redo(){if(future.length){past.push(current);current=future.pop()!;}return this.current;}};
}
