"use client";

// Character panel shell from the CyberBase UI kit: header with the runner, tabs for the loadout
// and the Oracle's ability matrix, and a footer with the draft notice. Content comes as children.

import type { CSSProperties, ReactNode, Ref } from "react";
import kit from "../kit/kit.module.css";
import s from "./character.module.css";

export type RunnerTab = "inventory" | "talents";

export interface RunnerPanelProps {
  panelRef?: Ref<HTMLDivElement>;
  tab: RunnerTab;
  onTab(tab: RunnerTab): void;
  onClose(): void;
  runnerName: string;
  className: string;
  level: number;
  unsecured: number;
  talentPoints: number;
  notice: string;
  onReset(): void;
  children: ReactNode;
}

export default function RunnerPanel({
  panelRef,
  tab,
  onTab,
  onClose,
  runnerName,
  className,
  level,
  unsecured,
  talentPoints,
  notice,
  onReset,
  children,
}: RunnerPanelProps) {
  const talents = tab === "talents";

  return (
    <div
      ref={panelRef}
      className={`${kit.kit} ${kit.cut} ${s.panel}`}
      style={{ "--pa": talents ? "var(--cb-z-oracle)" : "var(--cb-ink)" } as CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-labelledby="runner-panel-title"
    >
      <header className={s.panelHead}>
        <h2 id="runner-panel-title">{talents ? "Oracle" : "Loadout"}</h2>
        <span className={s.panelSub}>
          {runnerName} · {className.toUpperCase()} · LV {String(level).padStart(2, "0")}
        </span>
        {unsecured > 0 && (
          <span className={kit.chip} style={{ "--c": "var(--cb-blood)" } as CSSProperties}>
            {unsecured} UNSECURED
          </span>
        )}
        <span className={s.spacer} />
        <nav className={s.tabs} aria-label="Character sections">
          <button type="button" className={`${kit.cut} ${kit.btn} ${kit.btnSm}`} aria-pressed={!talents} onClick={() => onTab("inventory")}>
            01 · Loadout
          </button>
          <button type="button" className={`${kit.cut} ${kit.btn} ${kit.btnSm}`} aria-pressed={talents} onClick={() => onTab("talents")}>
            02 · Ability matrix <b className={kit.num}>{talentPoints}</b>
          </button>
        </nav>
        <button type="button" className={`${kit.cut} ${kit.btn} ${kit.btnSm} ${kit.btnGhost}`} onClick={onClose} aria-label="Close">
          Esc
        </button>
      </header>

      <div className={s.panelBody}>{children}</div>

      <footer className={s.panelFoot}>
        <span role="status">{notice || "Training draft · saved in this browser · combat and loot stay unchanged"}</span>
        <span className={s.spacer} />
        <button type="button" className={`${kit.cut} ${kit.btn} ${kit.btnSm} ${kit.btnGhost}`} onClick={onReset}>
          Reset draft
        </button>
        <span className={s.keys}>I · ESC — CLOSE</span>
      </footer>
    </div>
  );
}
