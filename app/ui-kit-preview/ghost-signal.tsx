'use client';

import {useEffect, useState, type CSSProperties} from 'react';

type GhostClass = 'warrior' | 'mage' | 'ranger';
type GhostSkill = {name:string; detail:string; cost:number; cooldown:number; mark:string};

const CLASS_DATA:Record<GhostClass,{callSign:string; role:string; health:number; skills:GhostSkill[]}> = {
 warrior:{callSign:'Mara Voss',role:'Warrior',health:84,skills:[
  {name:'Cleave',detail:'Forward arc',cost:0,cooldown:2,mark:'╱'},
  {name:'Combination',detail:'Three strikes',cost:22,cooldown:6,mark:'⌁'},
  {name:'Quantum rift',detail:'Area breach',cost:35,cooldown:10,mark:'✣'},
  {name:'Recovery',detail:'Restore health',cost:30,cooldown:18,mark:'+'},
 ]},
 mage:{callSign:'Iona Vale',role:'Mage',health:68,skills:[
  {name:'Pulse',detail:'Signal bolt',cost:0,cooldown:2,mark:'⌁'},
  {name:'Neural spike',detail:'Focused surge',cost:20,cooldown:5,mark:'ϟ'},
  {name:'Wave',detail:'Area pulse',cost:35,cooldown:9,mark:'◎'},
  {name:'Regeneration',detail:'Restore health',cost:30,cooldown:18,mark:'+'},
 ]},
 ranger:{callSign:'Cade North',role:'Ranger',health:76,skills:[
  {name:'Shot',detail:'Precision hit',cost:0,cooldown:1,mark:'·'},
  {name:'Piercing shot',detail:'Armor break',cost:20,cooldown:5,mark:'↗'},
  {name:'EMP charge',detail:'Area disrupt',cost:35,cooldown:9,mark:'✣'},
  {name:'Med capsule',detail:'Restore health',cost:30,cooldown:18,mark:'+'},
 ]},
};

const classAccent:Record<GhostClass,string>={warrior:'var(--cb-c-warrior)',mage:'var(--cb-c-hacker)',ranger:'var(--cb-c-ranger)'};

export default function GhostSignal(){
 const [classId,setClassId]=useState<GhostClass>('warrior');
 const [health,setHealth]=useState(CLASS_DATA.warrior.health);
 const [energy,setEnergy]=useState(72);
 const [cooldowns,setCooldowns]=useState([0,0,0,0]);
 const [message,setMessage]=useState('Signal acquired. Field controls are standing by.');
 const active=CLASS_DATA[classId];

 useEffect(()=>{
  if(!cooldowns.some(Boolean)&&energy>=100)return;
  const timer=setInterval(()=>{
   setCooldowns(values=>values.map(value=>Math.max(0,Number((value-.1).toFixed(1)))));
   setEnergy(value=>Math.min(100,value+1));
  },100);
  return()=>clearInterval(timer);
 },[cooldowns,energy]);

 const chooseClass=(next:GhostClass)=>{
  setClassId(next);setHealth(CLASS_DATA[next].health);setEnergy(72);setCooldowns([0,0,0,0]);
  setMessage(`${CLASS_DATA[next].role} profile loaded in this preview.`);
 };
 const activate=(slot:number)=>{
  const skill=active.skills[slot];
  if(cooldowns[slot]>0||energy<skill.cost)return;
  setEnergy(value=>value-skill.cost);
  setCooldowns(values=>values.map((value,index)=>index===slot?skill.cooldown:value));
  if(slot===3)setHealth(value=>Math.min(100,value+24));
  setMessage(`${skill.name} simulated. ${skill.cooldown} second cooldown started.`);
 };
 const reset=()=>{setHealth(active.health);setEnergy(72);setCooldowns([0,0,0,0]);setMessage('Field simulation reset.');};

 return <section className="ghost-signal" aria-label="Ghost Signal interface presentation" style={{'--ghost-class':classAccent[classId]} as CSSProperties}>
  <div className="ghost-atmosphere" aria-hidden="true"><i/><i/><i/><div className="ghost-figure"><span/><span/></div></div>
  <header className="ghost-nav">
   <div className="ghost-brand"><span className="ghost-brand-mark" aria-hidden="true">G</span><div><b>GHOST SIGNAL</b><small>FIELD INTERFACE / PROTOTYPE</small></div></div>
   <div className="ghost-sector"><span>RELAY 07</span><i aria-hidden="true"/><span className="ghost-cyan">LINK STABLE</span></div>
   <div className="ghost-nav-data data"><span>LAT 51.407</span><span>LON 30.056</span></div>
  </header>

  <div className="ghost-character cb-cut">
   <div className="ghost-portrait" aria-hidden="true"><span>{active.callSign.slice(0,1)}</span></div>
   <div className="ghost-identity"><small>RUNNER / 04</small><h2>{active.callSign}</h2><div><span style={{color:'var(--ghost-class)'}}>{active.role}</span><b className="data">LEVEL 18</b></div></div>
   <div className="ghost-vitals">
    <div className="ghost-vital-label"><span>HEALTH</span><output>{String(health).padStart(3,'0')} / 100</output></div>
    <div className="ghost-meter ghost-health"><i style={{width:`${health}%`}}/></div>
    <div className="ghost-vital-label"><span>ENERGY</span><output>{String(energy).padStart(3,'0')} / 100</output></div>
    <div className="ghost-meter ghost-energy"><i style={{width:`${energy}%`}}/></div>
   </div>
  </div>

  <aside className="ghost-mission cb-cut">
   <div className="ghost-mission-state"><span className="ghost-cyan"><i/> SIGNAL FOUND</span><span className="data">08:42</span></div>
   <small>CURRENT OBJECTIVE</small><h2>Reach the relay</h2><p>Trace the carrier wave through the flooded interchange.</p>
   <div className="ghost-distance"><span>DISTANCE</span><output>184 m</output></div>
  </aside>

  <div className="ghost-focus" aria-hidden="true"><span/><i/><b>184</b><small>RELAY</small></div>
  <div className="ghost-caption"><span>INTERCEPT / 04</span><h2>A voice with no source.</h2><p>Keep moving. The signal is learning your route.</p></div>

  <div className="ghost-controls">
   <div className="ghost-class-select" aria-label="Runner class selector">
    <span>LOADOUT</span>{(Object.keys(CLASS_DATA) as GhostClass[]).map(id=><button key={id} aria-pressed={id===classId} onClick={()=>chooseClass(id)}>{CLASS_DATA[id].role}</button>)}
   </div>
   <div className="ghost-skill-row">
    {active.skills.map((skill,index)=>{const remaining=cooldowns[index],disabled=remaining>0||energy<skill.cost;return <button className="ghost-skill cb-cut" key={`${classId}-${skill.name}`} disabled={disabled} onClick={()=>activate(index)} aria-label={`${skill.name}, ${skill.cost} energy${remaining>0?`, cooldown ${remaining.toFixed(1)} seconds`:''}`}>
     <kbd>{index+1}</kbd><span className="ghost-skill-mark" aria-hidden="true">{skill.mark}</span><span className="ghost-skill-copy"><b>{skill.name}</b><small>{remaining>0?'RECHARGING':skill.detail}</small></span>
     <span className="ghost-skill-stat data">{remaining>0?`${remaining.toFixed(1)} s`:`${skill.cost} EN`}</span>
     {remaining>0&&<i className="ghost-cooldown" style={{transform:`scaleY(${remaining/skill.cooldown})`}} aria-hidden="true"/>}
    </button>;})}
   </div>
   <button className="ghost-reset cb-cut" onClick={reset}><span aria-hidden="true">↻</span> RESET</button>
  </div>
  <footer className="ghost-status"><p role="status" aria-live="polite">{message}</p><span className="data">SIMULATION / LOCAL STATE</span></footer>
 </section>;
}
