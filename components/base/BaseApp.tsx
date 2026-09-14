"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import type { BaseEngine, BaseSnapshot } from "./scene";
import type { QualityMode } from "./quality";
import { SPAWN, getBaseStations, type StationId } from "./world";
import GameHud from "../game/GameHud";
import MovementStick from "../game/MovementStick";
import styles from "./BaseApp.module.css";
import type {WorldEditor} from "../world-editor/controller";
import dynamic from "next/dynamic";
const BaseEditorPanel=dynamic(()=>import("./BaseEditorPanel"),{ssr:false});

type Quest = { accepted: boolean; visited: StationId[] };
const QUEST_KEY = "cyberbase.refuge.orientation.v1";
const EMPTY_QUEST: Quest = { accepted: false, visited: [] };
const CHECKPOINTS: StationId[] = ["smith", "metro", "stash"];
const DIALOGUE: Record<StationId, { name: string; role: string; initial: string; title: string; text: string }> = {
  expedition: { name: "OUTLANDS", role: "EXPEDITION ACCESS", initial: "EX", title: "The expedition begins beyond the wall.", text: "Explore the ruined outskirts and industrial sector. Search containers, survive encounters, and extract to secure your loot. Use WASD or click to move, Space to attack, and E to interact. Your expedition backpack is lost on defeat." },
  oracle: { name: "ORACLE", role: "CLASSES & ABILITIES", initial: "OR", title: "Choose who you become.", text: "Choose a class: Warrior, Mage, or Ranger. Each class has four combat skills. Talent upgrades will expand in a future update." },
  market: { name: "GREEN EXCHANGE", role: "CANNABIS MARKETPLACE", initial: "GE", title: "A little green in the concrete.", text: "The market is part of the refuge's economy. This is a visual display for now: trading, purchases and inventory transfers are not active." },
  charge: { name: "QUANTUM CHARGE", role: "DAILY CLAIM STATION", initial: "QC", title: "Leave your quantum charge here.", text: "This room will host the daily Claim: place your quantum charge in the dock, let it charge for 24 hours, then return to collect it. The dock is ready for a future update; placement animation, timer and rewards are not active yet." },
  smith: { name: "CYBERSMITH", role: "FABRICATION & POWER", initial: "CS", title: "Keep a little power in reserve.", text: "Out there, everything runs on borrowed energy. In here, we keep your cells alive. Bring your salvage back from the lower lines. This bench will be waiting." },
  contracts: { name: "CRYPTOMANCER", role: "CONTRACT HANDLER", initial: "CR", title: "Every runner needs a way home.", text: "Welcome to the refuge. Find the Cybersmith, check your locker, and speak to the Keeper. Learn this place before you learn what lives beneath it." },
  metro: { name: "THE KEEPER", role: "METRO WARDEN", initial: "TK", title: "The lower lines are awake.", text: "Four sectors lie beneath the refuge: the old station, service tunnels, power complex and restricted research wing. The route is open for exploration. Encounters and salvage are coming later." },
  city: { name: "CITY AIRLOCK", role: "NEON SPRAWL CONNECTION", initial: "01", title: "A whole city on the other side.", text: "The refuge connects to Neon Sprawl: traders, the Oracle, rival runners, and routes into other districts. The city connection will open in a later stage." },
  stash: { name: "PERSONAL LOCKER", role: "RUNNER STORAGE", initial: "ST", title: "Leave something worth returning for.", text: "Loot from successful expeditions is stored here. Open the inventory to review your resource reserves." },
};

function Icon({ name, size = 18 }: { name: "map" | "arrow" | "settings" | "power" | "cross" | "rain" | "home"; size?: number }) {
  const paths = {
    map: "M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5M9 3v16M15 5v16",
    arrow: "M5 12h14M13 6l6 6-6 6",
    settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
    power: "M13 2L5 14h6l-1 8 9-13h-6l1-7",
    cross: "M6 6l12 12M18 6L6 18",
    rain: "M5 14a5 5 0 0 1 0-10 6 6 0 0 1 11 2 4 4 0 0 1 2 8M8 17l-1 3M13 17l-1 3M18 17l-1 3",
    home: "M3 10l9-7 9 7M5 9v12h14V9M9 21v-8h6v8",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function BaseApp() {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null), engine = useRef<BaseEngine | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false), [, setHero] = useState("RUNNER");
  const [snapshot, setSnapshot] = useState<BaseSnapshot>({ ...SPAWN, near: null, fps: 0, p95: 0, draws: 0, triangles: 0, ratio: 1, high: false, submitMs: 0, timingLimited: false, target: 60, scale: 1 });
  const [dialog, setDialog] = useState<StationId | "wallet" | "settings" | null>(null);
  const [detail, setDetail] = useState(false), [mapOpen, setMapOpen] = useState(false);
  const [rain, setRain] = useState(true), [quality, setQuality] = useState<QualityMode>("auto"), [quest, setQuest] = useState<Quest>(EMPTY_QUEST);
  const [showStats, setShowStats] = useState(false);
  const [master,setMaster]=useState(false),[worldEditor,setWorldEditor]=useState<WorldEditor|null>(null);
  const [hideHud, setHideHud] = useState(false);
  useEffect(() => {
    const toggleHud = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "h" || event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      setHideHud((value) => !value);
    };
    window.addEventListener("keydown", toggleHud);
    return () => window.removeEventListener("keydown", toggleHud);
  }, []);
  const questRef = useRef<Quest>(EMPTY_QUEST);
  const [error, setError] = useState(""), [walletError, setWalletError] = useState(""), [storageNotice, setStorageNotice] = useState("");
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const saveQuest = useCallback((next: Quest) => {
    questRef.current = next; setQuest(next);
    try { localStorage.setItem(QUEST_KEY, JSON.stringify(next)); }
    catch { setStorageNotice("Progress lasts for this visit only; browser storage is unavailable."); }
  }, []);
  const openDialog = useCallback((id: StationId) => {
    setDetail(false); setDialog(id);
    const current = questRef.current;
    if (CHECKPOINTS.includes(id) && current.accepted && !current.visited.includes(id)) {
      saveQuest({ ...current, visited: [...current.visited, id] });
    }
  }, [saveQuest]);
  const complete = quest.accepted && CHECKPOINTS.every((id) => quest.visited.includes(id));

  useEffect(() => {
    let stopped = false;
    import("./scene").then(({ createBaseScene }) => {
      if (stopped || !host.current) return;
      try {
        const saved = JSON.parse(localStorage.getItem(QUEST_KEY) ?? "null");
        if (saved && typeof saved.accepted === "boolean" && Array.isArray(saved.visited)) {
          const restored = { accepted: saved.accepted, visited: saved.visited.filter((id: StationId) => CHECKPOINTS.includes(id)) };
          questRef.current = restored; setQuest(restored);
        }
      } catch { setStorageNotice("Local progress is unavailable in this browser."); }
      try {
        engine.current = createBaseScene(host.current, (name) => { if (!stopped) { setHero(name); setReady(true); } }, (s) => { if (!stopped) setSnapshot(s); }, openDialog, (message) => { if (!stopped) setError(message); });
        setWorldEditor(engine.current.editor);
        const motion = matchMedia("(prefers-reduced-motion: reduce)").matches;
        setRain(!motion);
        engine.current.setQuality("auto");
        setQuality("auto");
      } catch { setError("The refuge could not start WebGL. Enable hardware acceleration in your browser, then reload."); }
    }).catch(() => setError("The refuge files could not load. Check your connection and reload."));
    return () => { stopped = true; engine.current?.dispose(); engine.current = null; };
  }, [openDialog]);

  useEffect(() => {
    engine.current?.setPaused(dialog !== null);
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setDialog(null); }
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); previous?.focus({ preventScroll: true }); };
  }, [dialog]);

  const moveStick = useCallback((x: number, z: number) => engine.current?.setStick(x, z), []);
  const nearest = getBaseStations().find((s) => s.id === snapshot.near);
  const npc = dialog && dialog !== "wallet" && dialog !== "settings" ? DIALOGUE[dialog] : null;

  return <main className={`${styles.root} ${hideHud ? styles.hideHud : ""}`}>
    <button className={styles.hudToggle} onClick={() => setHideHud(!hideHud)} aria-label={hideHud ? "Show interface" : "Hide interface"}>{hideHud ? "H · Show interface" : "H · Hide interface"}</button>
    <div ref={host} className={styles.viewport} />
    <button className={styles.editorToggle} disabled={!ready} onClick={()=>{setMaster(!master);engine.current?.setMaster(!master);}}>MASTER · {master?"Закрыть":"Редактор карты"}</button>
    {master&&worldEditor&&<aside className={styles.editorPanel}><BaseEditorPanel editor={worldEditor}/></aside>}
    <div className={styles.vignette} />
    <header className={styles.header}>
      <div className={styles.headerRight}>
        <span className={styles.safe}><i /> SAFE ZONE</span>
        <button className={styles.wallet} onClick={() => { setWalletError(""); setDialog("wallet"); }}><span className={styles.baseDot} />{isConnected && address ? `${address.slice(0, 5)}…${address.slice(-4)}` : "Connect wallet"}<span>↗</span></button>
      </div>
    </header>



    <div className={styles.mapWrap}>
      <button className={styles.minimap} aria-label={mapOpen ? "Close refuge map" : "Open refuge map"} aria-expanded={mapOpen} onClick={() => setMapOpen(!mapOpen)}>
        <div className={styles.mapTitle}><span>REFUGE / 01</span><span>N ↑</span></div>
        <svg viewBox="0 0 230 125" aria-hidden="true"><path d="M146 96h45v14h-45zM191 87h29v33h-29z" fill="#244249" stroke="#78cbbb" /><path d="M14 22h132v92H14z" fill="#153034" stroke="#496562" strokeWidth="1" /><path d="M18 24h37v23H18zM61 24h36v20H61zM103 24h39v23h-39zM19 62h8v22h-8zM126 65h11v26h-11z" fill="#3e5552" /><path d="M53 61h17v7H53zM94 61h17v7H94z" fill="#736f4b" /><path d="M79 47v56M29 86h95" stroke="#33524f" strokeDasharray="2 3" />{getBaseStations().map((s) => <circle key={s.id} cx={80 + s.x * 4.8} cy={69 + s.z * 4.5} r="2" fill={s.color} />)}<circle cx={80 + snapshot.x * 4.8} cy={69 + snapshot.z * 4.5} r="4" fill="#ebd9b5" stroke="#182c2c" strokeWidth="1.5" /></svg>
        <div className={styles.mapBottom}><Icon name="map" size={12} /><span>AREA MAP</span><span>+</span></div>
      </button>
      {mapOpen && <nav className={styles.destinations} aria-label="Refuge destinations">{getBaseStations().map((s) => <button key={s.id} onClick={() => { engine.current?.goTo(s.id); setMapOpen(false); }}><span style={{ color: s.color }}>◇</span>{s.name}<span>↗</span></button>)}</nav>}
    </div>

    {!master && !dialog && nearest && ready && <button className={styles.interact} onClick={() => openDialog(nearest.id)}><kbd>E</kbd><span><small>{nearest.role}</small>Talk to {nearest.id === "city" || nearest.id === "stash" ? "terminal" : nearest.name.toLowerCase()}</span><Icon name="arrow" /></button>}

    <MovementStick onMove={moveStick} disabled={!ready || dialog !== null || master} />

    <GameHud hidden={hideHud || !ready} onSettings={() => setDialog("settings")} onQuest={() => openDialog("contracts")} />
    {showStats && <div className={styles.performance} aria-label="Live graphics performance"><strong>{snapshot.fps} FPS{snapshot.timingLimited ? "*" : ""}</strong><span>{snapshot.p95} ms p95 · {snapshot.high ? "HIGH" : "LITE"}</span><span>{snapshot.submitMs} ms CPU submit</span><span>{snapshot.draws} draws · {Math.round(snapshot.triangles / 1000)}k triangles</span><span>DPR {snapshot.ratio.toFixed(2)} · scale {snapshot.scale.toFixed(2)}</span><span>Target {snapshot.target} FPS · {quality.toUpperCase()}</span>{snapshot.timingLimited && <span>* Possible browser timer limit</span>}</div>}

    {!ready && <div className={styles.loading}><div className={styles.loadingMark}>C ◈ B</div><span className={styles.eyebrow}>ESTABLISHING REFUGE LINK</span><h2>A light left on for you.</h2><div className={styles.loadLine} /><p>{error || "Preparing the district…"}</p>{error && <button onClick={() => location.reload()}>Reload refuge</button>}</div>}
    {storageNotice && <div className={styles.error} role="status">{storageNotice}</div>}
    {ready && error && <div className={styles.error} role="status">{error}<button onClick={() => setError("")} aria-label="Dismiss notice">×</button></div>}

    {dialog && <div className={`${styles.scrim} ${npc ? styles.npcScrim : ""}`} onPointerDown={(e) => { if (e.target === e.currentTarget) setDialog(null); }}>
      <div ref={dialogRef} className={`${styles.dialog} ${npc ? styles.npcDialog : ""}`} role="dialog" aria-modal="true" aria-labelledby="base-dialog-title">
        <div className={styles.dialogTop}><span className={styles.eyebrow}>{npc ? "LOCAL CHANNEL / CONNECTED" : "REFUGE SYSTEMS"}</span><button onClick={() => setDialog(null)} aria-label="Close dialog"><Icon name="cross" /></button></div>
        {npc && <><div className={styles.portrait} aria-hidden="true"><span>{npc.initial}</span></div><div className={styles.speaker}><div><span className={styles.eyebrow}>{npc.role}</span><h2 id="base-dialog-title">{npc.name}</h2></div><i /></div>
          <div className={styles.speech}><h3>{detail && dialog === "smith" ? "One cell. Twenty-four hours." : npc.title}</h3><p>{detail && dialog === "smith" ? "The daily routine will start here: bring a battery, place it in the charging dock, and return after a 24-hour cycle. The station is being commissioned. Charging, timers, and rewards are not active yet." : npc.text}</p></div>
          <div className={styles.choices}>
            {dialog === "contracts" && !quest.accepted && <button className={styles.primaryChoice} onClick={() => { saveQuest({ accepted: true, visited: [] }); setDialog(null); }}><span><strong>Get to know the refuge</strong><small>Visit three contacts · Local exploration quest</small></span><Icon name="arrow" /></button>}
            {dialog === "contracts" && quest.accepted && <div className={styles.questChecklist}>{CHECKPOINTS.map((id) => <p key={id}><span>{quest.visited.includes(id) ? "✓" : "◇"}</span>{getBaseStations().find((s) => s.id === id)?.name}</p>)}<small>{complete ? "Orientation complete. No token reward is attached to this introduction." : "Speak to each contact to complete your introduction."}</small></div>}
            {dialog === "charge" && <button className={styles.primaryChoice} disabled><span><strong>Place quantum charge · Daily Claim</strong><small>24-hour cycle · Coming in a future update</small></span></button>}
            {dialog === "metro" && <button onClick={() => router.push("/metro")}><span><strong>Descend to Cyber Metro</strong><small>Explore the frozen environment prototype</small></span><span>↓</span></button>}
            {dialog === "expedition" && <button onClick={() => router.push("/expedition")}><span><strong>Start expedition</strong><small>Outskirts → Industrial → Extraction</small></span><span>→</span></button>}
            {dialog === "city" && <button disabled><span><strong>Enter Neon Sprawl</strong><small>Airlock connection under construction</small></span><span>⌁</span></button>}
            {(dialog === "stash" || dialog === "oracle") && <button onClick={() => { const panel = dialog === "stash" ? "Inventory" : "Talent Tree"; setDialog(null); window.dispatchEvent(new CustomEvent("netrunner:panel", {detail: panel})); }}><span><strong>{dialog === "stash" ? "Open inventory" : "Choose class"}</strong></span><Icon name="arrow" /></button>}
            <button onClick={() => setDialog(null)}><span>Back to the refuge</span><span>ESC ↵</span></button>
          </div>
        </>}
        {dialog === "wallet" && <><h2 id="base-dialog-title">Your identity on Base.</h2><p className={styles.modalCopy}>Explore freely as a guest, or connect your existing wallet. Connecting does not charge a fee or sign a transaction. Refuge quests currently stay in this browser.</p>
          {isConnected && address ? <div className={styles.walletInfo}><span>CONNECTED WALLET</span><code>{address}</code><p>{chainId === 8453 ? "Base network" : "Wallet connected on another network. No transaction is required."}</p><button onClick={() => disconnect()}>Disconnect wallet</button></div> : <div className={styles.choices}>{connectors.map((connector) => <button key={connector.uid} disabled={isPending} onClick={async () => { setWalletError(""); try { await connectAsync({ connector }); } catch { setWalletError("Connection was cancelled or unavailable. You can try again or keep exploring as a guest."); } }}><span>{connector.name}</span><span>{isPending ? "…" : "↗"}</span></button>)}{!connectors.length && <p>No wallet connector is available. Continue as a guest.</p>}</div>}
          {walletError && <p className={styles.notice} role="alert">{walletError}</p>}
        </>}
        {dialog === "settings" && <><h2 id="base-dialog-title">Make yourself comfortable.</h2><div className={styles.settingRows}>
          <button onClick={() => { setRain(!rain); engine.current?.setRain(!rain); }} aria-pressed={rain}><span>Rain particles</span><strong>{rain ? "ON" : "OFF"}</strong></button>
          <button onClick={() => { const next = quality === "auto" ? "high" : quality === "high" ? "lite" : "auto"; setQuality(next); engine.current?.setQuality(next); }}><span>Graphics quality</span><strong>{quality.toUpperCase()} · {snapshot.high ? "HIGH" : "LITE"}</strong></button>
          <button onClick={() => setShowStats(!showStats)} aria-pressed={showStats}><span>Live performance display</span><strong>{showStats ? "ON" : "OFF"}</strong></button>
          <button onClick={() => engine.current?.resetCamera()}><span>Reset camera</span><span>↺</span></button>
          <button onClick={() => router.push("/")}><span>Return to hub</span><span>↩</span></button>
        </div><p className={styles.modalCopy}>Auto reduces reflections and render resolution if this device stays below the target frame rate. Lite keeps the scanned materials and environment lighting. High adds live puddle reflections and bloom.</p><p className={styles.modalCopy}>WASD / arrows to move, Shift to run. The fixed-angle camera follows your movement. On a phone, use the thumbstick and Talk button.</p><div className={styles.diagnostics}>THREE.JS <span>{snapshot.fps} FPS · {snapshot.p95} ms p95 · {snapshot.draws} draws</span></div><p className={styles.notice}>{snapshot.submitMs} ms CPU submission (not GPU time). {snapshot.timingLimited ? "Possible browser timer limit: measure in a foreground browser before judging performance." : "Measure on your target phone; desktop results are not a mobile guarantee."}</p></>}
      </div>
    </div>}
  </main>;
}
