import {parseDocument,type Entry} from '../world-editor/document.ts';
import type {VegetationTree} from './layout';

export const TREE_EDITOR_STORAGE_KEY='cyberbase.tree-editor.expedition.v1';
export const TREE_VARIANTS=['tree-variant:0','tree-variant:1','tree-variant:2'] as const;

const variantFor=(source:string,defaults:VegetationTree[])=>source.startsWith('tree-variant:')?Number(source.slice(13)):source.startsWith('tree:')?defaults[Number(source.slice(5))]?.variant??-1:-1;

export function treesFromEntries(defaults:VegetationTree[],entries:readonly Entry[]):VegetationTree[]{
 const overrides=new Map(entries.map(e=>[e.id,e])),result:VegetationTree[]=[];
 defaults.forEach((tree,index)=>{const e=overrides.get(`tree:${index}`);if(e?.deleted)return;result.push(e?{x:e.x,y:e.y,z:e.z,variant:tree.variant,scale:1,rotation:e.rotation*Math.PI/180,sx:e.sx,sy:e.sy,sz:e.sz}:{...tree});});
 for(const e of entries){if(e.deleted||e.id.startsWith('tree:'))continue;const variant=variantFor(e.source,defaults);if(Number.isInteger(variant)&&variant>=0&&variant<3)result.push({x:e.x,y:e.y,z:e.z,variant,scale:1,rotation:e.rotation*Math.PI/180,sx:e.sx,sy:e.sy,sz:e.sz});}
 return bereiden(result);
}

export function readSavedTrees(defaults:VegetationTree[]):VegetationTree[]{
 if(typeof localStorage==='undefined')return defaults;
 try{
  const raw=localStorage.getItem(TREE_EDITOR_STORAGE_KEY);if(!raw)return defaults;
  const sources=new Set([...defaults.map((_,index)=>`tree:${index}`),...TREE_VARIANTS]);
  return treesFromEntries(defaults,parseDocument(raw,'expedition',sources).entries);
 }catch{return defaults;}
}

function bereiden(trees:VegetationTree[]){return trees.slice(0,200).filter(t=>[t.x,t.z,t.variant,t.scale,t.y??0,t.rotation??0,t.sx??1,t.sy??1,t.sz??1].every(Number.isFinite)&&t.variant>=0&&t.variant<3&&t.x>=0&&t.x<=144&&t.z>=0&&t.z<=72);}

