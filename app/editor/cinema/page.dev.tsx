'use client';

import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { CINEMA_SHOTS, shotPose } from '../../../components/cinema/shots';
import type { CinemaCapture } from '../../../components/cinema/capture-types';
import { createCinemaWalk } from '../../../components/cinema/walk';

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;

export default function CinemaPage() {
  const host = useRef<HTMLDivElement>(null);
  const capture = useRef<CinemaCapture | null>(null);
  const engine = useRef<{ dispose(): void } | null>(null);
  const busy = useRef(false);
  const walk = useRef<Awaited<ReturnType<typeof createCinemaWalk>> | null>(null);
  const [location, setLocation] = useState<'base' | 'expedition'>('base');
  const [status, setStatus] = useState('Loading scene…');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    const mount = host.current!;
    const accept = (value: CinemaCapture) => { capture.current = value; };
    const error = (message: string) => setStatus(`Asset error: ${message}`);
    void (async () => {
      if (location === 'base') {
        const { createBaseScene } = await import('../../../components/base/scene');
        if (cancelled) return;
        engine.current = createBaseScene(mount, () => {}, () => {}, () => {}, error, () => {}, accept);
      } else {
        const { createExpedition } = await import('../../../components/expedition/scene');
        if (cancelled) return;
        engine.current = createExpedition(mount, () => {}, error, () => {}, () => {}, accept);
      }
    })();
    const timer = window.setInterval(async () => {
      const rig = capture.current;
      if (cancelled || !rig?.ready() || performance.now() - started < 18000) return;
      window.clearInterval(timer);
      rig.prepare(WIDTH, HEIGHT);
      try {
        const motion = rig.character ? await createCinemaWalk(rig.character) : null;
        if (cancelled) { motion?.dispose(); return; }
        walk.current = motion;
      } catch (error) { setStatus(error instanceof Error ? error.message : 'Walk loading failed'); return; }
      if (location === 'base') {
        for (const [x,y,z,color,power] of [[-15,5,-6,0x24caff,44],[8,6,-8,0xcf42ff,36],[27,6,-12,0x31ccff,42]]) {
          const light = new T.PointLight(color,power,18,2); light.position.set(x,y,z); rig.scene.add(light);
        }
      }
      const first = CINEMA_SHOTS.find(shot => shot.location === location)!;
      rig.frame(shotPose(first,0),first.start,0);
      setReady(true); setStatus('Ready · 1920 × 1080 · 30 fps · deterministic capture');
    }, 500);
    return () => { cancelled = true; busy.current = false; window.clearInterval(timer); walk.current?.dispose(); walk.current = null; engine.current?.dispose(); engine.current = null; capture.current = null; };
  }, [location]);

  async function saveFrame(canvas: HTMLCanvasElement, shot: string, frame: number) {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Empty frame')), 'image/jpeg', .97));
    const response = await fetch(`/api/cinema?shot=${shot}&frame=${frame}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    if (!response.ok) throw new Error(`Frame save failed: ${response.status}`);
  }

  async function record(preview: boolean, only?: number) {
    const rig = capture.current;
    if (!rig || !ready || busy.current) return;
    busy.current = true;
    try {
      for (const [index, shot] of CINEMA_SHOTS.entries()) {
        if (shot.location !== location || (only !== undefined && index !== only)) continue;
        const count = preview ? 3 : Math.round(shot.duration * FPS);
        for (let frame = 0; frame < count && busy.current; frame++) {
          const u = preview ? frame / 2 : frame / (count - 1);
          const pose = shotPose(shot,u);
          if (pose.actor && walk.current) { const speed = pose.actor.speed; pose.actor.animate = time => walk.current?.apply(time, speed); }
          const canvas = rig.frame(pose,shot.start + u * shot.duration,preview ? 0 : 1/FPS);
          await saveFrame(canvas, `${preview ? 'preview' : 'shot'}${index}`, frame);
          if (frame % 15 === 0 || preview) setStatus(`${shot.name} · ${preview ? 'preview' : 'recording'} ${frame+1}/${count}`);
        }
      }
      setStatus(`${preview ? 'Preview' : 'Recording'} complete · ${location}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Capture failed'); }
    finally { busy.current = false; }
  }

  return <main style={{ position:'fixed',inset:0,background:'#03080e',overflow:'hidden' }}>
    <div ref={host} style={{width:'100%',height:'100%'}} />
    <style>{`canvas{width:100%!important;height:100%!important;object-fit:contain}button{padding:8px 12px;background:#163343;color:#d7f8ff;border:1px solid #367382;border-radius:5px;cursor:pointer}button:disabled{opacity:.4}`}</style>
    <aside style={{position:'absolute',top:12,left:12,padding:12,background:'#071421e8',color:'#d7f8ff',font:'12px monospace',maxWidth:700}}>
      <p role="status">{status}</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button disabled={!ready} onClick={() => void record(true)}>Preview all shots</button>
        <button disabled={!ready} onClick={() => void record(false)}>Record {location}</button>
        <button onClick={() => { busy.current = false; }}>Stop capture</button>
        <button onClick={() => { if (busy.current) return; setReady(false); setStatus('Loading scene…'); setLocation(location === 'base' ? 'expedition' : 'base'); }}>Switch to {location === 'base' ? 'expedition' : 'base'}</button>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>{CINEMA_SHOTS.map((shot,i) => shot.location === location && <button disabled={!ready} key={shot.name} onClick={() => void record(false,i)}>{shot.name}</button>)}</div>
    </aside>
  </main>;
}
