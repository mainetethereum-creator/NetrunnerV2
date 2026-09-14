'use client';
import {useState} from 'react';
import type {WorldEditor} from '../world-editor/controller';
import WorldEditorPanel from '../world-editor/WorldEditorPanel';
import {PROP_ASSETS,type PropId} from '../expedition/prop-assets';

export default function BaseEditorPanel({editor}:{editor:WorldEditor}){
 const [prop,setProp]=useState<PropId>('barricade');
 return <><h2>MASTER · БАЗА</h2><WorldEditorPanel editor={editor}/><label>Каталог<select value={prop} onChange={e=>setProp(e.target.value as PropId)}>{PROP_ASSETS.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><button onClick={()=>{editor.setAsset(prop);editor.arm();}}>Разместить на карте</button></>;
}
