'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {POIS,EXTRACTIONS,ITEMS,RULES,type LootKind} from './config';
import {bankLoot,type Bag} from './session';
import type {createExpedition,Snapshot} from './scene';
import GameHud from '../game/GameHud';
import styles from './Expedition.module.css';
const SAVE_KEY='netrunner.expedition.stash.v1';
type Save={bag:Bag;lastRun:string};
function readSave():Save{try{const data=JSON.parse(localStorage.getItem(SAVE_KEY)??'{}');const bag:Bag={};for(const k of Object.keys(ITEMS) as LootKind[])if(Number.isSafeInteger(data.bag?.[k])&&data.bag[k]>0)bag[k]=data.bag[k];return {bag,lastRun:typeof data.lastRun==='string'?data.lastRun:''};}catch{return {bag:{},lastRun:''};}}
export default function Expedition(){
  const host=useRef<HTMLDivElement>(null),engine=useRef<ReturnType<typeof createExpedition>|null>(null),runId=useRef('');
  const [state,setState]=useState<Snapshot|null>(null),[error,setError]=useState(''),[debug,setDebug]=useState(false),[debugAllowed,setDebugAllowed]=useState(false),[,setStash]=useState<Bag>({}),[saved,setSaved]=useState(false),[autoFire,setAutoFire]=useState(false);
  useEffect(()=>{let disposed=false;runId.current=crypto.randomUUID();
    import('./scene').then(({createExpedition})=>{if(!disposed&&host.current){setStash(readSave().bag);setDebugAllowed(new URLSearchParams(location.search).has('debug'));engine.current=createExpedition(host.current,setState,setError);if(new URLSearchParams(location.search).has("vegetation"))engine.current.teleport({x:22,z:55});}}).catch(()=>setError('Не удалось запустить мир. Обновите страницу.'));
    return()=>{disposed=true;engine.current?.dispose();engine.current=null;};
  },[]);
  useEffect(()=>{if(state?.status!=='complete'||saved)return;try{const old=readSave(),next=old.lastRun===runId.current?old:{bag:bankLoot(old.bag,state.bag),lastRun:runId.current};localStorage.setItem(SAVE_KEY,JSON.stringify(next));setStash(next.bag);setSaved(true);}catch{setError('Хранилище браузера недоступно: добыча ещё не сохранена. Освободите место и обновите сохранение.');}},[state,saved]);
  const toggleDebug=()=>{engine.current?.setDebug(!debug);setDebug(!debug);};
  return <main className={styles.root}>
    <div className={styles.scene} ref={host}/>
    <header className={styles.header}><Link href="/">C◇B / CYBERBASE</Link><span>OUTLANDS · EXPEDITION 01</span><Link href="/">Покинуть вылазку без добычи ↗</Link></header>
    <aside className={styles.map}><small>ЛОКАЛЬНЫЙ СИГНАЛ</small><svg viewBox="0 0 144 72" aria-label="Карта открытых мест"><path d="M 3 36 H 140" stroke="#637470" strokeWidth="4"/>{state?.discovered.map(id=>{const p=POIS.find(o=>o.id===id)!;return <circle key={id} cx={p.x} cy={p.z} r="1.6" fill="#d4b47d"><title>{p.name}</title></circle>;})}{EXTRACTIONS.map(e=><rect key={e.id} x={e.x-1.5} y={e.z-1.5} width="3" height="3" fill="#81dbdf"><title>{e.name}</title></rect>)}<circle cx={state?.x??9} cy={state?.z??36} r="1.8" fill="white"/></svg><small>○ ВЫ · ▪ ЭВАКУАЦИЯ · ◇ НАЙДЕННЫЕ POI</small></aside>
    <GameHud bag={state?.bag} />
    <div className={styles.message} role="status">{error||state?.message||'Загружаем материалы и персонажа…'}</div>
    <footer className={styles.controls}><span>WASD · клик: идти · Shift: бег · Space: огонь · E: действие</span><div><button aria-pressed={autoFire} onClick={()=>{engine.current?.setAutoFire(!autoFire);setAutoFire(!autoFire);}}>{autoFire?"Автоогонь: вкл":"Автоогонь: выкл"}</button><button onClick={()=>engine.current?.interact()}>{state?.extraction?`Эвакуация ${Math.ceil(RULES.extractionSeconds-state.extraction)} с`:`E · ${state?.near??'Взаимодействие'}`}</button>{debugAllowed&&<button onClick={toggleDebug}>DEBUG</button>}</div></footer>
    {debug&&<aside className={styles.debug}><b>{state?.room}</b><p>{state?.fps} FPS · {state?.draws} draw calls<br/>{state?.activeNPC} NPC · {state?.chunks} chunks</p><Link href="/editor/vegetation">Редактор растительности ↗</Link><button onClick={()=>engine.current?.teleport({x:22,z:55})}>Тестовая роща</button>{[...POIS,...EXTRACTIONS].map(p=><button key={p.id} onClick={()=>engine.current?.teleport(p)}>{p.name}</button>)}</aside>}
    {state&&state.status!=='active'&&<section className={styles.result}><h1>{state.status==='complete'?'Эвакуация завершена':'Вылазка потеряна'}</h1><p>{state.status==='complete'?(saved?'Добыча сохранена в этом браузере.':'Сохраняем добычу…'):'Содержимое рюкзака потеряно. Склад базы не пострадал.'}</p><p>Уничтожено противников: {state.kills}</p><Link href="/">Вернуться в CyberBase →</Link></section>}
  </main>;
}
