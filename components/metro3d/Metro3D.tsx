'use client';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {CELL,GRID,LEVELS,makeWorld} from './world';
import type {createMetro,Snapshot} from './scene';
import styles from './Metro3D.module.css';

export default function Metro3D(){
  const host=useRef<HTMLDivElement>(null),engine=useRef<ReturnType<typeof createMetro>|null>(null),stick=useRef<HTMLDivElement>(null);
  const [level,setLevel]=useState(1),[error,setError]=useState(''),[hidden,setHidden]=useState(false);
  const [snap,setSnap]=useState<Snapshot>({x:0,z:0,room:'Arrival concourse',fps:0,draws:0,near:null,ready:false});
  const world=useMemo(()=>makeWorld(level),[level]);
  useEffect(()=>{let cancelled=false;const node=host.current!;import('./scene').then(({createMetro})=>{if(cancelled)return;engine.current=createMetro(node,level,setSnap,setError);}).catch(()=>setError('The underground could not load. Please reload.'));return()=>{cancelled=true;engine.current?.dispose();engine.current=null;};},[level]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key.toLowerCase()==='h'&&!e.repeat)setHidden(v=>!v);};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[]);
  const change=(next:number)=>{setError('');setSnap(v=>({...v,ready:false,near:null}));setLevel(next);};
  const updateStick=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect();engine.current?.setStick(Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/40)),Math.max(-1,Math.min(1,(e.clientY-r.top-r.height/2)/40)));};
  return <main className={styles.root}>
    <div ref={host} className={styles.scene}/>
    <button className={styles.hide} onClick={()=>setHidden(v=>!v)}>{hidden?'Show interface':'H · Hide interface'}</button>
    {!hidden&&<>
      <header className={styles.header}><div><span className={styles.symbol}>C◇B</span><strong>CYBERBASE</strong><small>THE LOWER LINES</small></div><Link href='/base'>↑ Return to refuge</Link></header>
      <section className={styles.title}><small>UNDERGROUND / SECTOR 0{level}</small><h1>{LEVELS[level-1].name}</h1><p>{snap.room}</p><span>{LEVELS[level-1].subtitle}</span></section>
      <aside className={styles.map} aria-label='Metro map'><small>LOCAL SIGNAL <span>0{level} / 04</span></small><svg viewBox={`0 0 ${GRID} ${GRID}`} role='img' aria-label='Walkable metro passages and your position'>{[...world.tiles].map(k=>{const [x,z]=k.split(',').map(Number);return <rect key={k} x={x} y={z} width='1' height='1' fill='#48645f'/>;})}<circle cx={world.exit.x/CELL+GRID/2} cy={world.exit.z/CELL+GRID/2} r='1' fill='#81cbd1'/><circle cx={snap.x/CELL+GRID/2} cy={snap.z/CELL+GRID/2} r='.9' fill='#f6d79e'/></svg><p>● Runner　 ◇ Descent</p></aside>
      <footer className={styles.footer}><div className={styles.runner}><small>RUNNER / EXPLORATION</small><strong>NEON SENTINEL</strong><span>No active encounters</span></div><div className={styles.levels}><small>EXPLORE THE FOUR SECTORS</small><nav aria-label='Choose metro level'>{LEVELS.map((l,i)=><button key={l.name} aria-label={`Level ${i+1}: ${l.name}`} aria-pressed={level===i+1} disabled={level===i+1} onClick={()=>change(i+1)}>0{i+1}</button>)}</nav></div><div className={styles.controls}>WASD · Click to move<br/>Shift · Run<br/><small>{snap.fps>2?`${snap.fps} FPS`:'Performance sampling…'}</small></div></footer>
      {snap.ready&&snap.near==='exit'&&<div className={styles.action}>{level<4?<button onClick={()=>change(level+1)}>↓ Descend to sector 0{level+1}</button>:<Link href='/base'>↑ Extract to refuge</Link>}</div>}
      {snap.ready&&snap.near==='entry'&&level>1&&<div className={styles.action}><button onClick={()=>change(level-1)}>↑ Return to sector 0{level-1}</button></div>}
    </>}
    <div ref={stick} className={styles.stick} aria-label='Movement joystick' onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);updateStick(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))updateStick(e);}} onPointerUp={e=>{e.currentTarget.releasePointerCapture(e.pointerId);engine.current?.setStick(0,0);}} onLostPointerCapture={()=>engine.current?.setStick(0,0)} onPointerCancel={()=>engine.current?.setStick(0,0)}><span/></div>
    {!snap.ready&&!error&&<div className={styles.loading}><small>C ◇ B / LOWER LINES</small><h2>Descending into the quiet.</h2><p>Preparing sector 0{level}…</p></div>}
    {error&&<div className={styles.loading}><h2>Connection interrupted</h2><p>{error}</p><Link href='/base'>Return to refuge</Link></div>}
  </main>;
}
