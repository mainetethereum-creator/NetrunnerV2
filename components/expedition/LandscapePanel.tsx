'use client';
import {useEffect,useState} from 'react';
import type {LandscapeStudio} from './landscape-studio';
import {landscapeRanges,type LandscapePatch} from './landscape-state';
const names:Record<string,string>={x:'Положение X',z:'Положение Z',radius:'Радиус участка',moss:'Покрытие мхом',moisture:'Влажность',cracks:'Сухие трещины',density:'Плотность травы',height:'Высота травы',curl:'Изгиб травинок',wind:'Сила ветра',mound:'Высота насыпей',scale:'Масштаб насыпей',relief:'Мелкий рельеф',seed:'Смещение рисунка'};
export default function LandscapePanel({studio}:{studio:LandscapeStudio|undefined}){
 const [,refresh]=useState(0),[notice,setNotice]=useState('Изменения видны сразу. Черновик сохраняется в этом браузере; игра использует опубликованный ландшафт.');
 useEffect(()=>studio?.subscribe(()=>refresh(n=>n+1)),[studio]);
 if(!studio)return <p>Загрузка ландшафта…</p>;
 const p=studio.patches.find(p=>p.id===studio.selected)??studio.patches[0];
 return <div style={{display:'grid',gap:12,padding:12}} onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
 <label>Участок почвы<select aria-label="Участок ландшафта" value={p.id} onChange={e=>studio.select(e.target.value)} style={{width:'100%'}}>{studio.patches.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <small>Выберите участок в списке или кликом по карте. Золотой контур показывает границу. Дорога и основания зданий защищены от рельефа.</small>
 <label>Цвет почвы <input aria-label="Цвет почвы" type="color" value={p.soil} onChange={e=>studio.change(p.id,{soil:e.target.value})}/></label>
 {Object.entries(landscapeRanges).map(([key,[min,max,step]])=><label key={key} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:4}}>{names[key]}<output>{Number(p[key as keyof LandscapePatch]).toFixed(2)}</output><input style={{gridColumn:'1 / -1',width:'100%'}} aria-label={names[key]} type="range" min={min} max={max} step={step} value={p[key as keyof LandscapePatch]} onChange={e=>studio.change(p.id,{[key]:Number(e.target.value)})}/></label>)}
 <button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(studio.patches,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='landscape-release.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Конфигурация экспортирована.');}}>Экспорт конфигурации</button>
 <button onClick={()=>setNotice(studio.save())}>Сохранить в браузере</button><button onClick={()=>setNotice(studio.load())}>Загрузить сохранение</button><button onClick={()=>{studio.reset();setNotice('Исходные участки восстановлены. Нажмите «Сохранить», чтобы заменить сохранение.');}}>Сбросить к исходному</button><small role="status">{notice}</small><small>GrassSystemThreeJS · Soil Studio · MIT</small>
 </div>;
}
