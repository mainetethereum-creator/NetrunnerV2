'use client';

import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {ASSET_URLS} from '../../assets/registry.ts';
import {WAKE_UP_MS, assetLabel, loadingStage, loadingTarget, pacedPercent} from './loading-model.ts';
import styles from './LoadingScreen.module.css';

// Scene loading screen (ADR-021): a pixel helmet wakes up in the dark while real files load, its red
// eyes breathe and blink, and when the scene is ready the eyes close and the screen dissolves.
// Animation runs on CSS variables from one requestAnimationFrame loop, so React does not re-render
// per frame, and the loop stops as soon as the screen is gone.

interface LoadingScreenProps {
  /** true once the scene can be shown. */
  ready: boolean;
  /** Short status line, e.g. "Establishing refuge link". */
  status: string;
  /** Shown instead of the file line, with a reload button. */
  error?: string;
  retryLabel?: string;
}

const MIN_VISIBLE_MS = 900;
const EXIT_MS = 1150;

export default function LoadingScreen({ready, status, error = '', retryLabel = 'Reload'}: LoadingScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const assetRef = useRef<HTMLSpanElement>(null);
  const filesRef = useRef<HTMLSpanElement>(null);
  const readyRef = useRef(ready);
  const [exiting, setExiting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    let counts = {url: '', loaded: 0, total: 0};
    let unsubscribe = () => {};
    let cancelled = false;
    import('../../renderer/three/loading-progress.ts')
      .then(({watchLoadingProgress}) => {
        if (!cancelled) unsubscribe = watchLoadingProgress((progress) => { counts = progress; });
      })
      .catch(() => {});

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startedAt = performance.now();
    let last = startedAt;
    let target = 0;
    let shown = 0;
    let flicker = 1;
    let flickerAt = 0;
    let nextBlink = 0;
    let blinkStart = -1;
    let exitAt = -1;
    let exitingSet = false;
    let lastNumber = -1;
    let lastAsset = '';
    let lastFiles = '';
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const elapsed = now - startedAt;
      const isReady = readyRef.current && elapsed >= MIN_VISIBLE_MS;

      target = loadingTarget({loaded: counts.loaded, total: counts.total, ready: isReady, elapsedMs: elapsed}, target);
      // While everything requested is done but the scene is still building, keep a slow crawl.
      if (!isReady && shown >= target - 0.05 && target < 95) target = Math.min(95, target + dt * 0.8);
      shown += (target - shown) * Math.min(1, dt * (isReady ? 7 : 3));
      shown = pacedPercent(shown, elapsed);
      if (isReady && elapsed >= WAKE_UP_MS && 100 - shown < 0.4) shown = 100;
      const percent = shown;

      let lit = 1;
      let scan = -20;
      let scanOn = 0;
      let glow = 0;
      let flare = 0;
      let open = 1;
      const stage = loadingStage(percent);

      if (stage === 'void') {
        lit = 0.07 + (percent / 12) * 0.05;
      } else if (stage === 'awaken') {
        const ramp = (percent - 12) / 13;
        lit = 0.12 + ramp * 0.88;
        if (!still) {
          scan = ramp * 120 - 10;
          scanOn = Math.sin(Math.PI * ramp);
          if (now > flickerAt) {
            flicker = Math.random() < 0.35 ? 0.1 + Math.random() * 0.3 : 0.8 + Math.random() * 0.2;
            flickerAt = now + 40 + Math.random() * 90;
          }
        }
        const eyeRamp = Math.max(0, Math.min(1, (ramp - 0.45) / 0.55));
        glow = still ? eyeRamp : eyeRamp * flicker;
      } else {
        glow = still ? 1 : 0.86 + 0.14 * Math.sin(now / 850);
      }
      if (percent >= 90) flare = (percent - 90) / 10;

      if (!still && exitAt < 0 && (stage === 'watch' || stage === 'lock')) {
        if (!nextBlink) nextBlink = now + 1300 + Math.random() * 1500;
        if (now >= nextBlink) {
          blinkStart = now;
          nextBlink = now + 2600 + Math.random() * 2400;
        }
        if (blinkStart >= 0) {
          const t = (now - blinkStart) / 190;
          if (t <= 1) open = 1 - 0.94 * Math.sin(Math.PI * t);
        }
      }

      if (isReady && percent >= 100 && exitAt < 0) exitAt = now;
      if (exitAt >= 0) {
        const e = now - exitAt;
        flare = 1;
        glow = 1;
        if (e > 250) {
          open = still ? 1 : Math.max(0.06, 1 - (e - 250) / 150);
          glow = Math.max(0, 1 - (e - 250) / 300);
        }
        if (e > 420 && !exitingSet) {
          exitingSet = true;
          setExiting(true);
        }
        if (e > EXIT_MS) {
          setDone(true);
          return;
        }
      }

      const s = element.style;
      s.setProperty('--lit', lit.toFixed(3));
      s.setProperty('--scan', `${scan.toFixed(2)}%`);
      s.setProperty('--scan-on', scanOn.toFixed(3));
      s.setProperty('--glow', glow.toFixed(3));
      s.setProperty('--flare', flare.toFixed(3));
      s.setProperty('--open', open.toFixed(3));
      s.setProperty('--float', `${still ? 0 : (Math.sin(now / 1400) * 0.6).toFixed(3)}vmin`);
      s.setProperty('--scale', (0.94 + 0.08 * (percent / 100)).toFixed(4));
      s.setProperty('--p', (percent / 100).toFixed(4));

      const whole = Math.floor(percent);
      if (whole !== lastNumber) {
        lastNumber = whole;
        if (numberRef.current) numberRef.current.textContent = String(whole);
        barRef.current?.setAttribute('aria-valuenow', String(whole));
      }
      const asset = counts.url ? assetLabel(counts.url) : 'Downloading game code';
      if (asset !== lastAsset && assetRef.current) {
        lastAsset = asset;
        assetRef.current.textContent = asset;
      }
      const files = counts.total ? `${Math.min(counts.loaded, counts.total)} / ${counts.total} files` : '';
      if (files !== lastFiles && filesRef.current) {
        lastFiles = files;
        filesRef.current.textContent = files;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, []);

  if (done) return null;

  const layers = {
    '--helmet': `url(${ASSET_URLS.ui.loading.helmet})`,
    '--eyes': `url(${ASSET_URLS.ui.loading.eyes})`,
  } as CSSProperties;

  return (
    <div ref={root} className={`${styles.root} ${exiting ? styles.exiting : ''}`} style={layers} aria-busy={!exiting}>
      <div className={`${styles.layer} ${styles.fog}`} />
      <div className={`${styles.layer} ${styles.spill}`} />
      <div className={styles.helmet} aria-hidden="true">
        <span className={styles.base} />
        <span className={styles.scan} />
        <span className={styles.bloom} />
        <span className={styles.eyes} />
      </div>
      <div className={`${styles.layer} ${styles.vignette}`} />
      <span className={styles.brand}>CYBERBASE</span>
      <p className={styles.status}>{status}</p>
      <div className={styles.hud}>
        <div className={styles.row}>
          <span className={styles.label}>Loading<span className={styles.dots} aria-hidden="true">...</span></span>
          <span className={styles.percent}><span ref={numberRef} className={styles.number}>0</span><small>%</small></span>
        </div>
        <div ref={barRef} className={styles.bar} role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
          <i />
        </div>
        {error ? (
          <div className={styles.errorRow} role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => location.reload()}>{retryLabel}</button>
          </div>
        ) : (
          <div className={`${styles.row} ${styles.meta}`}>
            <span ref={assetRef} className={styles.asset}>Downloading game code</span>
            <span ref={filesRef} className={styles.files} />
          </div>
        )}
      </div>
    </div>
  );
}
