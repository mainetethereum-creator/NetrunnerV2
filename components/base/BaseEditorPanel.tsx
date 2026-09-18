'use client';
import {useState,useSyncExternalStore} from 'react';
import dynamic from 'next/dynamic';
const PropPreview=dynamic(()=>import('../expedition/PropPreview'),{ssr:false});
import type {WorldEditor} from '../world-editor/controller';
import WorldEditorPanel from '../world-editor/WorldEditorPanel';
import {PROP_ASSETS,type PropId} from '../expedition/prop-assets';
import {isReferenceBuilding} from '../../src/assets/reference-buildings';

export default function BaseEditorPanel({editor}:{editor:WorldEditor}){
 const [prop,setProp]=useState('building-reference-armory');
 const state=useSyncExternalStore(editor.subscribe,editor.getSnapshot,editor.getSnapshot);
 const assets=state?.assets??PROP_ASSETS;
 return <><h2>MASTER · БАЗА</h2><WorldEditorPanel editor={editor} unlockedMap/><label>Каталог<select aria-label="Каталог объектов Базы" value={prop} onChange={e=>setProp(e.target.value)}><optgroup label="Новые здания · V1">{assets.filter(a=>isReferenceBuilding(a.id)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</optgroup><optgroup label="Все объекты">{assets.filter(a=>!isReferenceBuilding(a.id)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</optgroup></select></label>{PROP_ASSETS.some(a=>a.id===prop)&&<PropPreview asset={prop as PropId} rotation={0}/>}<p>Выберите объект, затем «Разместить» и кликните по карте. Esc отменяет размещение. «Сохранить» записывает правки в этом браузере.</p><button onClick={()=>{editor.setAsset(prop);editor.arm();}}>Разместить на карте</button></>;
}
