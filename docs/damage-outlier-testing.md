# Damage Outlier Testing

This document defines the common-sense damage outliers that should be flagged beyond pass/fail regression tests. The audit entrypoint is:

```bash
npx ts-node src/scripts/audit-damage-outliers.ts
```

The script compares the regression fixture against the current calculator and the Season 13 game tables, then writes a detailed local report to `.codex-local/damage-outlier-audit.json`.

For the repeatable per-skill QA workflow, agent prompt template, debug-session handoff format, and current missing-mechanic seed backlog, see [`damage-mechanic-qa-process.md`](./damage-mechanic-qa-process.md).

## Severity Model

Use these levels for debug triage:

- `error`: impossible or internally inconsistent calculator output. These should block damage-calculator changes.
- `warn`: plausible calculator/modeling defect or incomplete mechanic that can materially skew a modeled damage profile. These should become focused debug-session candidates.
- `info`: known coverage gap, deliberately excluded mechanic, or source-table risk that should stay visible but should not block normal calculator work.

## Outlier Definitions

Core arithmetic:

- `TOTAL-INVARIANT` is an error when total damage is non-finite, negative, or has `max < min`.
- `TOTAL-COMPONENT-MISMATCH` is an error when summed component averages do not match the saved total average.

Weapon and source selection:

- `WPN-COMPAT` is an error when a weapon profile conflicts with `Skills.txt` `itypea*` requirements, such as a bow-only, claw-only, thrown-only, or shield-only skill using the wrong source.
- `SRC-DAM-FALLBACK` is a warning when a weapon component exists for a skill row with blank `SrcDam`; that usually means the calculator inferred source damage instead of the table authorizing it.

Damage scope and units:

- Projectile, nova, and missile skills should say whether totals are per projectile, per target hit, or per modeled payload.
- Stream and ground-fire skills should be scoped as per-second damage when the calculator applies per-frame or stream scaling.
- Charge/stack skills should expose concrete charge or stack outputs in the damage panel, not averaged dropdown entries or sustained DPS values.
- Summons should be scoped as per summon hit, with summon count, AI, attack rate, hit chance, and uptime excluded.
- Aura pulse damage should be displayed separately from hit damage and should remain aggregated when multiple selected aura rows are active.
- Any multi-payload missile profile with a generic `per target hit` label is a warning until the scope explains which payloads are included.
- Mechanic-specific gaps should use the `MECH-*` rule codes from the QA process doc, including counted projectiles, chain/bounce behavior, periodic repeats, stack variants, target inputs, summon uptime, aura pulse damage, dedupe risk, and compiled-behavior gaps.

Formula coverage:

- Unsupported `ulvl` in damage-like summon formulas is a warning because pet level can affect monster-level behavior and may change summon damage once that mechanic is modeled.
- Unsupported `edln` is currently informational when it appears in duration, client display, heal, attack rating, or velocity contexts. It should become a warning if a future damage total depends on it.
- Supported aliases currently include direct `lnNN`, `dmNN`, `skill('X'.lnNN)`, and `skill('X'.dmNN)` formula references.

Item stat expansion:

- Flat elemental damage must come from expanded stat data, not rendered item text.
- Supported `Properties.txt` funcs for simple item stat expansion are `1`, `3`, `15`, `16`, and `17`.
- Unsupported property funcs are informational unless they represent flat always-on damage for the current modeled hit. Proc skills, charged skills, class-skill grants, per-time stats, monster-type damage, and event hooks should remain separate until their trigger conditions are modeled.
- Raw poison item stats are expanded into the stat ledger, but poison item damage is not treated as a simple flat elemental range because poison rate/length stacking needs separate mechanics.

Missile graph:

- Damage traversal should start from server skill missile columns and follow server child columns only: `ExplosionMissile`, `SubMissile1..3`, and `HitSubMissile1..4`.
- Client-only missile children such as `lightninghit`, `firesmall`, `firemedium`, and client meteor fragments are informational risks. They should stay excluded from damage totals unless server evidence proves otherwise.

Snapshot coverage:

- Popular modeled skills that fail fixture qualification are informational coverage gaps.
- Missing variants for a modeled multi-variant skill are warnings. As of the latest audit, `Raise Skeletal Mage` only has lightning-mage fixture coverage and still needs fire, cold, and poison samples.

## Current Debug Queue

Latest local audit after the calculator fixes reports:

```text
errors: 0
warnings: 11
info: 157
```

Remaining warnings:

- `Raise Skeletal Mage` fixture variant coverage: only the lightning mage variant is present.
- `ulvl` pet-level formulas for `Raven`, `Plague Poppy`, `Oak Sage`, `Summon Spirit Wolf`, `Cycle of Life`, `Heart of Wolverine`, `Summon Fenris`, `Vines`, `Spirit of Barbs`, and `Summon Grizzly`.

These are not pass/fail regressions yet because the calculator does not currently model pet-level behavior from compiled summon logic.
