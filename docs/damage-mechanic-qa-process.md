# Damage Mechanic QA Process

Use this process when damage work touches a skill, item-stat path, missile traversal, scope label, regression fixture, or any game-file formula. The goal is to catch outputs that pass ordinary tests but are common-sense outliers because the skill's real mechanic is variable, conditional, multi-hit, target-dependent, or only partly modeled.

## Success Criteria

A damage change is QA-complete only when all of these are true:

- The relevant game-file mechanics have been identified from `Skills.txt`, `Missiles.txt`, `SkillDesc.txt`, `MonStats.txt`, `ItemStatCost.txt`, and `Properties.txt` as applicable.
- Each affected skill is classified as captured, intentionally scoped, or an unresolved mechanic gap.
- Any unresolved gap has a concrete outlier rule, severity, evidence, and debug-session candidate.
- Calculator changes include targeted tests for the modeled behavior and common-sense tests for outlier behavior.
- The audit script and regression snapshot agree with the new expected scope, or the snapshot diff is explained.
- The audit has zero `error` findings. Known `warn` findings may remain only when they are listed in `docs/damage-outlier-testing.md` or a debug-session handoff.

## Definitions

Captured mechanic:

- The calculator directly models the mechanic, such as Martial Arts charge variants, Maul stack variants, aura pulse output, or two-weapon sequence profiles.
- The calculator explicitly scopes the mechanic, such as per-bolt, per-projectile, per-second, per-summon hit, per-charge, per-stack, or per-weapon-cycle output.
- The calculator explicitly excludes the mechanic and documents why, such as client-only missile children.

Uncaptured mechanic:

- A game-file formula or server function exposes extra hits, projectiles, stacks, charges, chain jumps, bounces, periodic ticks, target HP, corpse HP, pet count, AI, uptime, or conditional state that is not represented by profile variants, totals, scope labels, or notes.

Common-sense outlier:

- Output that is internally valid but misleading for the mechanic. Examples: a chain skill shown as one target hit without chain count, a periodic storm shown as one impact without tick frequency, a corpse skill shown as fixed damage without corpse HP input, or repeated server missiles deduped into one payload.

## Iterative Loop

Run this loop for every skill group affected by a damage change.

1. Inventory candidates.
   - Scan `Skills.txt` for player skills with damage-like columns: `SrcDam`, `MinDam`, `MaxDam`, `EType`, `EMin`, `EMax`, `srvmissile*`, `summon`, `pettype`, `sumskill*`, `calc*`, `prgcalc*`, `periodic`, `auraevent*`, `auratgtevent*`, `TargetCorpse`, `weapsel`, and `seqnum`.
   - Scan `Missiles.txt` for damage-bearing root and child missiles: `MinDamage`, `MaxDamage`, `EType`, `EMin`, `Emax`, `DmgSymPerCalc`, `EDmgSymPerCalc`, `ExplosionMissile`, `SubMissile*`, and `HitSubMissile*`.
   - Scan item-stat tables when item damage can affect the skill: `ItemStatCost.txt`, `Properties.txt`, item affix tables, runes, sets, and uniques.

2. Exclude already captured mechanics.
   - Exclude skills in `SKILL_DAMAGE_SCOPE_DEFINITIONS` when the existing scope is specific enough for the mechanic.
   - Exclude charge/stack skills covered by `MARTIAL_ARTS_CHARGE_SKILL_DEFINITIONS`, currently Martial Arts charge releases and Maul stacks.
   - Exclude aura pulse damage only when the profile exposes separate `auraPulseDamage*` output and the UI preserves that output when multiple selected auras are combined.
   - Exclude generic summon handling only for the explicitly scoped per-summon-hit result; pet count, AI, attack cadence, and uptime are still separate gaps.
   - Exclude two-weapon or two-throw sequence profiles only for the modeled one-cycle result; bounces, target count, and repeated movement hits are still separate gaps.

3. Classify the mechanic.
   - `counted-projectile`: `calc*` describes missiles, bolts, arrows, teeth, shards, or projectiles.
   - `chain-or-bounce`: `calc*` describes hits, jumps, targets, bounces, or chain percent.
   - `multi-payload`: multiple server missiles, server child missiles, or skill plus missile damage are combined.
   - `periodic-or-ground`: duration, frequency, frame delay, storm, wall, trail, patch, or ground fire controls repeated damage.
   - `stack-or-charge`: progressive state, charge count, max stacks, max charges, or per-stack radius/damage.
   - `target-input`: target current HP, monster base HP, corpse HP, target count, or target size changes output.
   - `summon-uptime`: pet count, shots fired, summon duration, AI choice, attack cadence, or `ulvl` changes output.
   - `conditional-state`: transformation, aura carrier, proc, event hook, curse count, or item stat changes the damage path.

4. Define outlier rules before changing code.
   - Pick the narrowest rule that would have caught the misleading output.
   - Decide whether the rule should be `error`, `warn`, or `info`.
   - Record exact evidence columns and formulas from the game files.
   - State what a correct profile should mean: per hit, per projectile, per chain jump, per charge, per stack, per second, per tick, per summon attack, or target-input-required.

5. Run agent QA.
   - Split by class or mechanic group so each QA agent has a disjoint review scope.
   - Ask each agent to inspect game files and current calculator behavior, not just existing data fixtures.
   - Reconcile agent findings yourself. Do not accept a finding without checking that the cited columns exist and that the calculator path actually reaches the skill.

6. Make the smallest useful change.
   - If the mechanic can be modeled from committed game data, add the model and targeted tests.
   - If the mechanic cannot be modeled without target inputs or compiled behavior, add a clear scope, outlier rule, and debug-session candidate instead of inventing precision.
   - Do not silently change regression fixtures. Refresh fixture expectations only after the new behavior is explained by the model.

7. Verify after every change.
   - Re-run the per-skill QA record for the affected skill or shared mechanic group first.
   - If the change is a generic helper, re-run every skill group that uses that helper before expanding to unrelated skills.
   - Run targeted calculator tests.
   - Run the outlier audit.
   - Treat any audit `error` as blocking. Fix the model, fixture, or audit rule before calling the change complete.
   - Compare remaining `warn` findings against the documented debug queue. New warnings require either a fix or a new handoff entry.
   - Run the regression snapshot test when totals, profile shape, scope labels, or fixtures change.
   - Run full API tests when shared math, game-file parsing, profile generation, or item-stat expansion changes.
   - Run frontend lint/build and browser checks when display labels, rounding, selectors, aura pulse output, or profile controls change.

8. Promote unresolved warnings.
   - Any `warn` finding becomes a debug-session candidate with skill, mechanic, evidence, expected modeling decision, and test plan.
   - Group debug candidates by mechanic, not just by class. One chain-skill fix can cover several classes if the table pattern is shared.

## Agent QA Prompt Template

Use this template for each independent QA agent.

```text
QA the <class or mechanic group> missing-mechanic damage skills in this pd2-tools repo.

Use:
- api/src/game-data/pd2/season-13/Skills.txt
- api/src/game-data/pd2/season-13/Missiles.txt
- api/src/game-data/pd2/season-13/SkillDesc.txt when display/missile references matter
- api/src/game-data/pd2/season-13/MonStats.txt when summon damage matters
- api/src/utils/damage-calculator.ts
- docs/damage-outlier-testing.md
- docs/damage-mechanic-qa-process.md

Exclude mechanics already captured by:
- SKILL_DAMAGE_SCOPE_DEFINITIONS when the scope is specific enough
- MARTIAL_ARTS_CHARGE_SKILL_DEFINITIONS for Martial Arts charges and Maul stacks
- separate auraPulseDamage output for player aura pulses and Fire Golem's pulse aura
- generic per-summon-hit handling, except for pet count, AI, attack cadence, uptime, or ulvl gaps
- weapon sequence handling, except for bounces, target count, repeated movement hits, or unmodeled follow-up payloads

For each candidate skill, report:
- skill name and class
- exact game-file evidence: columns, formulas, missile rows, child rows, or item stats
- current calculator behavior: likely correct, undercount, overcount, mis-scope, or uncovered
- common-sense outlier rule that would flag it
- recommended severity: error, warn, or info
- suggested test or fixture needed

Do not edit files.
Keep the output compact and cite only evidence you verified.
```

## Per-Skill QA Record

Use this structure when recording a finding in a doc, audit report, or debug-session handoff.

```text
Skill:
Class:
Mechanic class:
Current status: captured | scoped | uncaptured | uncertain
Severity: error | warn | info

Game-file evidence:
- Skills.txt:
- Missiles.txt:
- SkillDesc.txt:
- MonStats.txt:
- Item/stat tables:

Current calculator behavior:
- Skill option:
- Profile scope:
- Damage components:
- Known exclusions:

Common-sense outlier:
- Why a passing test could still mislead:
- Rule/code that should flag it:

Expected next step:
- Model:
- Scope only:
- Add target input:
- Add fixture:
- Open debug session:

Verification:
- Targeted tests:
- Snapshot impact:
- Audit impact:
```

## Outlier Rule Catalog

Use these rule codes consistently in scripts, docs, and debug-session candidates.

- `MECH-COUNT-MISSING`: `calc*` exposes projectile, missile, kick, target, or hit count, but the profile does not expose count, variants, or a scoped per-unit label.
- `MECH-CHAIN-BOUNCE-MISSING`: chain, jump, bounce, return, or chain-percent behavior is present but the output is only one hit with no chain/bounce scope.
- `MECH-MULTI-PAYLOAD-SCOPE`: multiple skill/missile payloads are included under a generic scope label. The current audit script reports this as `SCOPE-MULTI-PAYLOAD`; treat it as the automated form of this rule.
- `MECH-PERIODIC-MISSING`: frequency, duration, frame delay, trap shot count, or ground duration can repeat damage but the profile is not per-second, per-tick, or explicitly one-impact scoped.
- `MECH-STACK-VARIANT-MISSING`: progressive stacks, charges, rage, or per-stack behavior can change damage but no stack variants or average/current-stack scope exists.
- `MECH-TARGET-INPUT`: target current HP, corpse HP, monster base HP, target count, size, or enemy state is required for meaningful output.
- `MECH-SUMMON-UPTIME`: pet count, summon count, shots fired, summon duration, AI attack choice, attack cadence, or `ulvl` can materially change the total.
- `MECH-AURA-PULSE`: aura pulse damage exists separately from weapon-carried aura damage and is not exposed as its own skill output.
- `MECH-DEDUPE-RISK`: repeated server missile columns may represent multiple emitted payloads but current traversal dedupes missile rows.
- `MECH-COMPILED-BEHAVIOR`: table data shows the mechanic exists, but the final behavior depends on `srvstfunc`, `srvdofunc`, `srvprgfunc*`, or compiled code not modeled yet.

Severity guidance:

- `error`: the current output is impossible or internally inconsistent, such as negative damage, `max < min`, wrong weapon compatibility, or totals that do not sum.
- `warn`: the current output is plausible but materially incomplete or misleading for a common build or displayed skill.
- `info`: the gap is known, intentionally scoped out, rare, fixture-only, or requires target/live-game inputs before it can be made actionable.

Manual vs automated coverage:

- The audit script enforces arithmetic invariants, weapon compatibility, generic multi-payload scope, snapshot coverage, unsupported formula tokens, item-property expansion risks, and client-only missile child risks.
- Manual per-skill QA is still required for mechanics whose correctness depends on design intent: target/corpse inputs, stack and charge UX, aura pulse placement, trap/summon scope labels, and whether a repeated projectile should be modeled or only scoped.
- Client-only missile findings are intentionally informational unless server columns also reference that child path. Do not convert a client-only missile row into damage without server evidence.

## Verification Commands

Run from `api` unless noted otherwise.

```bash
npm run typecheck
npm test -- --runInBand damage-calculator.test.ts
npm test -- --runInBand damage-regression-snapshot.test.ts
npx ts-node src/scripts/audit-damage-outliers.ts
```

The audit should report zero errors before merge. Warnings are acceptable only when they match the documented debug queue.

Run full API tests when shared damage logic changes:

```bash
npm test -- --runInBand
```

Run from `web` when UI display or controls change:

```bash
npm run lint
npm run build
```

Refresh local Docker only after the code passes local checks and the user needs manual/browser testing:

```bash
docker compose up -d --build api web
```

## Debug-Session Handoff

When a warning needs follow-up, create a handoff with:

- one skill or one shared mechanic group
- exact table evidence
- current profile output and why it is misleading
- proposed modeling decision
- tests that should fail before the fix and pass after
- fixture refresh expectations

Do not batch unrelated mechanics into one debug session. Chain/bounce skills, periodic ground skills, corpse/target-HP skills, summon-uptime skills, and stack/charge skills should be separate unless the same implementation clearly covers them.

## Seed Backlog From Current Review

This is the current starting list for future QA. It is not authoritative; re-scan game files whenever Season data changes.

- Counted missiles/chains/bounces: `Charged Strike`, `Lightning Strike`, `Lightning Fury`, `Chain Lightning`, `Holy Bolt`, `Bone Spear`, `Psychic Hammer`, `Ice Barrage`, `Combustion`, `Split Throw`, `Fire Trauma`, `Shock Field`, `Twister`, `Shock Wave`, `Fire Claws`.
- Multi-hit melee/kick counts: `Zeal`, `Fury`, `Fend`, `Dragon Talon`, `Jab`.
- Periodic/random/ground duration: `Blizzard`, `Eruption`, `Armageddon`, `Hurricane`, `Thunder Storm`, `Molten Boulder`, `Immolation Arrow`, `Exploding Arrow`, `Shattering Arrow`.
- Trap and blade repeats: `Blade Shield`, `Blade Fury`. `Charged Bolt Sentry`, `Wake of Fire Sentry`, `Chain Lightning Sentry`, `Lightning Sentry`, `Death Sentry`, and `Blade Sentinel` are currently scoped as per-projectile/per-hit outputs.
- Corpse or target-input damage: `Corpse Explosion`, `Death Sentry`, `Sacrifice`, `Grim Ward`, `Dark Pact`, `Static Field`.
- Stack/state mechanics: `Frenzy`. `Maul` is modeled per stack; `Mind Blast` and `Feral Rage` damage are not currently stack/state-dependent.
- Aura pulse damage: player aura pulses and Fire Golem pulse aura are modeled separately; multi-aura UI selections should aggregate pulse outputs separately from hit totals. Keep future aura-like skills in this bucket until verified.
- Summon uptime or pet-level gaps: `Hydra`, `Lesser Hydra`, `Raven`, `Summon Spirit Wolf`, `Summon Fenris`, `Summon Grizzly`, Necromancer skeleton/golem/revive variants.
- Known special case: `Vengeance` elemental conversion is modeled, but chain percent from `calc4` remains a separate mechanic question.
