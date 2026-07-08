# Game File Damage Formula Findings

This document records findings from inspecting the local Diablo II and ProjectD2 install at:

- `C:\Program Files (x86)\Diablo II`
- `C:\Program Files (x86)\Diablo II\ProjectD2`

The immediate motivation was the UnfazedTwo Vengeance/elemental damage discrepancy, but the broader finding is more important: calculator correctness cannot depend on rendered item property text. The game data model is stat/property driven, and the UI labels are lossy.

## Extraction Provenance

ProjectD2 Season 13 tables were extracted from:

- `C:\Program Files (x86)\Diablo II\ProjectD2\pd2data.mpq`
- `C:\Program Files (x86)\Diablo II\ProjectD2\patch_d2.mpq`

The MPQ reader in `stormlib-js` listed archive contents correctly but produced corrupt output for at least `Skills.txt`. Verified extraction used `@diablo2/mpq`; this was cross-checked by comparing extracted installed copies of the tables already committed in this repo.

Committed repo tables matched the installed ProjectD2 tables exactly:

- `Armor.txt`
- `Missiles.txt`
- `MonStats.txt`
- `SkillDesc.txt`
- `Skills.txt`

Installed file hashes used for this inspection:

```text
196F9DA7F5A7EEAD7BC000137514E6B564E50E893CA89BB4711359D03C29CE63  ProjectD2\pd2data.mpq
B976E7847DDA696F54198A9477819F96579C4894F54381C72AFB4937E919E0A9  ProjectD2\patch_d2.mpq
59FA5928522F566F2BF99675571206AD70DF889C89D3D07FA87EDF5083E06E10  ProjectD2\D2Common.dll
24B293B86F95BEA0228826C502EA04737BA21B91CA9832E52AAC4B11FEF14F53  ProjectD2\D2Game.dll
DD8BC6025DE921216A97C17F97CD1A50FBB85926E838EC60E13451448836D906  ProjectD2\D2Client.dll
538A77B7CCEF3D5334E56C4E9E57A4D8FC69A1E27C46BEB694C0DEDFCFBF9CB3  ProjectD2\ProjectDiablo.dll
A47E6F026C867035EF5360E0F86061D0FA06746DFD249CE9E794DC6758766F49  ProjectD2\PD2_EXT.dll
```

## File Responsibility Map

Damage and stat behavior is split across data tables and compiled code.

Data tables:

- `Skills.txt`: skill parameters, `calc` fields, aura/passive stat formulas, `SrcDam`, elemental damage fields, synergies.
- `SkillDesc.txt`: tooltip/display formulas. Useful for explaining UI text, not authoritative combat math.
- `Missiles.txt`: missile-side damage formulas and elemental scaling for missile skills.
- `ItemStatCost.txt`: stat IDs, save/send encoding, display behavior, stat operators, event hooks, display grouping.
- `Properties.txt`: expands property codes like `dmg-fire` into concrete stats like `firemindam` and `firemaxdam`.
- `UniqueItems.txt`, `SetItems.txt`, `MagicPrefix.txt`, `MagicSuffix.txt`, `Runes.txt`, `Gems.txt`: assign property codes and roll ranges to items, affixes, runewords, and socketables.
- `Weapons.txt` / `Armor.txt`: base item damage/defense and item type metadata.
- `States.txt`: state/aura metadata.

Compiled behavior:

- `D2Common.dll`: contains table/formula loader names such as `itemstatcost`, `properties`, `DmgSymPerCalc`, `EDmgSymPerCalc`, `aurastatcalc*`, and `passivecalc*`. This is where table formulas are evaluated and stat systems are wired.
- `D2Game.dll`: contains skill implementation modules, including `SKILLS\SkilPal.cpp`.
- `D2Client.dll`: contains client skill/display modules.
- `ProjectDiablo.dll`: contains ProjectD2 hooks, including strings such as `_BHOnDamagePropertyBuild@16`, `_BHOnProperties@4`, `damagerelated`, and `itemstatcost`.

Inference: MPQ tables contain many formulas, but not the full damage engine. Final behavior comes from table data plus compiled stat/skill/property functions.

## Item Elemental Stats

The important elemental item stats in `ItemStatCost.txt` are separate min/max stats:

| Stat | ID | Notes |
| --- | ---: | --- |
| `firemindam` | 48 | fire min |
| `firemaxdam` | 49 | fire max |
| `lightmindam` | 50 | lightning min |
| `lightmaxdam` | 51 | lightning max |
| `magicmindam` | 52 | magic min |
| `magicmaxdam` | 53 | magic max |
| `coldmindam` | 54 | cold min |
| `coldmaxdam` | 55 | cold max |
| `coldlength` | 56 | cold duration |
| `poisonmindam` | 57 | poison min/rate input |
| `poisonmaxdam` | 58 | poison max/rate input |
| `poisonlength` | 59 | poison duration |

`Properties.txt` maps display-level property codes to those stats:

| Property code | Expansion |
| --- | --- |
| `dmg-fire` | `firemindam`, `firemaxdam` |
| `dmg-ltng` | `lightmindam`, `lightmaxdam` |
| `dmg-mag` | `magicmindam`, `magicmaxdam` |
| `dmg-cold` | `coldmindam`, `coldmaxdam`, `coldlength` |
| `dmg-pois` | `poisonmindam`, `poisonmaxdam`, `poisonlength` |
| `fire-min` / `fire-max` | individual fire min/max stats |
| `ltng-min` / `ltng-max` | individual lightning min/max stats |
| `cold-min` / `cold-max` | individual cold min/max stats |
| `dmg-elem` | fire min/max, lightning min/max, cold min/max/length |
| `extra-fire` | `passive_fire_mastery` |
| `extra-ltng` | `passive_ltng_mastery` |
| `extra-cold` | `passive_cold_mastery` |
| `extra-pois` | `passive_pois_mastery` |

This is the source-of-truth relationship. Rendered `properties[]` labels are downstream output and may omit or mangle fields.

## UnfazedTwo-Specific Evidence

Relevant installed item definitions:

- Azurewrath, phase blade:
  - `dmg-mag` `500-650`
  - `dmg-cold` param `250`, min `250`, max `500`
  - `aura` `Sanctuary` level `10-12`
  - `extra-cold` and `extra-fire` can also appear through corruptions/affixes in the armory payload.
- Dragonscale:
  - `dmg-fire` `211-371`
  - `extra-fire` `15-20`
- Lava Gout:
  - `dmg-fire` `26-92`
  - `hit-skill` Enchant
- Thundergod's Vigor:
  - `ltng-min` `1-1`
  - `ltng-max` `150-250`
- Stone of Jordan:
  - `dmg-ltng` `1-120`
- Raven Frost:
  - `dmg-cold` `15-45`
- Merman's Speed/Sprocket:
  - `cold-min` `40`
  - `cold-max` `80`

The armory payload can expose these as modifier rows whose `label` does not fully describe all raw values. Example from UnfazedTwo:

- Thundergod's Vigor appears as `lightmindam` with values like `[1, 162]`, but the label says only `+1 to Minimum Lightning Damage`.
- Azurewrath magic appears as `magicmindam` with values `[500, 650]`, but the label can render as malformed text like `+500 +%d magic damage`.

So the previous bug is not just a Vengeance formula issue. It is also an item-stat ingestion issue: the API can carry useful raw stat values while the display label is incomplete or wrong.

## Vengeance Findings

Installed `Skills.txt` row for `Vengeance`:

- `srvstfunc`: `23`
- `srvdofunc`: `174`
- `SrcDam`: `128`
- `calc1`, `calc2`, `calc3` are identical and define fire/cold/lightning damage percent:

```text
ln12+((skill('Holy Fire'.blvl)+skill('Holy Freeze'.blvl)+skill('Holy Shock'.blvl))*par8+skill('Conviction'.blvl)*par7)
```

Parameters:

- `Param1`: `5`, percent damage
- `Param2`: `2`, percent damage per level
- `Param7`: `2`, Conviction synergy
- `Param8`: `2`, Holy Fire/Holy Freeze/Holy Shock synergy

Important implication: `Skills.txt` tells us the Vengeance percentage calculation, but not every detail of the server function `srvdofunc=174`. The conversion/base selection behavior is compiled. The table does, however, make clear that the three elemental components are separate outputs, not one pooled elemental bucket.

## Aura and Elemental Skill Damage Findings

Several aura/skill rows add elemental damage via passive stats:

- Holy Fire:
  - `passivestat1=firemindam`, `passivecalc1=edns*par5/256`
  - `passivestat2=firemaxdam`, `passivecalc2=edxs*par5/256`
- Holy Freeze:
  - `passivestat1=coldmindam`, `passivecalc1=edns*par5/256`
  - `passivestat2=coldmaxdam`, `passivecalc2=edxs*par5/256`
- Holy Shock:
  - `passivestat1=lightmindam`, `passivecalc1=edns*par5/256`
  - `passivestat2=lightmaxdam`, `passivecalc2=edxs*par5/256`
- Sanctuary:
  - `passivestat1=magicmindam`, `passivecalc1=edns*par7/256`
  - `passivestat2=magicmaxdam`, `passivecalc2=edxs*par7/256`
- Enchant:
  - `aurastat1=firemindam`, `aurastatcalc1=edmn`
  - `aurastat2=firemaxdam`, `aurastatcalc2=edmx`
- Cold Enchant:
  - `aurastat1=coldmindam`, `aurastatcalc1=edmn`
  - `aurastat2=coldmaxdam`, `aurastatcalc2=edmx`

Elemental skill damage bonuses are also normal stats:

- `passive_fire_mastery`
- `passive_ltng_mastery`
- `passive_cold_mastery`
- `passive_pois_mastery`

This supports scaling flat item elemental damage by matching elemental skill damage where the game's LCS does so. It also means future fixes should be stat-driven rather than string-driven.

## Broader Calculator Risk

The current calculator still has architectural risk because it mostly reads:

- armory `properties[]` display text
- selected raw `modifiers[]` names and values
- a limited committed subset of game tables

The installed game files show many additional mechanisms that should be modeled from tables:

- `Properties.txt` has 450 property rows and 173 formula/function-like rows.
- `ItemStatCost.txt` has many rows with `op`, `maxstat`, event hooks, and display-group behavior.
- `Skills.txt` has 603 rows, with 499 rows containing formula-like fields.
- Item sources with stat-bearing properties are spread across uniques, sets, affixes, runes, gems, automods, and cube outputs.
- Per-level, per-time, per-energy, event-triggered, and display-grouped stats are encoded in `ItemStatCost.txt` rather than item text.

Specific high-risk examples:

- `item_maxdamage_percent` has `op=13` targeting `maxdamage`, `secondary_maxdamage`, and `item_throw_maxdamage`.
- Per-level stats like `item_cold_damagemax_perlevel`, `item_fire_damagemax_perlevel`, and `item_ltng_damagemax_perlevel` target elemental max stats through `op`.
- Event stats such as `item_skillonhit`, `item_skillonattack`, `item_openwounds`, and `item_splashonhit` depend on `itemevent*` fields.
- Display groups such as all resistances are grouped through `dgrp`/`dgrpfunc`, so label text can intentionally hide the underlying separate stats.

## Implementation Direction

The durable fix is to add a table-driven stat expansion layer:

1. Load `ItemStatCost.txt` and `Properties.txt` from committed ProjectD2 game data.
2. Expand each armory modifier/property code into concrete stat deltas using `Properties.txt`.
3. Prefer raw `modifiers[]` values over rendered labels.
4. Use label parsing only as a fallback when the payload lacks raw stat identity.
5. Preserve the expanded stat ledger on each damage profile for debugging.
6. Apply skill formulas from `Skills.txt` against that expanded stat ledger.

For the current Vengeance bug class, this would replace ad hoc cases like "parse `lightmindam` values as lightning range" with a general rule:

```text
property/stat source -> concrete stats -> elemental damage ledger -> skill/aura formula
```

That is the same direction the actual game data uses.

## Open Questions

- The exact behavior of `srvdofunc=174` for Vengeance is compiled. The table gives the percent formula and source-damage flag, but the final server function behavior must be inferred from tests/live observations unless we reverse engineer the DLL.
- The armory API does not always expose the original property code; sometimes it exposes final stat names and rendered labels. We need to normalize both shapes.
- The LCS display may include client-side aggregation/rounding rules from `D2Client.dll`, not just server damage math.
- `ProjectDiablo.dll` appears to hook property/damage building. Any divergence from vanilla D2 stat behavior may live there.

## Practical Conclusion

The UnfazedTwo issue was a symptom of a broader problem. Vengeance needed a direct formula fix, but the larger root cause is that the calculator has been treating rendered item text as primary data. The installed ProjectD2 files show that item damage is a stat graph, not a text parse problem.

The first foundational fix now commits `ItemStatCost.txt` and `Properties.txt` and uses them to expand armory item modifiers into concrete stat deltas before falling back to rendered text. Future calculator work should continue extending that stat-ledger path instead of adding more one-off parsing patches.

## Appendix: Extracted ProjectD2 Table Catalog

Verified ProjectD2 tables extracted from `pd2data.mpq`:

| File | Rows | Bytes |
| --- | ---: | ---: |
| `AiParms.txt` | 194 | 7359 |
| `Arena.txt` | 1 | 132 |
| `Armor.txt` | 205 | 77143 |
| `AutoMagic.txt` | 58 | 5493 |
| `AutoMap.txt` | 4851 | 229666 |
| `Belts.txt` | 15 | 3757 |
| `BodyLocs.txt` | 11 | 187 |
| `Books.txt` | 3 | 315 |
| `CharStats.txt` | 8 | 3454 |
| `CharTemplate.txt` | 30 | 7852 |
| `Colors.txt` | 21 | 374 |
| `CompCode.txt` | 145 | 2266 |
| `Composit.txt` | 16 | 207 |
| `CubeMain.txt` | 2341 | 506396 |
| `CubeMod.txt` | 12 | 193 |
| `CubeType.txt` | 15 | 228 |
| `DifficultyLevels.txt` | 3 | 587 |
| `ElemTypes.txt` | 13 | 226 |
| `Events.txt` | 18 | 587 |
| `Experience.txt` | 101 | 7116 |
| `Gamble.txt` | 115 | 1838 |
| `Gems.txt` | 69 | 7814 |
| `HireDesc.txt` | 15 | 337 |
| `Hireling.txt` | 156 | 37363 |
| `HitClass.txt` | 14 | 312 |
| `Inventory.txt` | 33 | 8823 |
| `ItemRatio.txt` | 6 | 662 |
| `ItemStatCost.txt` | 511 | 64033 |
| `ItemTypes.txt` | 240 | 19791 |
| `Levels.txt` | 203 | 113855 |
| `LvlSub.txt` | 35 | 3466 |
| `LvlTypes.txt` | 47 | 18388 |
| `LvlWarp.txt` | 97 | 5742 |
| `MagicPrefix.txt` | 934 | 88732 |
| `MagicSuffix.txt` | 1038 | 100825 |
| `MiniSkillIcons.txt` | 532 | 33022 |
| `Misc.txt` | 308 | 117092 |
| `MissCalc.txt` | 43 | 1143 |
| `Missiles.txt` | 1057 | 320570 |
| `MonAi.txt` | 148 | 7695 |
| `MonEquip.txt` | 53 | 2214 |
| `MonItemPercent.txt` | 2 | 118 |
| `MonLvl.txt` | 111 | 14707 |
| `MonMode.txt` | 16 | 238 |
| `MonName.txt` | 43 | 532 |
| `MonPlace.txt` | 37 | 658 |
| `MonPreset.txt` | 324 | 5184 |
| `MonProp.txt` | 66 | 11646 |
| `MonSeq.txt` | 1220 | 34077 |
| `MonSounds.txt` | 148 | 24301 |
| `MonStats.txt` | 1241 | 760403 |
| `MonStats2.txt` | 733 | 169019 |
| `MonType.txt` | 60 | 1384 |
| `MonUMod.txt` | 43 | 2492 |
| `Npc.txt` | 18 | 1457 |
| `ObjGroup.txt` | 139 | 11396 |
| `ObjMode.txt` | 8 | 114 |
| `ObjType.txt` | 631 | 11162 |
| `Objects.txt` | 631 | 231713 |
| `Overlay.txt` | 326 | 30455 |
| `PetType.txt` | 29 | 1872 |
| `PlayerClass.txt` | 8 | 128 |
| `PlrMode.txt` | 20 | 302 |
| `PlrType.txt` | 8 | 114 |
| `Properties.txt` | 450 | 39473 |
| `QualityItems.txt` | 8 | 1039 |
| `RarePrefix.txt` | 46 | 1824 |
| `RareSuffix.txt` | 155 | 5364 |
| `Runes.txt` | 198 | 26847 |
| `SetItems.txt` | 129 | 28746 |
| `Sets.txt` | 33 | 6527 |
| `Shrines.txt` | 23 | 2262 |
| `SkillCalc.txt` | 73 | 2017 |
| `Skilldesc.txt` | 259 | 92590 |
| `Skills.txt` | 603 | 320277 |
| `SoundEnviron.txt` | 50 | 5741 |
| `Sounds.txt` | 4735 | 518487 |
| `States.txt` | 242 | 26927 |
| `StorePage.txt` | 4 | 85 |
| `SuperUniques.txt` | 68 | 8167 |
| `TreasureClass.txt` | 706 | 68077 |
| `TreasureClassEx.txt` | 1087 | 112692 |
| `UniqueAppellation.txt` | 25 | 294 |
| `UniqueItems.txt` | 484 | 97855 |
| `UniquePrefix.txt` | 53 | 392 |
| `UniqueSuffix.txt` | 69 | 527 |
| `UniqueTitle.txt` | 16 | 250 |
| `WeaponClass.txt` | 15 | 341 |
| `Weapons.txt` | 320 | 127756 |
