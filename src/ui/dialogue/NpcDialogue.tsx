"use client";

// NPC conversation from the CyberBase 2D UI kit, adapted for the 3D world: the window docks to
// the bottom of the view so the refuge stays visible. The speaker holds the left column in their
// zone colour; words and numbered choices sit on the right. Keys 1–9 pick a choice, 0 always leaves.

import { useEffect, type CSSProperties, type ReactNode, type Ref } from "react";
import kit from "../kit/kit.module.css";
import s from "./NpcDialogue.module.css";

export interface DialogueChoice {
  id: string;
  label: string;
  /** States the consequence, e.g. "BACKPACK AT RISK". */
  hint: string;
  primary?: boolean;
  /** When set, the choice stays visible under the hatch and this reason replaces the hint. */
  locked?: string;
  onSelect(): void;
}

export interface DialogueChecklistItem {
  label: string;
  done: boolean;
}

export interface NpcDialogueProps {
  containerRef?: Ref<HTMLDivElement>;
  titleId: string;
  name: string;
  role: string;
  initials: string;
  status: string;
  channel: string;
  /** CSS colour of the speaker's zone, e.g. "var(--cb-z-smith)". */
  accent: string;
  /** The first line is the heading. */
  lines: readonly string[];
  choices: readonly DialogueChoice[];
  exit: { label: string; hint: string; onSelect(): void };
  checklist?: readonly DialogueChecklistItem[];
  checklistNote?: string;
  onDismiss(): void;
  children?: ReactNode;
}

export default function NpcDialogue({
  containerRef,
  titleId,
  name,
  role,
  initials,
  status,
  channel,
  accent,
  lines,
  choices,
  exit,
  checklist,
  checklistNote,
  onDismiss,
  children,
}: NpcDialogueProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "0") {
        event.preventDefault();
        exit.onSelect();
        return;
      }
      if (!/^[1-9]$/.test(event.key)) return;
      const choice = choices[Number(event.key) - 1];
      if (!choice) return;
      event.preventDefault();
      if (!choice.locked) choice.onSelect();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, exit]);

  return (
    <div
      className={`${kit.kit} ${s.layer}`}
      style={{ "--acc": accent } as CSSProperties}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div ref={containerRef} className={`${kit.cut} ${s.dialog}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <aside className={s.portrait}>
          <span className={s.status}>
            <i />
            {status}
          </span>
          <span className={s.halo} aria-hidden="true" />
          <span className={s.initials} aria-hidden="true">{initials}</span>
          <span className={s.speaker}>
            <small>{role}</small>
            <strong id={titleId}>{name}</strong>
          </span>
        </aside>

        <div className={s.copy}>
          <span className={s.channel}>PRIVATE CHANNEL // {channel}</span>
          <div className={s.lines}>
            {lines.map((line, index) => <p key={index}>{line}</p>)}
          </div>

          {checklist && (
            <div className={s.checklist}>
              {checklist.map((item) => (
                <p key={item.label} data-done={item.done ? "" : undefined}>
                  <span aria-hidden="true">{item.done ? "✓" : "◇"}</span>
                  {item.label}
                </p>
              ))}
              {checklistNote && <small>{checklistNote}</small>}
            </div>
          )}
          {children}

          <div className={s.choices}>
            {choices.map((choice, index) => (
              <button
                key={choice.id}
                type="button"
                className={`${kit.cut} ${s.choice}`}
                data-primary={choice.primary ? "" : undefined}
                data-locked={choice.locked ? "" : undefined}
                aria-disabled={choice.locked ? true : undefined}
                onClick={() => {
                  if (!choice.locked) choice.onSelect();
                }}
              >
                <i className={s.number}>{index + 1}</i>
                <span>{choice.label}</span>
                <small>{choice.locked ?? choice.hint}</small>
              </button>
            ))}
          </div>

          <button type="button" className={s.exit} onClick={exit.onSelect}>
            <i className={s.number}>0</i>
            <span>{exit.label}</span>
            <small>{exit.hint}</small>
          </button>
        </div>
      </div>
    </div>
  );
}
