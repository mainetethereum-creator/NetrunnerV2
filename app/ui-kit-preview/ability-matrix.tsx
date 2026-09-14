'use client';
import {useState,type CSSProperties} from 'react';
import {CLASSES,type CombatClass} from '../../components/game/combat';
import {allocatePoint,emptyMatrix,MAX_RANK,MATRIX_POINTS,pointsLeft,unlockReason,upgradeNames} from './matrix-state';

export default function AbilityMatrix({classId,names}:{classId:CombatClass;names:string[]}) {
 const [builds,setBuilds]=useState<Record<CombatClass,number[][]>>(()=>({warrior:emptyMatrix(),mage:emptyMatrix(),ranger:emptyMatrix()}));
 const [message,setMessage]=useState('Select an available upgrade to spend 1 sandbox point.');
 const ranks=builds[classId],remaining=pointsLeft(ranks);
 return <section className="matrix cb-cut cb-panel" style={{'--class-color':`var(--cb-c-${classId==='mage'?'hacker':classId})`} as CSSProperties}>
  <header className="cb-panel-hd"><h2>Ability Matrix</h2><span className="cb-sub">PREVIEW / SANDBOX</span></header>
  <div className="cb-panel-bd">
   <div className="matrix-summary"><div><h3 className="matrix-class">{classId}</h3><p className="muted">Four current combat skills. All upgrades and points below are concepts, with no effect on combat or real progression.</p></div><div className="matrix-bank"><output aria-label="Available sandbox skill points">{remaining} / {MATRIX_POINTS}</output><span>SKILL POINTS LEFT</span></div></div>
   <p className="muted">Spend from top to bottom; max the preceding upgrade to unlock the next. Each class keeps its own temporary build until this page reloads.</p>
   <div className="matrix-scroll" role="region" aria-label="Four ability branches; scroll horizontally on narrow screens" tabIndex={0}><div className="matrix-tree">
   {CLASSES[classId].skills.map((skill,branch)=><article className="matrix-branch" key={`${classId}-${branch}`} aria-label={`${names[branch]} upgrades`}>
    <header className="matrix-root cb-cut"><span className="data">SLOT 0{branch+1} / CURRENT SKILL</span><h3>{names[branch]}</h3><span className="data">{skill.cost} EN · {skill.cooldown} s</span><span className="data">{skill.heal?`${skill.heal} HEAL`:`${skill.damage} DAMAGE`}</span></header>
    {upgradeNames.map((name,tier)=>{const rank=ranks[branch][tier],reason=unlockReason(ranks,branch,tier),maxed=rank===MAX_RANK,locked=!!reason&&!maxed;const effects=[`−${rank*3}% cooldown`,`+${rank*4}% ${skill.heal?'healing':'damage'}`,`+${rank*2}% ${skill.heal?'recovery shield':'critical chance'}`];return <div className="matrix-step" key={name}><div className={`matrix-link ${locked?'is-locked':''}`} aria-hidden="true"/><button className={`matrix-node cb-cut ${locked?'is-locked':''} ${maxed?'is-maxed':''}`} disabled={!!reason} aria-label={`${names[branch]}: ${name}, rank ${rank} of ${MAX_RANK}. ${reason??'Spend 1 sandbox point'}`} onClick={()=>{setBuilds(current=>({...current,[classId]:allocatePoint(current[classId],branch,tier)}));setMessage(`${names[branch]} ${name}: rank ${rank+1}/${MAX_RANK} in sandbox.`);}}>
     <span className="matrix-node-heading"><b>{name}</b><span className="data">0{tier+1}</span></span><span className="muted">CONCEPT UPGRADE</span><span className="matrix-effect data">{effects[tier]}</span><span className="matrix-rank"><span className="matrix-pips" aria-hidden="true">{Array.from({length:MAX_RANK},(_,i)=><i key={i} className={i<rank?'filled':''}/>)}</span><span className="data">{rank}/{MAX_RANK}</span></span><span className="matrix-reason">{reason??'Spend 1 sandbox point'}</span>
    </button></div>;})}
   </article>)}
   </div></div>
   <div className="matrix-footer"><p className="muted" role="status" aria-live="polite">{message}</p><button className="cb-cut cb-btn cb-btn-primary" disabled={remaining===MATRIX_POINTS} onClick={()=>{setBuilds(current=>({...current,[classId]:emptyMatrix()}));setMessage(`${classId[0].toUpperCase()+classId.slice(1)} sandbox reset. All ${MATRIX_POINTS} points refunded.`);}}>Reset sandbox points</button></div>
  </div>
 </section>;
}
