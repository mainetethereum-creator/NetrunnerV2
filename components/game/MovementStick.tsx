'use client';
import {useCallback,useEffect,useRef,type PointerEvent} from 'react';
import {stickVector} from '../expedition/mobile-performance';
import styles from './MovementStick.module.css';

export default function MovementStick({onMove,disabled=false}:{onMove:(x:number,z:number)=>void;disabled?:boolean}) {
  const node=useRef<HTMLDivElement>(null),active=useRef<number|null>(null),callback=useRef(onMove);
  useEffect(()=>{callback.current=onMove;},[onMove]);
  const reset=useCallback(()=>{active.current=null;node.current?.style.setProperty('--stick-x','0px');node.current?.style.setProperty('--stick-y','0px');callback.current(0,0);},[]);
  useEffect(()=>{const clear=()=>{const id=active.current;reset();if(id!==null&&node.current?.hasPointerCapture(id))node.current.releasePointerCapture(id);};window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);window.addEventListener('netrunner:input-reset',clear);return()=>{clear();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);window.removeEventListener('netrunner:input-reset',clear);};},[reset]);
  useEffect(()=>{if(disabled)reset();},[disabled,reset]);
  const update=(e:PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect(),radius=r.width*.32,x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,length=Math.hypot(x,y),factor=Math.min(1,radius/Math.max(1,length)),v=stickVector(x,y,radius);e.currentTarget.style.setProperty('--stick-x',`${x*factor}px`);e.currentTarget.style.setProperty('--stick-y',`${y*factor}px`);callback.current(v.x,v.z);};
  return <div ref={node} className={styles.stick} data-disabled={disabled} role="group" aria-label="Джойстик движения: удерживайте и тяните в нужную сторону" onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if(disabled||active.current!==null||document.querySelector('[aria-modal="true"]'))return;e.preventDefault();active.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);update(e);}} onPointerMove={e=>{if(active.current===e.pointerId)update(e);}} onPointerUp={e=>{if(active.current===e.pointerId){reset();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}} onPointerCancel={e=>{if(active.current===e.pointerId)reset();}} onLostPointerCapture={e=>{if(active.current===e.pointerId)reset();}}><span/><small>ДВИЖЕНИЕ</small></div>;
}
