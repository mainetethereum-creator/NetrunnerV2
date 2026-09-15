"use client";

// Loadout from the CyberBase UI kit. Three columns, always in this order: what you are wearing,
// what you are carrying, what it adds up to. Rarity colours the border and the name, never the
// whole tile. Anything not extracted is marked UNSECURED.

import { useState, type CSSProperties } from "react";
import kit from "../kit/kit.module.css";
import s from "./character.module.css";
import { Glyph } from "../kit/Glyph.tsx";

export interface LoadoutItem {
  id: string;
  name: string;
  rarity: string;
  icon: string;
  count: number;
  kind: "gear" | "loot";
  slot?: string;
  equipped?: boolean;
  unsecured?: boolean;
}

export interface LoadoutAttribute {
  name: string;
  hint: string;
  value: number;
}

export interface LoadoutProps {
  runnerName: string;
  className: string;
  level: number;
  avatarUrl: string;
  frameUrl: string;
  hp: number;
  energy: number;
  gear: readonly LoadoutItem[];
  locker: readonly LoadoutItem[];
  backpack: readonly LoadoutItem[];
  lockerSlots: number;
  attributes: readonly LoadoutAttribute[];
  attributePoints: number;
  onAddAttribute(index: number): void;
  selectedId: string | null;
  onSelect(id: string): void;
  onToggleEquip(id: string): void;
  stats: readonly (readonly [string, string])[];
}

type View = "wearing" | "carrying" | "total";
type Source = "locker" | "backpack";
type Filter = "all" | "gear" | "loot";
type Sort = "type" | "rarity" | "name";

const RARITY_ORDER = ["COMMON", "UNCOMMON", "RARE", "EPIC"];
const rarityVar = (rarity: string) => ({ "--r": `var(--cb-rarity-${rarity.toLowerCase()}, var(--cb-ink-2))` }) as CSSProperties;
const count = (items: readonly LoadoutItem[]) => items.reduce((sum, item) => sum + item.count, 0);

export default function Loadout(props: LoadoutProps) {
  const [view, setView] = useState<View>("carrying");
  const [source, setSource] = useState<Source>("locker");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("type");

  const pool = source === "backpack" ? props.backpack : [...props.gear, ...props.locker];
  const visible = pool
    .filter((item) => source === "backpack" || filter === "all" || item.kind === filter)
    .sort((a, b) => {
      if (sort === "rarity") return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
      if (sort === "name") return a.name.localeCompare(b.name, "en");
      return Number(b.kind === "gear") - Number(a.kind === "gear");
    });
  const slots = source === "backpack" ? Math.max(12, visible.length) : props.lockerSlots;
  const selected = [...props.gear, ...props.locker, ...props.backpack].find((item) => item.id === props.selectedId) ?? null;

  return (
    <div className={s.loadout}>
      <div className={s.viewTabs} role="tablist" aria-label="Loadout columns">
        {(
          [
            ["wearing", "Wearing"],
            ["carrying", "Carrying"],
            ["total", "Adds up to"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={`${kit.cut} ${kit.btn} ${kit.btnSm}`} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className={s.columns}>
        {/* ── wearing ── */}
        <section className={s.column} data-open={view === "wearing" ? "" : undefined} aria-label="Wearing">
          <div className={s.identity}>
            <div className={s.frame} style={{ backgroundImage: `url(${props.frameUrl})` }}>
              <i style={{ backgroundImage: `url(${props.avatarUrl})` }} />
            </div>
            <div>
              <strong>{props.runnerName}</strong>
              <small>
                {props.className.toUpperCase()} · LEVEL {props.level}
              </small>
              <div className={s.vital}>
                <span>HP</span>
                <div className={kit.bar} style={{ "--c": "var(--cb-s-hp)" } as CSSProperties}>
                  <i style={{ "--v": `${Math.max(0, Math.min(100, props.hp))}%` } as CSSProperties} />
                </div>
                <output className={kit.num}>{Math.ceil(props.hp)}</output>
              </div>
              <div className={s.vital}>
                <span>EN</span>
                <div className={kit.bar} style={{ "--c": "var(--cb-s-en)" } as CSSProperties}>
                  <i style={{ "--v": `${Math.max(0, Math.min(100, props.energy))}%` } as CSSProperties} />
                </div>
                <output className={kit.num}>{Math.floor(props.energy)}</output>
              </div>
            </div>
          </div>

          <div className={s.heading}>
            <h3>Equipped</h3>
            <small className={kit.num}>{props.gear.filter((item) => item.equipped).length} / {props.gear.length}</small>
          </div>
          {props.gear.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${kit.cut} ${s.slot}`}
              style={item.equipped ? rarityVar(item.rarity) : undefined}
              data-empty={item.equipped ? undefined : ""}
              aria-pressed={props.selectedId === item.id}
              onClick={() => {
                props.onSelect(item.id);
                setSource("locker");
                setView("carrying");
              }}
            >
              <Glyph name={item.equipped ? item.icon : "spark"} />
              <span>
                <small>{item.slot?.toUpperCase()}</small>
                <b>{item.equipped ? item.name : "Empty"}</b>
              </span>
              <small>{item.equipped ? item.rarity : ""}</small>
            </button>
          ))}

          <div className={s.heading}>
            <h3>Attributes</h3>
            <small className={kit.num}>{props.attributePoints} AP</small>
          </div>
          {props.attributes.map((attribute, index) => (
            <div key={attribute.name} className={s.attribute}>
              <div>
                <b>{attribute.name}</b>
                <small>{attribute.hint}</small>
              </div>
              <output className={kit.num}>{attribute.value}</output>
              <button
                type="button"
                className={`${kit.cut} ${kit.btn} ${kit.btnSm}`}
                disabled={!props.attributePoints}
                aria-label={`Add a point to ${attribute.name}`}
                onClick={() => props.onAddAttribute(index)}
              >
                +
              </button>
            </div>
          ))}
        </section>

        {/* ── carrying ── */}
        <section className={s.column} data-open={view === "carrying" ? "" : undefined} aria-label="Carrying">
          <div className={s.heading}>
            <h3>Carrying</h3>
            <div className={s.sources}>
              <button type="button" className={`${kit.cut} ${kit.btn} ${kit.btnSm}`} aria-pressed={source === "locker"} onClick={() => setSource("locker")}>
                Locker · {count(props.locker)}
              </button>
              <button type="button" className={`${kit.cut} ${kit.btn} ${kit.btnSm}`} aria-pressed={source === "backpack"} onClick={() => setSource("backpack")}>
                Backpack · {count(props.backpack)}
              </button>
            </div>
          </div>

          {source === "backpack" ? (
            <p className={s.note}>
              <b className={s.risk}>UNSECURED</b> — lost on defeat. Extract to move it to your locker.
            </p>
          ) : (
            <div className={s.toolbar}>
              {(
                [
                  ["all", "All"],
                  ["gear", "Gear"],
                  ["loot", "Resources"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={`${kit.cut} ${kit.btn} ${kit.btnSm} ${kit.btnGhost}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
              <label className={s.sort}>
                Sort
                <select aria-label="Inventory sorting" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                  <option value="type">Type</option>
                  <option value="rarity">Rarity</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>
          )}

          <div className={s.grid}>
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${kit.cut} ${s.cell}`}
                style={rarityVar(item.rarity)}
                aria-pressed={props.selectedId === item.id}
                aria-label={`${item.name}, ${item.rarity}, ${item.kind === "gear" ? (item.equipped ? "equipped" : "gear") : `×${item.count}`}`}
                onClick={() => props.onSelect(item.id)}
              >
                {item.unsecured && <i className={s.unsecured} />}
                <Glyph name={item.icon} />
                <small>{item.name}</small>
                <b className={kit.num}>{item.kind === "gear" ? (item.equipped ? "E" : "") : `×${item.count}`}</b>
              </button>
            ))}
            {Array.from({ length: Math.max(0, slots - visible.length) }, (_, index) => (
              <div key={`empty-${index}`} className={`${kit.cut} ${s.cell}`} data-void="" aria-hidden="true">
                <span>{String(visible.length + index + 1).padStart(2, "0")}</span>
              </div>
            ))}
          </div>
          {!visible.length && <p className={s.note}>Nothing here yet · find resources in the Outlands and extract.</p>}

          <div className={`${kit.cut} ${s.inspect}`} style={selected ? rarityVar(selected.rarity) : undefined} aria-live="polite">
            {selected ? (
              <>
                <small>
                  {selected.rarity} · {selected.kind === "gear" ? selected.slot?.toUpperCase() : selected.unsecured ? "BACKPACK" : "LOCKER"}
                </small>
                <h4>
                  {selected.name}
                  {selected.kind === "loot" ? ` ×${selected.count}` : ""}
                </h4>
                <p className={selected.unsecured ? s.risk : undefined}>
                  {selected.kind === "gear"
                    ? "Preview gear. Combat bonuses are not applied yet."
                    : selected.unsecured
                      ? "Unsecured — lost on defeat. Extract to keep it."
                      : "Secured in the refuge after a successful extraction."}
                </p>
                {selected.kind === "gear" && (
                  <div>
                    <button
                      type="button"
                      className={`${kit.cut} ${kit.btn} ${kit.btnSm} ${selected.equipped ? kit.btnGhost : kit.btnPrimary}`}
                      onClick={() => props.onToggleEquip(selected.id)}
                    >
                      {selected.equipped ? "Unequip" : "Equip"} {selected.slot?.toLowerCase()}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p>Select an item to inspect it.</p>
            )}
          </div>
        </section>

        {/* ── adds up to ── */}
        <section className={s.column} data-open={view === "total" ? "" : undefined} aria-label="Adds up to">
          <div className={s.heading}>
            <h3>Combat · live</h3>
            <small>{props.className.toUpperCase()}</small>
          </div>
          <dl className={s.stats}>
            {props.stats.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className={kit.num}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className={s.heading}>
            <h3>Bank</h3>
            <small>SAFE FROM DEFEAT</small>
          </div>
          <dl className={s.stats}>
            <div>
              <dt>Locker items</dt>
              <dd className={kit.num}>{count(props.locker)}</dd>
            </div>
            <div className={s.risk}>
              <dt>At risk this run</dt>
              <dd className={kit.num}>{count(props.backpack)}</dd>
            </div>
          </dl>
          <p className={s.note}>Attribute and gear bonuses are not applied to combat yet — the numbers above are the live values of your class.</p>
        </section>
      </div>
    </div>
  );
}
