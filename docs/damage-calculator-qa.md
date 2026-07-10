# Damage Calculator Contract and QA

This is the single process reference for damage-calculator changes. Keep it short and stable: put executable rules in tests or the audit, and do not add run-specific counts, resolved bug logs, or a standing backlog here.

## Modeling contract

- Game mechanics come from the committed Season tables (`Skills.txt`, `Missiles.txt`, `SkillDesc.txt`, `MonStats.txt`, `ItemStatCost.txt`, and `Properties.txt`). Flat elemental item damage should use raw modifier expansion; rendered item text is its compatibility fallback.
- A profile total has one explicit unit, such as per hit, projectile, charge release, weapon cycle, summon hit, pulse, or second. Hit chance, attack/cast rate, target count, overlap, AI, and uptime are excluded unless the scope says otherwise.
- Server skill missile fields and server missile child fields are authoritative. Client-only child missiles are visual effects and must not enter totals without server evidence.
- Martial Arts release profiles include every payload from charge 1 through the selected charge. Charge payloads from other skills are excluded.
- Direct attack payloads are instant damage. Poison and source-backed stream/ground effects remain damage over time.
- Gear poison is shown as an excluded component. It is not folded into combined totals because exact poison rate/length stacking cannot be derived safely from the available item payload. Skill and aura poison remain modeled when their source duration is known.
- Detected item/mercenary auras and allocated castable buffs initialize the same removable selection rows used for manual choices; base profiles contain no hidden aura contribution. Same-name sources use the highest automatic level, and a user-selected level overrides it only when higher.
- Corpse life, target current life, compiled server-function behavior, and other missing runtime inputs must be explicitly excluded or scoped. Do not invent a precise value.
- Summon results are per source-backed summon hit. Pet count, attack cadence, AI choice, hit chance, and uptime are excluded.

## Source hierarchy and boundaries

- `Skills.txt` is authoritative for skill parameters, source-damage flags, direct damage, synergies, aura/passive formulas, and server missile roots.
- `Missiles.txt` is authoritative for missile damage and server-reachable child payloads. `SkillDesc.txt` is display evidence, not combat authority.
- `MonStats.txt` supplies stable summon attack ranges when the summoned skill graph does not expose a better source.
- `Properties.txt` expands item property codes into concrete stats; `ItemStatCost.txt` defines those stats and their operators. Raw armory modifiers take precedence over rendered property labels.
- Armory weapon ranges are the weapon source. `Armor.txt`, applied during armory enrichment, supplies missing boot-kick ranges.
- Formula tables do not describe every engine behavior. Opaque `srvstfunc`, `srvdofunc`, event hooks, target state, rounding, or ProjectD2 binary hooks require verified tests or an explicit exclusion.

Flat elemental item damage follows this path:

```text
raw modifier/property -> Properties.txt expansion -> concrete item stats -> damage component -> skill/aura scaling
```

Do not add character-specific exceptions when this source path can express the mechanic. Do not preserve local installation paths, binary hashes, one-off investigation notes, or extracted table catalogs in repo documentation; versioned game tables, tests, and source references are the durable evidence.

## Required workflow

1. Trace the affected path through the calculator and relevant game-table rows. For missile skills, follow the complete server-reachable child graph.
2. Classify each material mechanic as modeled, explicitly scoped, or unavailable from committed data.
3. Add the narrowest test that fails for the defect. Shared parsing, timing, compatibility, component aggregation, and scope changes require cross-skill coverage.
4. Run the fast gate from `api`:

   ```bash
   npm run damage:qa
   ```

5. If output shape, totals, source evidence, or scope changed, refresh stored expectations and run the regression test:

   ```bash
   npm run damage:snapshot:refresh
   npx jest --runInBand src/utils/damage-regression-snapshot.test.ts --no-forceExit
   ```

6. Run the reproducible stress pass for shared calculator or transformation changes:

   ```bash
   npm run damage:stress
   ```

7. Run the full API suite. For UI/type changes, also run web lint and build.

   ```bash
   npm test -- --runInBand --no-forceExit
   cd ../web
   npm run lint
   npm run build
   ```

Use `npm run damage:snapshot` only when live popularity, candidate selection, or fixture coverage must be regenerated. Normal calculator work should use the offline `damage:snapshot:refresh`, which recalculates the committed raw character payloads without a database.

## Automated gates

`npm run damage:audit` writes its detailed report to `.codex-local/damage-outlier-audit.json` and fails on any error or warning. It checks:

- finite, ordered totals and component-to-total agreement;
- direct attack timing;
- weapon type and melee/missile range compatibility;
- unsupported blank-`SrcDam` weapon inference;
- generic scope on multi-payload profiles;
- count-bearing, periodic, and corpse-target semantics across every modeled in-game player skill;
- unsupported damage formula/property paths;
- client-only missile rows appearing in rendered component evidence;
- required multi-variant snapshot coverage.

`npm run damage:stress` recalculates each unique raw character in the committed snapshot, validates every generated profile, and independently checks physical rescaling across every eligible transformation level. Its summary is written to `.codex-local/damage-stress-summary.json`.

The committed regression snapshot is an empirical cross-build corpus, not the definition of mechanic completeness. Table-derived audit rules and targeted tests cover mechanics that are absent from popular live builds.

## Severity and follow-up

- `error`: impossible output or a definite model violation. Blocking.
- `warn`: plausible but materially misleading or incomplete modeled output. Blocking until fixed or deliberately removed from the modeled surface.
- `info`: do not use informational findings as a permanent queue. Encode actionable risk as a warning/error or keep deliberate exclusions in profile notes and tests.

When a mechanic cannot be resolved, record the exact table evidence, current scope, missing runtime input, and proposed test in the issue or task that owns the follow-up. Avoid adding another repo document for transient review state.
