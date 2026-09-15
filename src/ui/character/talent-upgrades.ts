// Talent modules shown in the Ability Matrix (UI kit test, branch feature/ui-kit-3d).
//
// Names and percentages are proposed content: combat does not read them yet. Each module changes
// one number the 3D skill really has (components/game/combat.ts), so the effect line can print
// the outcome, e.g. "+16% DAMAGE · 38 → 44". Three modules per skill slot, per class.

export type TalentClassId = "warrior" | "mage" | "ranger";
export type TalentStat = "damage" | "cooldown" | "cost" | "range" | "radius" | "heal";

export interface TalentUpgrade {
  label: string;
  description: string;
  stat: TalentStat;
  /** Percent per rank. */
  value: number;
}

export interface TalentSkillNumbers {
  cost: number;
  cooldown: number;
  damage: number;
  range: number;
  heal?: number;
}

type Modules = readonly [TalentUpgrade, TalentUpgrade, TalentUpgrade];

const m = (label: string, description: string, stat: TalentStat, value: number): TalentUpgrade => ({
  label,
  description,
  stat,
  value,
});

export const CLASS_ROLES: Readonly<Record<TalentClassId, string>> = {
  warrior: "MELEE · AREA",
  mage: "RANGED · CONTROL",
  ranger: "RANGED · PRECISION",
};

export const TALENT_UPGRADES: Readonly<Record<TalentClassId, readonly Modules[]>> = {
  warrior: [
    [m("Servo Drive", "Faster recovery between strikes.", "cooldown", 3), m("Monoblade Edge", "Heavier downward slash.", "damage", 8), m("Long Reach", "The blade connects from further away.", "range", 6)],
    [m("Wide Spectrum", "The combo sweeps a wider arc.", "radius", 8), m("Efficient Motor", "The combo draws less energy.", "cost", 7), m("Execution Code", "The finishing slash hits harder.", "damage", 10)],
    [m("Payload", "More damage inside the rift.", "damage", 10), m("Blast Mapping", "The rift opens wider.", "radius", 7), m("Phase Capacitor", "The rift recharges sooner.", "cooldown", 5)],
    [m("Hardened Shell", "Restores more health.", "heal", 6), m("Feedback Loop", "Costs less energy.", "cost", 8), m("Fast Patch", "Ready again sooner.", "cooldown", 5)],
  ],
  mage: [
    [m("Overvoltage", "Each pulse hits harder.", "damage", 8), m("Long Trace", "Pulses travel further.", "range", 7), m("Quick Cycle", "Shorter pause between pulses.", "cooldown", 3)],
    [m("Neural Lance", "The spike hits harder.", "damage", 10), m("Low Latency", "The spike recharges sooner.", "cooldown", 5), m("Deep Scan", "The spike reaches further.", "range", 8)],
    [m("Wide Band", "The wave covers a larger area.", "radius", 7), m("Burnout", "The wave hits harder.", "damage", 12), m("Daemon Loop", "The wave draws less energy.", "cost", 8)],
    [m("Persistent Daemon", "Restores more health.", "heal", 6), m("Firewall Cache", "Costs less energy.", "cost", 8), m("Hot Reload", "Ready again sooner.", "cooldown", 5)],
  ],
  ranger: [
    [m("High-Caliber", "Each shot hits harder.", "damage", 8), m("Killer Optics", "Shots reach further.", "range", 7), m("Light Servos", "Shorter pause between shots.", "cooldown", 3)],
    [m("Armor Breach", "The round hits harder.", "damage", 10), m("Smart Rounds", "Costs less energy.", "cost", 7), m("Target Router", "The round reaches further.", "range", 8)],
    [m("Payload", "The blast hits harder.", "damage", 10), m("Blast Mapping", "The blast covers a larger area.", "radius", 7), m("Charge Coil", "Ready again sooner.", "cooldown", 5)],
    [m("Field Medic", "Restores more health.", "heal", 6), m("Compact Case", "Costs less energy.", "cost", 8), m("Auto-Injector", "Ready again sooner.", "cooldown", 5)],
  ],
};

const STAT_LABEL: Readonly<Record<TalentStat, string>> = {
  damage: "DAMAGE",
  cooldown: "COOLDOWN",
  cost: "ENERGY COST",
  range: "RANGE",
  radius: "RADIUS",
  heal: "HEALING",
};

/** Stats that go down when the module improves them. */
const LOWER_IS_BETTER: ReadonlySet<TalentStat> = new Set(["cooldown", "cost"]);

function baseValue(skill: TalentSkillNumbers, stat: TalentStat): number | null {
  if (stat === "damage") return skill.damage;
  if (stat === "cooldown") return skill.cooldown;
  if (stat === "cost") return skill.cost;
  if (stat === "range") return skill.range;
  if (stat === "heal") return skill.heal ?? null;
  return null;
}

function format(stat: TalentStat, value: number): string {
  if (stat === "cooldown") return `${value.toFixed(2)} s`;
  if (stat === "range") return `${value.toFixed(1)} m`;
  return String(Math.round(value));
}

/** The effect line prints the outcome, not the rank. */
export function talentEffect(skill: TalentSkillNumbers, upgrade: TalentUpgrade, rank: number): string {
  const lower = LOWER_IS_BETTER.has(upgrade.stat);
  const sign = lower ? "−" : "+";
  const label = STAT_LABEL[upgrade.stat];
  if (rank <= 0) return `${sign}${upgrade.value}% ${label} PER RANK`;
  const percent = rank * upgrade.value;
  const line = `${sign}${percent}% ${label}`;
  const base = baseValue(skill, upgrade.stat);
  if (base === null) return line;
  const next = base * (1 + ((lower ? -1 : 1) * percent) / 100);
  return `${line} · ${format(upgrade.stat, base)} → ${format(upgrade.stat, next)}`;
}
