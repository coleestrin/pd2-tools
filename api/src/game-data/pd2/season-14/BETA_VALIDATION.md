# Installed patch validation — October 23, 2026

This report covers the October 23 installed-game refresh merged in PR #47 and its subsequent final-patch-note review. Earlier October 16 reports and CSVs remain historical evidence.

## Current game files and changes

All **15 committed TXT tables** are unmodified extracts. Seven changed since the October 22 snapshot: Skills, Missiles, Levels, MonStats, MonStats2, MonProp and SuperUniques. Regenerated English names changed; the 420-animation/23-sequence catalog did not. [SOURCE_MANIFEST.json](SOURCE_MANIFEST.json) records hashes, schemas, row counts and generated-file provenance. Active installation and Live archives/DLLs match each other and the launcher's four local checksums; the stale 2025 Beta directory was excluded. No installed game files were modified.

The fresh MonStats text matches shipped MonStats.bin across **57,735 values in 1,283 compiled records**. Reproduce with `python api/tools/validate-monster-data.py <fresh-extract>`.

- Tornado now uses minimum tier increments **6/14/22/30/38**, maximum **8/16/24/32/40** and **14% hard-point synergy**. Independent fixtures cover tier boundaries and hard versus soft points. CartBlast's unbuffed primary Tornado falls from **9,208–9,948** in the October 22 snapshot to **7,474–8,081** with fresh source values; both use the same captured equipment and skill allocation.
- Twister, Tornado and Shock Wave now receive the native runtime's Critical/Deadly Strike bonuses from active equipment and applicable auras. Weapon base damage, attack enhanced damage and elemental attack-aura payloads stay out of their spell payloads. Negative controls cover War Cry and Fire Ball; equipment switching, self/party Spirit of Barbs, repeated aura application and Battle Command combinations are checked.
- Eight resistance changes have literal catalog fixtures. Updated bosses use their new life/resistance values and names, including **Son of Rakkis** and **Tainted Child of Bul-Kathos**. The obsolete Dark Temple MonProp aura is removed.
- The catalog has **1,073 targets**, including **66 named monsters**, and **180 populated areas**, including **54 map/dungeon pools**. New pools: Bitter Depths (207, seven species), Poisoned Well (208, nine), **The Fortress of Aranoch** (209, seven) and Descent from Mount Arreat (210, ten). Decaying Swamplands (162, six) is restored: its curated pool must be applied before rejecting unresolved duplicate spawn IDs. Maps expose Hell only.
- Cache versions are **`damage-model-v17` / `season-14-v4`**. The target version is also sent in the actual HTTP URL, invalidating existing browser HTTP-cache entries rather than only React Query's key.

Other source changes include Tornado/Twister next-hit delay 9, Fire Arrow ground duration 50 frames, Static Field variants at 8%, Blade Fury's zero per-point pierce, PvP trap limits and boss/missile records. Their source cells are preserved and tested; collision frequency, a full current-life Static Field damage sequence and PvP combat are outside this model. The developer's [Open Beta Patch 2 announcement](https://www.reddit.com/r/ProjectDiablo2/comments/1xcu7qa/season_14_open_beta_patch_2/) independently corroborates the relevant changes.

## Final patch-note cross-check

Read the full [Season 14 Alliance notes](https://docs.google.com/document/d/1VA1rqc7AaCBLikb2iPK939laUH-Td7C8fPyPuVTFWAo/edit), modified October 23, and mapped calculator-relevant changes to installed source rows and runtime code. Game files take precedence; no table values were replaced with prose-derived values during this review.

| Note group | Source/model reconciliation |
| --- | --- |
| Amazon and Assassin damage tiers, synergies, arrows and weapon source fraction | Existing source imports and independent boundary fixtures cover these; Blade Fury uses SrcDam 96/128. |
| Barbarian mastery, Leap Attack and Whirlwind | Existing Skills values retain the revised damage/strike caps. Whirlwind movement cadence requires an observed rate; no obsolete five-frame rate is inferred. |
| Druid spells, pets and spirits | Source tiers/hard-point synergies already match. Corrected physical summons' missing aura strikes and source-assigned Critical Strike; no owner gear inheritance. |
| Necromancer damage, mastery and curses | Existing source-driven skill/proc formulas remain in use; corpse-life-dependent explosions retain their visible limitation. |
| Paladin mechanics | Source-backed payloads/auras remain; collision, splash overlap, sustain and reactive Thorns events retain their stated limits. |
| Sorceress mastery and Enchants | Removed the melee-only gate on ranged item mastery. Corrected buff synergy, recipient mastery/item scaling and cached owned-to-external source replacement. |
| Monsters, maps, Static Field and PvP | Fresh data and native checks match. Three new regular map pools have no innate immunities; runtime affixes are separate. PvP changes are not applied to PvE. |
| Items, affixes and class life/mana | Added missing magic skill damage parsing/scaling for extra-magi / passive_mag_mastery. Actual armory rolls remain authoritative; item-generation changes do not rewrite existing equipment or armory life/mana. |

Installed Enchant/Cold Enchant aurastatcalc fields use **edmn/edmx**, not vanilla **enma/exma**. The stored buff receives the source Warmth/Chilling Armor hard-point synergy without caster mastery; the attacking recipient's elemental bonus applies once. Independent examples: Enchant 1 + Warmth 1 stores **15–21**; recipient Fire Mastery 1 and +10% item fire damage yield **19–27**. Cold Enchant 1 + Chilling Armor 1 stores **3–5**; recipient Cold Mastery 1 and +10% item cold damage yield **3–6**. External caster hard points are unknown and are not inferred from the recipient. Summons do not acquire their owner's recipient bonus.

Spirit of Barbs 20 gives a physical pet **27% Deadly Strike**. A level-1 Spirit Wolf's **12–18** base therefore gains **1.62–2.43** expected bonus damage, even when the owner's gear has 100% Deadly Strike; that gear contributes nothing to the pet. Valkyrie receives the Critical Strike level explicitly assigned by sumsk3calc, which reads the owner's hard points rather than its soft skill level. The separate innate MonStats critical roll remains excluded and disclosed.

The magic jewel note exposed an omitted stat: Properties extra-magi maps to ItemStatCost passive_mag_mastery, ID **357**. Active raw modifiers or rendered magic skill damage now populate the calculator's magic bonus, without double-counting both representations or stored gear. A source-backed Bone Spear 20 has **181–191** without synergies; +5% magic skill damage gives **190–200** after fixed-point scaling. Carried 100–200 magic item damage becomes **105–210**. The installed DLL's elemental-stat routine reads stat 357 at **0x10306e6e**. Browser QA also uses a controlled copy of a real Bone Spear build with one equipped item given extra-magi=5, representing a socketed jewel; its skill allocation is unchanged.

## Automated checks

- **681 backend tests across 14 suites pass**, including isolated PostgreSQL integration tests.
- **59 frontend tests across three files pass**, including the dedicated TypeScript check of the actual calculator component, target UI, adjustment/mitigation helpers and tests.
- Backend TypeScript, both ESLint runs and both production builds pass. Existing Fast Refresh export, bundle-size and Jest shutdown connection warnings remain.
- Full application TypeScript has **112 existing diagnostics**, matching archived current main (`769e22e`) after normalizing paths/line offsets. No new or resolved diagnostic appears. This broader check is not claimed as passing.

The effective-model matrix covers **127 snapshots: 123 captured real Season 13 characters, three controlled respecs and one magic-jewel variant**, **108,402 profiles**, **128 supported source skill families including Basic Attack**, and **172 skill/charge/difficulty variants**. It completed **3,111,216 target results with zero assertion failures**.

| Matrix category | Results/checks |
| --- | ---: |
| Every catalog monster and difficulty | 553,668 |
| Populated areas and applicable difficulties | 1,161,516 |
| Self/party aura levels 1, 20 and 60 | 241,488 |
| Curse/debuff combinations | 255,420 |
| Rate/contact/block/uptime/overlap/count boundaries | 247,680 |
| Automatic timing checks | 1,720 |
| Slow-effect monotonicity checks | 860 |
| Raw profile preservation fingerprints | 2,228,340 |

Categories overlap and must not be summed as independent observations. Invalid Normal/Nightmare map pools are excluded. API/browser pure models and contracts remain byte-equivalent under regression assertions. Shared-model agreement establishes integration; independently worked numeric fixtures and compiled-table comparisons supply separate arithmetic/source evidence.

## Browser and visual QA

Fresh browser testing completed **567 passing comparisons**, including **1,656 target rows and 186 map means**, with no numeric mismatch or browser runtime error. The CSV records **1,323 rows for 147 distinct skill/charge/weapon selections** on **68 captured real characters plus four controlled variants** against Hell Diablo and all eight Arreat Battlefield species. These cover all 128 supported skill families, all four mage elements, summon difficulty variants, charge states and single/paired Blade Dance.

Each base case first reads the no-target raw cards and compares their displayed rounding with the API total. It then checks adjusted range, landed probability and DPS against the selected monster/map, and finally restores no-target mode and verifies identical raw cards. Controlled inputs are two complete actions/cycles per second and 75% contact before block; these are scenario inputs, not measured cadence.

Additional cases cover self/party Heart of Wolverine and Spirit of Barbs, owned Spirit at level 60, combined Battle Command/Spirit, each eligible physical spell with Spirit, physical summons with Spirit and assigned Critical Strike, owned/party Fire and Cold Enchant, cached source replacement at the native owned level, the controlled magic jewel, automatic Warmth accuracy/timing, every species in the four new maps and Decaying Swamplands, all changed resistance targets and revised bosses, protected-phase zero damage, Reset restoring automatic inputs, and Normal campaign to Hell-only map transitions. Map means are checked after individual mitigation. The actual target request uses `?version=season-14-v4`.

Native manual browser control was unavailable: the browser tool returned a closed transport, and the native fallback could inventory Chrome but could not activate its window. Therefore these are **isolated automated Chromium E2E checks plus manual screenshot inspection**, not hands-on manual browser testing. The test browser uses the local React app and actual Express API backed by an isolated PostgreSQL database; it does not attach to a user's Chrome profile. Production records and the running game are untouched.

[`beta-validation-skills.csv`](beta-validation-skills.csv) contains fresh passing base-case evidence. Three QA respecs preserve captured equipment and skill budgets; the fourth controlled variant changes only one item's magic bonus, as described above. Captures are Season 13 armory records evaluated with current mechanics, not newly observed Season 14 builds. A preliminary level-80 aura probe exceeded the UI's offered levels and was excluded; the final run uses available and native owned levels.

## Adversarial review and sanity checks

Review challenged source provenance, stale HTTP caching, raw-versus-curated spawn eligibility, spell strike exclusions, weapon-set ownership, aura replacement/stacking, per-event target reduction, fixed-point/truncation boundaries, hard/soft points and caster/summon isolation. Source imports remain byte-identical and implementation changes are limited to supported calculations and catalog delivery. A floating-point-exact test assertion was corrected to a numeric tolerance; expected arithmetic was unchanged, and the full suite was repeated.

Independent level-20 fixtures without synergy/mastery give **94–119 Twister**, **277–319 Tornado** and **151–231 Shock Wave** physical damage. With 50% Critical and 50% Deadly Strike, Critical contributes 50% of base; Deadly is checked on the remaining 50%, contributing another 12.5% of base with its 1.5 multiplier. Ordinary spells receive neither bonus. Existing independent fixtures continue to cover Fire Claws' separate ground DPS, per-operation integer formulas, War Cry/curse interactions, fractional Vengeance scaling, poison coverage, item-stat expansion and active/stored equipment separation.

A separate **256-scenario** high/low audit uses all 128 skill families against Diablo and an ordinary quill rat at controlled rates. It found no unexplained extremes or zero-DPS cases for those two targets. The highest Diablo case is CartBlast's Arctic Blast: a 100,455-per-second raw payload becomes **157,714.3 DPS** against -57 cold resistance, with no extra ×25 conversion. The lowest is controlled QA-SplitThrow: 372.81 raw, 45% physical resistance, 50% block and two events/second yield **205.0 DPS**. These are scenario outputs, not realm measurements.

Read-only native checks use ProjectDiablo.dll SHA-256 `41d49d63d531050bb0c89db9efd191fefd322378683159be5dc059498ae1e424`:

- Strike eligibility branches at **0x103049be–0x103049da** and **0x10304a43–0x10304a59** explicitly allow skill IDs **240/243/245** (Twister/Shock Wave/Tornado) despite zero SrcDam. The shared resolver at **0x10304a80** checks Critical before Deadly and caps Critical at 75%; damage handling at **0x10304b60** uses the established 2×/1.5× bases and stat multipliers.
- Crushing Blow at **0x10346b10** retains PvE normal denominator 8, map-boss denominator 30, prime-evil `70 + 10 × missing-life-percent`, and ranged multiplier 1.5. Its new ranged branch calls a helper that recognizes only area IDs **157/159/166**, PvP/battle-royale areas absent the selectable PvE catalog. The new PvP reduction is not applied to PvE targets.

These targeted checks do not establish every native hook's behavior. Review was performed within this task; no independent human or separate-agent review is claimed.

## Limits and retained evidence

This validates source values, calculator arithmetic and browser integration. It does not measure damage in the Diablo client or on a realm. Collision, secondary overlap, travel time, AI cadence, reactive Thorns bleed, corpse-life explosions, generated summon equipment and runtime pack/encounter modifiers retain the limits in [EFFECTIVE_DAMAGE.md](EFFECTIVE_DAMAGE.md). Map means weight species equally, not by population or clear speed. Unverified runtime events remain explicit scenario inputs.

Fresh extraction, semantic source diff and regenerated catalogs are retained locally in `%TEMP%/pd2-followups-extract-2026-10-23`. The final patch-note audit, scenario/outlier results, source/native audits, isolated database, test logs, browser ledger and inspected screenshot are in `%TEMP%/pd2-patchnotes-qa-2026-10-23`; the earlier PR #47 evidence remains in `%TEMP%/pd2-release-qa-2026-10-23`. Preliminary runs before the final corrections are excluded from the current totals. A reused test database with missing relation files was replaced by a fresh isolated cluster before the passing full-suite runs.
