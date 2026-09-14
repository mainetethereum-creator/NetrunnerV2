'use client';
import {useSyncExternalStore,useState} from 'react';
import type {WorldEditor} from './controller';
import styles from './WorldEditorPanel.module.css';
export default function WorldEditorPanel({editor}:{editor:WorldEditor}){
 const state=useSyncExternalStore(editor.subscribe,editor.getSnapshot,editor.getSnapshot),[json,setJson]=useState('');
 if(!state)return <p>Загрузка редактора…</p>;
 return <section className={styles.panel} aria-label="Общий редактор объектов" onKeyDown={e=>{editor.keyDown(e.nativeEvent);e.stopPropagation();}}>
 <p>Клик · выбор. G / R / S · режим. X / Y / Z · ось. Стрелки · шаг. Esc · снять выбор.</p>
 <p>LOCKED: объединённые полы, terrain, статическая оболочка, игровые триггеры и противники.</p>
 <div><button onClick={()=>editor.pan(0,-4)}>Камера ↑</button><button onClick={()=>editor.pan(-4,0)}>←</button><button onClick={()=>editor.pan(4,0)}>→</button><button onClick={()=>editor.pan(0,4)}>↓</button><button disabled={!state.selected} onClick={()=>editor.focus()}>К выбранному</button></div>
 <select aria-label="Объекты карты" value={state.selected??''} onChange={e=>editor.select(e.target.value||null)}><option value="">Выберите объект на карте</option>{state.objects.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>
 <div>{(['translate','rotate','scale'] as const).map((m,i)=><button key={m} aria-pressed={state.mode===m} onClick={()=>editor.setMode(m)}>{['G · Двигать','R · Вращать','S · Масштаб'][i]}</button>)}</div>
 <div>{(['x','y','z'] as const).map(a=><button key={a} aria-pressed={state.axis===a} onClick={()=>editor.setAxis(a)}>{a.toUpperCase()}</button>)}<button disabled={!state.selected} aria-label="Уменьшить по выбранной оси" onClick={()=>editor.nudge(-1)}>−</button><button disabled={!state.selected} aria-label="Увеличить по выбранной оси" onClick={()=>editor.nudge(1)}>+</button></div>
 {state.transform&&<div className={styles.fields}>{(['x','y','z','rx','rotation','rz','sx','sy','sz'] as const).map(k=><label key={k}>{k==='rotation'?'Ry':k}<input aria-label={`Transform ${k}`} type="number" step={k.startsWith('s')?.1:k==='rotation'||k.startsWith('r')?15:.25} value={Number(state.transform![k].toFixed(3))} onChange={e=>{if(e.target.value!=='')editor.change({[k]:Number(e.target.value)});}}/></label>)}</div>}
 <div><button disabled={!state.selected} onClick={()=>editor.duplicate()}>Дубликат</button><button disabled={!state.selected} onClick={()=>editor.remove()}>Delete · Удалить</button><button onClick={()=>editor.cancel()}>Esc · Снять выбор</button></div>
 <div><button disabled={!state.canUndo} onClick={()=>editor.undo()}>Ctrl+Z · Undo</button><button disabled={!state.canRedo} onClick={()=>editor.redo()}>Ctrl+Y · Redo</button></div>
 <div><button onClick={()=>editor.save()}>Сохранить</button><button onClick={()=>editor.load()}>Загрузить</button><button onClick={()=>editor.reset()}>Исходная карта</button></div>
 <details><summary>JSON экспорт / импорт</summary><p>Отдельный документ этой карты. Импорт можно отменить. Максимум 500 КБ.</p><button onClick={()=>{const text=editor.exportJSON();setJson(text);const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='world-map.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Экспорт JSON</button><textarea aria-label="JSON карты" value={json} onChange={e=>setJson(e.target.value)} maxLength={500001}/><input aria-label="Импорт файла JSON" type="file" accept="application/json,.json" onChange={async e=>{const file=e.target.files?.[0];if(file){if(file.size>500000){setJson('Файл превышает 500 КБ');return;}setJson(await file.text());}}}/><button onClick={()=>editor.importJSON(json)}>Применить JSON</button></details>
 <p role="status">{state.notice}</p>
 </section>;
}
