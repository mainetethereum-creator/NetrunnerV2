"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import type { BaseEngine, BaseSnapshot } from "./scene";
import type { QualityMode } from "./quality";
import { SPAWN, getBaseStations, BASE_NORTH, LIMIT, type StationId } from "./world";
import { SAKURA_PARK } from "../../src/renderer/environment/sakura-park-layout.ts";
import { EAST_DISTRICT } from "../../src/renderer/environment/east-district-layout.ts";
import GameHud from "../game/GameHud";
import MovementStick from "../game/MovementStick";
import LoadingScreen from "../../src/ui/loading/LoadingScreen";
import NpcDialogue, { type DialogueChoice } from "../../src/ui/dialogue/NpcDialogue";
import styles from "./BaseApp.module.css";
import type {WorldEditor} from "../world-editor/controller";
import dynamic from "next/dynamic";
// Development tools (MASTER editor) are compiled out of production builds (ADR-019, next.config.ts).
const DEV_TOOLS = process.env.CYBERBASE_DEV_TOOLS === "1";
const BaseEditorPanel=dynamic(()=>import("./BaseEditorPanel"),{ssr:false});

const MAP_WIDTH = 230;
const MAP_HEIGHT = 150;
const MAP_PADDING = 9;
const MAP_SCALE = Math.min(
  (MAP_WIDTH - MAP_PADDING * 2) / (LIMIT.x + EAST_DISTRICT.east),
  (MAP_HEIGHT - MAP_PADDING * 2) / (SAKURA_PARK.south - BASE_NORTH),
);
const mapX = (x: number) => MAP_WIDTH / 2 + (x-(EAST_DISTRICT.east-LIMIT.x)/2) * MAP_SCALE;
const mapY = (z: number) => MAP_PADDING + (z - BASE_NORTH) * MAP_SCALE;

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
// CyberBase UI kit zone colours (src/ui/kit/kit.module.css) and channel status per station.
const STATION_KIT: Record<StationId, { accent: string; status: string }> = {
  expedition: { accent: "var(--cb-z-outlands)", status: "BREACH OPEN" },
  oracle: { accent: "var(--cb-z-oracle)", status: "NEURAL LINK STABLE" },
  market: { accent: "var(--cb-z-market)", status: "STALLS CLOSED" },
  charge: { accent: "var(--cb-z-charge)", status: "DOCK IDLE" },
  smith: { accent: "var(--cb-z-smith)", status: "BENCH ONLINE" },
  contracts: { accent: "var(--cb-z-contracts)", status: "CHANNEL ENCRYPTED" },
  metro: { accent: "var(--cb-z-metro)", status: "SHAFT LINK ONLINE" },
  city: { accent: "var(--cb-z-city)", status: "AIRLOCK SEALED" },
  stash: { accent: "var(--cb-z-stash)", status: "LOCKER SEALED" },
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
  const [sceneVersion, setSceneVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<BaseSnapshot>({ ...SPAWN, near: null, fps: 0, p95: 0, draws: 0, triangles: 0, ratio: 1, high: false, submitMs: 0, timingLimited: false, target: 60, scale: 1, cameraMode: 'follow' });
  const [dialog, setDialog] = useState<StationId | "wallet" | "settings" | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [rain, setRain] = useState(true), [quality, setQuality] = useState<QualityMode>("auto"), [quest, setQuest] = useState<Quest>(EMPTY_QUEST);
  const [traffic, setTraffic] = useState(false);
  const [ambient,setAmbient]=useState(false);
  const [showStats, setShowStats] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
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
    setDialog(id);
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
      setReady(false);
      setError("");
      setSceneVersion(version => version + 1);
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
        setAmbient(false);
        const motion = matchMedia("(prefers-reduced-motion: reduce)").matches;
        let rainEnabled = !motion;
        try {
          const savedRain=localStorage.getItem("cyberbase.base.rain.v1");
          if(savedRain==="true" || savedRain==="false") rainEnabled=savedRain==="true";
        } catch { /* Keep the system motion preference. */ }
        setRain(rainEnabled);engine.current.setRain(rainEnabled);
        let trafficEnabled = !motion;
        try {
          const savedTraffic = localStorage.getItem("cyberbase.base.traffic.v1");
          if (savedTraffic === "true" || savedTraffic === "false") trafficEnabled = savedTraffic === "true";
        } catch { /* The system motion preference remains the session default. */ }
        setTraffic(trafficEnabled);
        engine.current.setTraffic(trafficEnabled);
        engine.current.setQuality("auto");
        setQuality("auto");
      } catch { setError("The refuge could not start WebGL. Enable hardware acceleration in your browser, then reload."); }
    }).catch(() => setError("The refuge files could not load. Check your connection and reload."));
    return () => { stopped = true; engine.current?.dispose(); engine.current = null; };
  }, [openDialog]);

  // Fast Refresh can recreate the scene while React retains the open MASTER panel.
  useEffect(() => {
    if (DEV_TOOLS && worldEditor) engine.current?.setMaster(master);
  }, [master, worldEditor]);

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
  const openPanel = (panel: "Inventory" | "Talent Tree") => { setDialog(null); window.dispatchEvent(new CustomEvent("netrunner:panel", { detail: panel })); };
  // Numbered choices per station; every choice states its consequence in the hint.
  const npcChoices = (id: StationId): DialogueChoice[] => {
    switch (id) {
      case "contracts": return quest.accepted ? [] : [{ id: "orientation", label: "Get to know the refuge", hint: "VISIT THREE CONTACTS", primary: true, onSelect: () => { saveQuest({ accepted: true, visited: [] }); setDialog(null); } }];
      case "charge": return [{ id: "claim", label: "Place quantum charge", hint: "DAILY CLAIM · 24 H", locked: "COMING IN A FUTURE UPDATE", onSelect: () => {} }];
      case "metro": return [{ id: "metro", label: "Descend to Cyber Metro", hint: "FROZEN PROTOTYPE", primary: true, onSelect: () => router.push("/metro") }];
      case "expedition": return [{ id: "expedition", label: "Start expedition", hint: "BACKPACK AT RISK", primary: true, onSelect: () => router.push("/expedition") }];
      case "city": return [{ id: "city", label: "Enter Neon Sprawl", hint: "CITY CONNECTION", locked: "AIRLOCK UNDER CONSTRUCTION", onSelect: () => {} }];
      case "stash": return [{ id: "inventory", label: "Open inventory", hint: "LOCKER · LOADOUT", primary: true, onSelect: () => openPanel("Inventory") }];
      case "oracle": return [{ id: "talents", label: "Open the ability matrix", hint: "CLASS · TALENTS", primary: true, onSelect: () => openPanel("Talent Tree") }];
      case "smith": return [{ id: "fabricate", label: "Fabricate gear", hint: "FABRICATION", locked: "NOT ACTIVE YET", onSelect: () => {} }, { id: "loadout", label: "Check my loadout", hint: "OPENS INVENTORY", onSelect: () => openPanel("Inventory") }];
      case "market": return [{ id: "trade", label: "Browse the exchange", hint: "TRADING", locked: "NOT ACTIVE YET", onSelect: () => {} }];
    }
  };

  return <main className={`${styles.root} ${hideHud ? styles.hideHud : ""}`}>
    <button className={styles.hudToggle} onClick={() => setHideHud(!hideHud)} aria-label={hideHud ? "Show interface" : "Hide interface"}>{hideHud ? "H · Show interface" : "H · Hide interface"}</button>
    <div ref={host} className={styles.viewport} />
    {ready && !dialog && <div className={styles.cameraControl}>
      <button className={styles.cameraToggle} aria-label={cameraOpen ? "Закрыть настройки камеры" : "Открыть настройки камеры"} aria-expanded={cameraOpen} onClick={()=>setCameraOpen(value=>!value)}>◉</button>
      {cameraOpen && <section className={styles.cameraPanel} aria-label="Настройка камеры">
      <div className={styles.cameraPanelTop}><strong>КАМЕРА</strong><button aria-label="Закрыть настройки камеры" onClick={()=>setCameraOpen(false)}>×</button></div>
      {snapshot.cameraMode !== 'free' ? <button onClick={()=>{setMaster(false);engine.current?.setMaster(false);engine.current?.frameCamera();}}>Камера · {snapshot.cameraMode === 'fixed' ? 'Изменить кадр' : 'Выбрать кадр'}</button> : <>
        <strong>Свободная камера</strong>
        <p>ЛКМ — вращать · ПКМ — сдвигать<br/>Колесо или кнопки − / + — масштаб<br/>На экране: один палец — вращение, два — масштаб и сдвиг.</p>
        <div className={styles.cameraZoom} aria-label="Масштаб камеры">
          <button aria-label="Отдалить камеру" title="Отдалить камеру" onClick={()=>engine.current?.zoomCamera(4)}>−</button>
          <span>МАСШТАБ</span>
          <button aria-label="Приблизить камеру" title="Приблизить камеру" onClick={()=>engine.current?.zoomCamera(-4)}>+</button>
        </div>
        <button onClick={()=>{if(engine.current&&!engine.current.fixCamera())setStorageNotice('Кадр зафиксирован на эту сессию; сохранение в браузере недоступно.');}}>Зафиксировать кадр</button>
      </>}
      {snapshot.cameraMode !== 'follow' && <button onClick={()=>engine.current?.resetCamera()}>Стандартный ракурс</button>}
      {snapshot.cameraMode === 'fixed' && <button onClick={()=>{
        if(engine.current?.saveCameraPreset2())setStorageNotice('Ракурс «V2» сохранён.');
        else setStorageNotice('Не удалось сохранить ракурс «V2» в браузере.');
      }}>Сохранить как V2</button>}
      {snapshot.cameraMode !== 'free' && <button onClick={()=>{
        if(engine.current?.restoreCameraPreset2())setStorageNotice('');
        else setStorageNotice('Ракурс «V2» пока недоступен. Сначала сохраните текущий кадр.');
      }}>V2</button>}
      {snapshot.cameraMode !== 'free' && <button onClick={()=>{
        engine.current?.gamePov();setStorageNotice('Game POV · игровой ракурс');
      }}>Game POV</button>}
      {snapshot.cameraMode === 'fixed' && <small role="status">Ракурс сохранён · следуем за героем</small>}
      </section>}
    </div>}
    {DEV_TOOLS && <button className={styles.editorToggle} disabled={!ready} onClick={()=>{setMaster(!master);engine.current?.setMaster(!master);}}>MASTER · {master?"Закрыть":"Редактор карты"}</button>}
    {DEV_TOOLS&&master&&worldEditor&&ready&&<aside className={styles.editorPanel}><BaseEditorPanel editor={worldEditor}/></aside>}
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
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-hidden="true">
          <rect x={mapX(-LIMIT.x)} y={mapY(BASE_NORTH)} width={LIMIT.x * MAP_SCALE * 2} height={(LIMIT.z-BASE_NORTH)*MAP_SCALE} fill="#153034" stroke="#496562" strokeWidth="1" />
          <rect x={mapX(-LIMIT.x)} y={mapY(LIMIT.z)} width={LIMIT.x*MAP_SCALE*2} height={(SAKURA_PARK.south-LIMIT.z)*MAP_SCALE} fill="#243b31" stroke="#496562" strokeWidth="1" />
          <ellipse cx={mapX(SAKURA_PARK.fountainX)} cy={mapY(SAKURA_PARK.fountainZ)} rx={5*MAP_SCALE} ry={4*MAP_SCALE} fill="#32636b" />
          <rect x={mapX(EAST_DISTRICT.west)} y={mapY(EAST_DISTRICT.north)} width={(EAST_DISTRICT.east-EAST_DISTRICT.west)*MAP_SCALE} height={(EAST_DISTRICT.south-EAST_DISTRICT.north)*MAP_SCALE} fill="#2b3933" stroke="#736f4b" strokeWidth="1" />
          <path d={`M${mapX(-14.8)} ${mapY(11.35)}H${mapX(14.8)}`} stroke="#736f4b" strokeWidth="3" />
          {getBaseStations().map((s) => <circle key={s.id} cx={mapX(s.x)} cy={mapY(s.z)} r="2.4" fill={s.color} />)}
          <circle cx={mapX(snapshot.x)} cy={mapY(snapshot.z)} r="4" fill="#ebd9b5" stroke="#182c2c" strokeWidth="1.5" />
        </svg>
        <div className={styles.mapBottom}><Icon name="map" size={12} /><span>AREA MAP</span><span>+</span></div>
      </button>
      <div className={styles.cameraHint}>WASD · WALK / SHIFT · RUN</div>
      {mapOpen && <nav className={styles.destinations} aria-label="Refuge destinations">{getBaseStations().map((s) => <button key={s.id} onClick={() => { engine.current?.goTo(s.id); setMapOpen(false); }}><span style={{ color: s.color }}>◇</span>{s.name}<span>↗</span></button>)}</nav>}
    </div>

    {!master && snapshot.cameraMode !== 'free' && !dialog && nearest && ready && <button className={styles.interact} onClick={() => openDialog(nearest.id)}><kbd>E</kbd><span><small>{nearest.role}</small>Talk to {nearest.id === "city" || nearest.id === "stash" ? "terminal" : nearest.name.toLowerCase()}</span><Icon name="arrow" /></button>}

    <MovementStick onMove={moveStick} disabled={!ready || dialog !== null || master || snapshot.cameraMode === 'free'} />

    <GameHud hidden={hideHud || !ready} onSettings={() => setDialog("settings")} onQuest={() => openDialog("contracts")} />
    {ready && <output className={styles.fpsBadge} aria-label={`Частота кадров ${snapshot.fps} FPS`}>{snapshot.fps}<small>FPS</small></output>}
    {showStats && <div className={styles.performance} aria-label="Live graphics performance"><strong>{snapshot.fps} FPS{snapshot.timingLimited ? "*" : ""}</strong><span>{snapshot.p95} ms p95 · {snapshot.high ? "HIGH" : "LITE"}</span><span>{snapshot.submitMs} ms CPU submit</span><span>{snapshot.draws} draws · {Math.round(snapshot.triangles / 1000)}k triangles</span><span>DPR {snapshot.ratio.toFixed(2)} · scale {snapshot.scale.toFixed(2)}</span><span>Target {snapshot.target} FPS · {quality.toUpperCase()}</span>{snapshot.timingLimited && <span>* Possible browser timer limit</span>}</div>}

    <LoadingScreen ready={ready} key={sceneVersion} status="Establishing refuge link" error={ready ? "" : error} retryLabel="Reload refuge" />
    {storageNotice && <div className={styles.error} role="status">{storageNotice}</div>}
    {ready && error && <div className={styles.error} role="status">{error}<button onClick={() => setError("")} aria-label="Dismiss notice">×</button></div>}

    {npc && dialog && dialog !== "wallet" && dialog !== "settings" && <NpcDialogue
      containerRef={dialogRef}
      titleId="base-dialog-title"
      name={npc.name}
      role={npc.role}
      initials={npc.initial}
      status={STATION_KIT[dialog].status}
      channel={`${dialog.toUpperCase()}-CHANNEL`}
      accent={STATION_KIT[dialog].accent}
      lines={[npc.title, npc.text]}
      choices={npcChoices(dialog)}
      checklist={dialog === "contracts" && quest.accepted ? CHECKPOINTS.map((id) => ({ label: getBaseStations().find((s) => s.id === id)?.name ?? id, done: quest.visited.includes(id) })) : undefined}
      checklistNote={complete ? "Orientation complete. No token reward is attached to this introduction." : "Speak to each contact to complete your introduction."}
      exit={{ label: "Back to the refuge", hint: "ESC", onSelect: () => setDialog(null) }}
      onDismiss={() => setDialog(null)}
    />}

    {(dialog === "wallet" || dialog === "settings") && <div className={styles.scrim} onPointerDown={(e) => { if (e.target === e.currentTarget) setDialog(null); }}>
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="base-dialog-title">
        <div className={styles.dialogTop}><span className={styles.eyebrow}>REFUGE SYSTEMS</span><button onClick={() => setDialog(null)} aria-label="Close dialog"><Icon name="cross" /></button></div>
        {dialog === "wallet" && <><h2 id="base-dialog-title">Your identity on Base.</h2><p className={styles.modalCopy}>Explore freely as a guest, or connect your existing wallet. Connecting does not charge a fee or sign a transaction. Refuge quests currently stay in this browser.</p>
          {isConnected && address ? <div className={styles.walletInfo}><span>CONNECTED WALLET</span><code>{address}</code><p>{chainId === 8453 ? "Base network" : "Wallet connected on another network. No transaction is required."}</p><button onClick={() => disconnect()}>Disconnect wallet</button></div> : <div className={styles.choices}>{connectors.map((connector) => <button key={connector.uid} disabled={isPending} onClick={async () => { setWalletError(""); try { await connectAsync({ connector }); } catch { setWalletError("Connection was cancelled or unavailable. You can try again or keep exploring as a guest."); } }}><span>{connector.name}</span><span>{isPending ? "…" : "↗"}</span></button>)}{!connectors.length && <p>No wallet connector is available. Continue as a guest.</p>}</div>}
          {walletError && <p className={styles.notice} role="alert">{walletError}</p>}
        </>}
        {dialog === "settings" && <><h2 id="base-dialog-title">Make yourself comfortable.</h2><div className={styles.settingRows}>
          <button onClick={() => {
            setRain(!rain); engine.current?.setRain(!rain);
            try {localStorage.setItem("cyberbase.base.rain.v1",String(!rain));} catch { /* Session preference still works. */ }
          }} aria-pressed={rain}><span>Rain particles</span><strong>{rain ? "ON" : "OFF"}</strong></button>
          <button onClick={() => {
            const enabled = !traffic;
            setTraffic(enabled); engine.current?.setTraffic(enabled);
            try { localStorage.setItem("cyberbase.base.traffic.v1", String(enabled)); }
            catch { setStorageNotice("Traffic preference lasts for this visit only; browser storage is unavailable."); }
          }} aria-pressed={traffic}><span>Park deliveries</span><strong>{traffic ? "ON" : "OFF"}</strong></button>
          <button onClick={async()=>{const enabled=await engine.current?.setAmbient(!ambient);setAmbient(!!enabled);}} aria-pressed={ambient}><span>Garden ambience</span><strong>{ambient ? "ON" : "OFF"}</strong></button>
          <button onClick={() => { const next = quality === "auto" ? "high" : quality === "high" ? "lite" : "auto"; setQuality(next); engine.current?.setQuality(next); }}><span>Graphics quality</span><strong>{quality.toUpperCase()} · {snapshot.high ? "HIGH" : "LITE"}</strong></button>
          <button onClick={() => setShowStats(!showStats)} aria-pressed={showStats}><span>Live performance display</span><strong>{showStats ? "ON" : "OFF"}</strong></button>
          <button onClick={() => engine.current?.resetCamera()}><span>Reset camera</span><span>↺</span></button>
          <button onClick={() => router.push("/")}><span>Return to hub</span><span>↩</span></button>
        </div><p className={styles.modalCopy}>Auto reduces reflections and render resolution if this device stays below the target frame rate. Lite keeps the scanned materials and environment lighting. High adds live puddle reflections and bloom.</p><p className={styles.modalCopy}>Tactical camera follows your character. WASD / arrows and the thumbstick move relative to the view; Shift runs. Physical WASD also works with the Russian layout (ЦФЫВ), including after using HUD buttons. A short tap still sets a destination.</p><div className={styles.diagnostics}>THREE.JS <span>{snapshot.fps} FPS · {snapshot.p95} ms p95 · {snapshot.draws} draws</span></div><p className={styles.notice}>{snapshot.submitMs} ms CPU submission (not GPU time). {snapshot.timingLimited ? "Possible browser timer limit: measure in a foreground browser before judging performance." : "Measure on your target phone; desktop results are not a mobile guarantee."}</p></>}
      </div>
    </div>}
  </main>;
}
