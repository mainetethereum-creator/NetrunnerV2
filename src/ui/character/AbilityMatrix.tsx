"use client";

// Ability Matrix from the CyberBase UI kit: not a web — one column per skill, three modules that
// gate top to bottom, rank pips instead of numbers, an effect line that prints the outcome, and
// locked modules that keep their name and say exactly why they are locked.

import { useState, type CSSProperties } from "react";
import kit from "../kit/kit.module.css";
import s from "./character.module.css";
import { Glyph } from "../kit/Glyph.tsx";
import { talentEffect, type TalentClassId, type TalentUpgrade } from "./talent-upgrades.ts";

export interface MatrixSkill {
  name: string;
  icon: string;
  cost: number;
  cooldown: number;
  damage: number;
  range: number;
  heal?: number;
}

export interface MatrixClass {
  id: TalentClassId;
  name: string;
  role: string;
}

export interface AbilityMatrixProps {
  classId: TalentClassId;
  classes: readonly MatrixClass[];
  skills: readonly MatrixSkill[];
  upgrades: readonly (readonly TalentUpgrade[])[];
  maxRank: number;
  /** Rank the module above needs before the next one opens. */
  requiredRank: number;
  budget: number;
  pointsLeft: number;
  rank(slot: number, tier: number): number;
  blockReason(slot: number, tier: number): string | null;
  onInvest(slot: number, tier: number): void;
  classLocked: boolean;
  onSelectClass(id: TalentClassId): void;
}

const classColor = (id: TalentClassId) => ({ "--class": `var(--cb-c-${id})` }) as CSSProperties;

export default function AbilityMatrix(props: AbilityMatrixProps) {
  const [openSlot, setOpenSlot] = useState(0);

  return (
    <div className={s.matrix} style={classColor(props.classId)}>
      <div className={s.matrixHead}>
        <div className={s.classPick} role="group" aria-label="Combat class">
          {props.classes.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`${kit.cut} ${s.classCard}`}
              style={classColor(option.id)}
              aria-pressed={option.id === props.classId}
              disabled={props.classLocked && option.id !== props.classId}
              onClick={() => props.onSelectClass(option.id)}
            >
              <strong>{option.name}</strong>
              <small>{option.role}</small>
            </button>
          ))}
        </div>
        <p className={s.note}>
          {props.classLocked ? "Wait until every cooldown is ready to switch class." : "Switch class whenever your cooldowns are ready."}
        </p>
        <div className={s.bank}>
          <b className={kit.num}>
            {props.pointsLeft} / {props.budget}
          </b>
          <small>SKILL POINTS LEFT</small>
        </div>
      </div>

      <div className={s.slotTabs} role="tablist" aria-label="Skills">
        {props.skills.map((skill, slot) => (
          <button
            key={skill.name}
            type="button"
            role="tab"
            aria-selected={openSlot === slot}
            className={`${kit.cut} ${kit.btn} ${kit.btnSm}`}
            onClick={() => setOpenSlot(slot)}
          >
            {slot + 1} · {skill.name}
          </button>
        ))}
      </div>

      <div className={s.branches}>
        {props.skills.map((skill, slot) => (
          <section key={skill.name} className={s.branch} data-open={openSlot === slot ? "" : undefined} aria-label={`${skill.name} modules`}>
            <header className={`${kit.cut} ${s.branchRoot}`}>
              <Glyph name={skill.icon} />
              <b>{skill.name}</b>
              <small className={kit.num}>
                SLOT {slot + 1} · {skill.cost} EN · {skill.cooldown} S · {skill.heal ? `${skill.heal} HEAL` : `${skill.damage} DMG`}
              </small>
            </header>

            {props.upgrades[slot].map((upgrade, tier) => {
              const rank = props.rank(slot, tier);
              const reason = props.blockReason(slot, tier);
              const state = rank >= props.maxRank ? "maxed" : rank > 0 ? "owned" : reason ? "locked" : "open";
              const linked = tier === 0 || props.rank(slot, tier - 1) >= props.requiredRank;
              return (
                <div key={upgrade.label} className={s.step}>
                  <span className={s.link} data-on={linked ? "" : undefined} aria-hidden="true" />
                  <button
                    type="button"
                    className={`${kit.cut} ${s.node}`}
                    data-state={state}
                    aria-disabled={reason ? true : undefined}
                    aria-label={`${upgrade.label}, rank ${rank} of ${props.maxRank}. ${reason ?? "Invest 1 skill point"}`}
                    onClick={() => {
                      if (!reason) props.onInvest(slot, tier);
                    }}
                  >
                    <span className={s.nodeTop}>
                      <b>{upgrade.label}</b>
                      <span className={kit.num}>0{tier + 1}</span>
                    </span>
                    <span className={s.nodeText}>{upgrade.description}</span>
                    <span className={s.effect} data-zero={rank ? undefined : ""}>
                      {talentEffect(skill, upgrade, rank)}
                    </span>
                    <span className={s.rank}>
                      <span className={kit.pips}>
                        {Array.from({ length: props.maxRank }, (_, index) => (
                          <i key={index} data-on={index < rank ? "" : undefined} />
                        ))}
                      </span>
                      <small className={kit.num}>
                        {rank}/{props.maxRank}
                      </small>
                    </span>
                    <span className={s.why}>{reason ?? "INVEST 1 SP"}</span>
                  </button>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
