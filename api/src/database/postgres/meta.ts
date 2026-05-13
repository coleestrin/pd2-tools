import { Pool, PoolConfig } from "pg";
import skillPrereqsRaw from "../../data/skill-prereqs.json";
import type {
  GameMode,
  IAffixModRow,
  IAvgStatRow,
  IClassifiedSkillRow,
  IItemUsageRow,
  ILevelDistribution,
  IMercTypeUsageRow,
  ISkillRequirement,
  ISkillUsageRow,
  Slot,
} from "../../types/meta";

type ClassSkillMap = Record<string, { prereqs: string[]; receivesBonusesFrom: string[] }>;
type SkillPrereqs = Record<string, ClassSkillMap>;
const SKILL_PREREQS = skillPrereqsRaw as SkillPrereqs;

// True when `skillName` is at base level 1 AND another skill on the same
// character (base > 1) lists it as a prereq — i.e. the point was spent
// purely to unlock something else, not as a real investment.
function isPrereqOnly(
  skillName: string,
  baseLevel: number,
  characterSkills: Map<string, number>,
  classMap: ClassSkillMap,
): boolean {
  if (baseLevel !== 1) return false;
  for (const [otherName, level] of characterSkills) {
    if (level <= 1) continue;
    if (otherName === skillName) continue;
    if (classMap[otherName]?.prereqs.includes(skillName)) return true;
  }
  return false;
}

// Raw item shape as stored in Characters.full_response_json->'items'[]
interface RawItemJson {
  name?: string;
  quality?: { name?: string };
  base?: { type?: string };
  location?: { zone?: string; equipment?: string };
  modifiers?: Array<{ name?: string; label?: string; values?: number[] }>;
}

// Caller applies the "Equipped"-zone gate; this map is just the slot resolver.
const SLOT_BY_EQUIPMENT: Record<string, Slot> = {
  Helm: "helm",
  Armor: "armor",
  "Right Hand": "weapon",
  "Right Hand Switch": "weapon",
  "Left Hand": "offhand",
  "Left Hand Switch": "offhand",
  Gloves: "gloves",
  Belt: "belt",
  Boots: "boots",
  Amulet: "amulet",
  "Left Ring": "ring",
  "Right Ring": "ring",
};

function inferSlot(
  location: { zone?: string; equipment?: string } | undefined,
): Slot | null {
  if (!location) return null;
  return SLOT_BY_EQUIPMENT[location.equipment ?? ""] ?? null;
}

const SKILL_TAB_MOD = "item_addskill_tab";
const SINGLE_SKILL_MOD = "item_singleskill";
const CLASS_SKILLS_MOD = "item_addclassskills";

// Used by bucketKeyFromLabel to collapse magnitude variants:
// "+1 to Combat Skills (Paladin Only)" and "+3 to Combat Skills (Paladin Only)"
// both become "item_addskill_tab|Combat Skills".
const MAGNITUDE_PREFIX_RE = /^\+?\d+(?:\.\d+)?\s+(?:to\s+)?/i;
const CLASS_SUFFIX_RE = /\s*\([^)]*Only\)\s*$/i;

function bucketKeyFromLabel(modName: string, label: string): string {
  const stripped = label
    .replace(MAGNITUDE_PREFIX_RE, "")
    .replace(CLASS_SUFFIX_RE, "")
    .trim();
  return `${modName}|${stripped}`;
}

// Excluded from Unique/Runeword aggregation: universal items that nearly
// every character carries and would dominate the frequency table.
const IGNORED_UNIQUES_ARRAY = [
  "Hellfire Torch",
  "Annihilus",
  "Call to Arms",
  "Lidless Wall",
];

// Maps the item.base.type values seen in the API's per-item JSON to slot
// categories. Anything not listed (charms, jewels, runes) → null.
const SLOT_BY_BASE_TYPE: Record<string, Slot> = {
  Helm: "helm",
  Circlet: "helm",
  "Primal Helm": "helm",
  Pelt: "helm",
  Armor: "armor",
  Belt: "belt",
  Boots: "boots",
  Gloves: "gloves",
  Amulet: "amulet",
  Ring: "ring",
  Shield: "offhand",
  "Auric Shields": "offhand",
  "Voodoo Heads": "offhand",
  "Bow Quiver": "offhand",
  "Crossbow Quiver": "offhand",
  Sword: "weapon",
  Mace: "weapon",
  Axe: "weapon",
  Hammer: "weapon",
  Bow: "weapon",
  Crossbow: "weapon",
  Spear: "weapon",
  Javelin: "weapon",
  Staff: "weapon",
  Wand: "weapon",
  Scepter: "weapon",
  Orb: "weapon",
  "Hand to Hand": "weapon",
  "Hand to Hand 2": "weapon",
  Polearm: "weapon",
  "Scythe Type": "weapon",
  "Throwing Axe": "weapon",
  "Throwing Knife": "weapon",
  "Amazon Bow": "weapon",
  "Amazon Javelin": "weapon",
  "Amazon Spear": "weapon",
  Club: "weapon",
  Knife: "weapon",
};

function slotFromBaseType(baseType: string | undefined | null): Slot | null {
  if (!baseType) return null;
  return SLOT_BY_BASE_TYPE[baseType] ?? null;
}

export interface ICohortFilter {
  gameMode: GameMode;
  className: string;
  minLevel: number;
  skills: ISkillRequirement[];
  /** Season number: always passed in from the route (config.currentSeason or req.query.season). */
  season: number;
}

export class MetaDB_Postgres {
  private pool: Pool;
  private readonly dbConfig: PoolConfig;
  // Cache the Promise (not the resolved Map) so concurrent first callers
  // share a single in-flight scan instead of each issuing the JSONB query.
  // Lifetime is the process; restart required after PD2 patches add items.
  private slotMapPromise: Promise<Map<string, Slot>> | null = null;

  constructor() {
    this.dbConfig = {
      user: process.env.POSTGRES_USER || "postgres",
      host: process.env.POSTGRES_HOST || "localhost",
      database: process.env.POSTGRES_DB || "pd2",
      password: process.env.POSTGRES_PASSWORD,
      port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
      max: 100,
    };

    this.pool = new Pool(this.dbConfig);
  }

  private async ensureSlotMap(): Promise<Map<string, Slot>> {
    if (!this.slotMapPromise) this.slotMapPromise = this.loadSlotMap();
    return this.slotMapPromise;
  }

  private async loadSlotMap(): Promise<Map<string, Slot>> {
    const sql = `
      SELECT DISTINCT
        item->>'name' AS name,
        item->'base'->>'type' AS base_type
      FROM Characters,
           LATERAL jsonb_array_elements(full_response_json->'items') AS item
      WHERE item->>'name' IS NOT NULL
        AND item->'base'->>'type' IS NOT NULL
        AND (
          item->'quality'->>'name' IN ('Unique', 'Set')
          OR (item->>'is_runeword')::boolean = true
        )
    `;
    const r = await this.pool.query<{ name: string; base_type: string }>(sql);
    const map = new Map<string, Slot>();
    for (const row of r.rows) {
      const slot = slotFromBaseType(row.base_type);
      if (slot) map.set(row.name, slot);
    }
    return map;
  }

  // Returns character_db_ids matching the filter. Empty array if nothing
  // matches; all aggregation queries take this list as their starting set.
  public async findCohort(filter: ICohortFilter): Promise<number[]> {
    const params: any[] = [
      filter.gameMode,
      filter.season,
      filter.minLevel,
      filter.className,
    ];
    let paramIndex = 5;

    const skillClauses: string[] = [];
    for (const skill of filter.skills) {
      skillClauses.push(`
        AND EXISTS (
          SELECT 1 FROM CharacterSkills CS
          JOIN SkillsDefinitions SD ON CS.skill_def_id = SD.skill_def_id
          WHERE CS.character_db_id = C.character_db_id
            AND SD.name = $${paramIndex++}
            AND CS.skill_level >= $${paramIndex++}
        )`);
      params.push(skill.name, skill.minLevel);
    }

    const sql = `
      SELECT C.character_db_id
      FROM Characters C
      JOIN Classes CL ON C.class_id = CL.class_id
      WHERE C.game_mode_id = (SELECT game_mode_id FROM GameModes WHERE name = $1)
        AND C.season = $2
        AND C.level >= $3
        AND CL.name = $4
        ${skillClauses.join("")}
    `;

    const result = await this.pool.query<{ character_db_id: number }>(
      sql,
      params
    );
    return result.rows.map((r) => r.character_db_id);
  }

  // Counts how many characters wear each named item across the cohort.
  // Only Unique / Set / Runeword qualities; the random-name qualities
  // (Rare / Magic / Crafted) are covered by aggregateAffixMods instead.
  // IGNORED_UNIQUES_ARRAY excludes Torch / Anni / CtA / Lidless.
  public async aggregateItemUsage(
    cohortIds: number[],
  ): Promise<IItemUsageRow[]> {
    if (cohortIds.length === 0) return [];

    const sql = `
      SELECT
        BI.name AS item,
        CASE
          WHEN CI.is_runeword = true AND BI.name <> ALL($3) THEN 'Runeword'
          WHEN Q.name = 'Unique' AND BI.name <> ALL($3) THEN 'Unique'
          WHEN Q.name = 'Set' THEN 'Set'
          ELSE NULL
        END AS "itemType",
        COUNT(DISTINCT CI.character_db_id)::int AS "numOccurrences",
        $2::int AS "totalSample",
        (COUNT(DISTINCT CI.character_db_id)::float / $2 * 100) AS pct
      FROM CharacterItems CI
      JOIN BaseItems BI ON CI.base_item_id = BI.base_item_id
      JOIN Qualities Q ON CI.quality_id = Q.quality_id
      WHERE CI.character_db_id = ANY($1::int[])
        AND CASE
          WHEN CI.is_runeword = true AND BI.name <> ALL($3) THEN 'Runeword'
          WHEN Q.name = 'Unique' AND BI.name <> ALL($3) THEN 'Unique'
          WHEN Q.name = 'Set' THEN 'Set'
          ELSE NULL
        END IS NOT NULL
      GROUP BY BI.name, "itemType"
      ORDER BY "numOccurrences" DESC
    `;

    const result = await this.pool.query<Omit<IItemUsageRow, "slot">>(sql, [
      cohortIds,
      cohortIds.length,
      IGNORED_UNIQUES_ARRAY,
    ]);
    const slotMap = await this.ensureSlotMap();
    return result.rows.map((r) => ({ ...r, slot: slotMap.get(r.item) ?? null }));
  }

  // Uses base skill_level from CharacterSkills (not item-boosted effective
  // level). Skills with zero cohort members are omitted.
  public async aggregateSkillUsage(
    cohortIds: number[],
  ): Promise<ISkillUsageRow[]> {
    if (cohortIds.length === 0) return [];

    const sql = `
      SELECT
        SD.name AS name,
        COUNT(DISTINCT CS.character_db_id)::int AS "numOccurrences",
        $2::int AS "totalSample",
        (COUNT(DISTINCT CS.character_db_id)::float / $2 * 100) AS pct
      FROM CharacterSkills CS
      JOIN SkillsDefinitions SD ON CS.skill_def_id = SD.skill_def_id
      WHERE CS.character_db_id = ANY($1::int[])
        AND CS.skill_level >= 1
      GROUP BY SD.name
      ORDER BY "numOccurrences" DESC
    `;
    const result = await this.pool.query<ISkillUsageRow>(sql, [cohortIds, cohortIds.length]);
    return result.rows;
  }

  /**
   * Aggregate skill usage across the cohort with prereq/build classification.
   *
   * For each character, a 1-point skill is classified as "prereq-only" if
   * another skill at base > 1 on the same character lists it as a prerequisite
   * in skill-prereqs.json. All other skilled-into entries count as "build".
   *
   * Falls back gracefully when the className has no entry in skill-prereqs.json
   * (classMap = undefined): every skill is treated as a build skill.
   *
   * Returns rows sorted by pctBuild desc (same ranking as the aggregator).
   */
  public async aggregateSkillUsageClassified(
    cohortIds: number[],
    className: string,
  ): Promise<IClassifiedSkillRow[]> {
    if (cohortIds.length === 0) return [];

    const classMap: ClassSkillMap | undefined = SKILL_PREREQS[className];

    // Pull all (character_db_id, skill_name, base_level) tuples for the cohort
    const sql = `
      SELECT CS.character_db_id, SD.name, CS.skill_level
      FROM CharacterSkills CS
      JOIN SkillsDefinitions SD ON CS.skill_def_id = SD.skill_def_id
      WHERE CS.character_db_id = ANY($1::int[])
        AND CS.skill_level >= 1
    `;
    const result = await this.pool.query<{
      character_db_id: number;
      name: string;
      skill_level: number;
    }>(sql, [cohortIds]);

    // Group by character: character_db_id -> Map<skillName, baseLevel>
    const byChar = new Map<number, Map<string, number>>();
    for (const row of result.rows) {
      let cs = byChar.get(row.character_db_id);
      if (!cs) {
        cs = new Map();
        byChar.set(row.character_db_id, cs);
      }
      cs.set(row.name, row.skill_level);
    }

    // Aggregate per skill
    type Acc = {
      numWithAny: number;
      numAsBuild: number;
      numAsPrereq: number;
      numAtTwenty: number;
    };
    const stats = new Map<string, Acc>();

    for (const [, charSkills] of byChar) {
      for (const [skillName, baseLevel] of charSkills) {
        let s = stats.get(skillName);
        if (!s) {
          s = {
            numWithAny: 0,
            numAsBuild: 0,
            numAsPrereq: 0,
            numAtTwenty: 0,
          };
          stats.set(skillName, s);
        }
        s.numWithAny++;
        if (classMap && isPrereqOnly(skillName, baseLevel, charSkills, classMap)) {
          s.numAsPrereq++;
        } else {
          s.numAsBuild++;
        }
        if (baseLevel >= 20) s.numAtTwenty++;
      }
    }

    const total = cohortIds.length;
    const out: IClassifiedSkillRow[] = [];
    for (const [name, s] of stats) {
      out.push({
        name,
        numOccurrences: s.numWithAny,
        numAsBuild: s.numAsBuild,
        numAsPrereq: s.numAsPrereq,
        numAtTwenty: s.numAtTwenty,
        totalSample: total,
        pct: (s.numWithAny / total) * 100,
        pctBuild: (s.numAsBuild / total) * 100,
        pctAtTwenty: (s.numAtTwenty / total) * 100,
      });
    }
    out.sort((a, b) => b.pctAtTwenty - a.pctAtTwenty);
    return out;
  }

  // CharacterMercenaries stores one row per character with the merc type
  // in `description` ("Holy Freeze Merc" etc).
  public async aggregateMercType(
    cohortIds: number[],
  ): Promise<IMercTypeUsageRow[]> {
    if (cohortIds.length === 0) return [];

    const sql = `
      SELECT
        CM.description AS "mercType",
        COUNT(DISTINCT CM.character_db_id)::int AS "numOccurrences",
        $2::int AS "totalSample",
        (COUNT(DISTINCT CM.character_db_id)::float / $2 * 100) AS pct
      FROM CharacterMercenaries CM
      WHERE CM.character_db_id = ANY($1::int[])
        AND CM.description IS NOT NULL
      GROUP BY CM.description
      ORDER BY "numOccurrences" DESC
    `;
    const result = await this.pool.query<IMercTypeUsageRow>(sql, [cohortIds, cohortIds.length]);
    return result.rows;
  }

  public async aggregateMercItems(
    cohortIds: number[],
  ): Promise<IItemUsageRow[]> {
    if (cohortIds.length === 0) return [];

    const sql = `
      SELECT
        BI.name AS item,
        CASE
          WHEN MI.is_runeword = true AND BI.name <> ALL($3) THEN 'Runeword'
          WHEN Q.name = 'Unique' AND BI.name <> ALL($3) THEN 'Unique'
          WHEN Q.name = 'Set' THEN 'Set'
          ELSE NULL
        END AS "itemType",
        COUNT(DISTINCT MI.character_db_id)::int AS "numOccurrences",
        $2::int AS "totalSample",
        (COUNT(DISTINCT MI.character_db_id)::float / $2 * 100) AS pct
      FROM MercenaryItems MI
      JOIN BaseItems BI ON MI.base_item_id = BI.base_item_id
      JOIN Qualities Q ON MI.quality_id = Q.quality_id
      WHERE MI.character_db_id = ANY($1::int[])
        AND CASE
          WHEN MI.is_runeword = true AND BI.name <> ALL($3) THEN 'Runeword'
          WHEN Q.name = 'Unique' AND BI.name <> ALL($3) THEN 'Unique'
          WHEN Q.name = 'Set' THEN 'Set'
          ELSE NULL
        END IS NOT NULL
      GROUP BY BI.name, "itemType"
      ORDER BY "numOccurrences" DESC
    `;
    const result = await this.pool.query<Omit<IItemUsageRow, "slot">>(sql, [
      cohortIds,
      cohortIds.length,
      IGNORED_UNIQUES_ARRAY,
    ]);
    const slotMap = await this.ensureSlotMap();
    return result.rows.map((r) => ({ ...r, slot: slotMap.get(r.item) ?? null }));
  }

  /**
   * Level distribution buckets: counts of characters at each integer level
   * within the cohort. The pd2.tools level-distribution endpoint returns both
   * hardcore and softcore sides; the /meta cohort is already filtered to one
   * gameMode, so only the matching side is populated and the other is empty.
   */
  public async aggregateLevelDistribution(
    cohortIds: number[],
    /** Selects which side of the response shape to populate.
     *  Not used in the SQL: the cohort is already mode-filtered by findCohort. */
    gameMode: GameMode,
  ): Promise<ILevelDistribution> {
    if (cohortIds.length === 0) return { hardcore: [], softcore: [] };

    const sql = `
      SELECT C.level, COUNT(*)::int AS "count"
      FROM Characters C
      WHERE C.character_db_id = ANY($1::int[])
      GROUP BY C.level
      ORDER BY C.level
    `;
    const result = await this.pool.query<{ level: number; count: number }>(
      sql,
      [cohortIds],
    );
    return gameMode === "hardcore"
      ? { hardcore: result.rows, softcore: [] }
      : { hardcore: [], softcore: result.rows };
  }

  /**
   * Aggregate affix modifiers from Rare/Magic/Crafted equipped items across
   * the cohort.
   *
   * SQL pulls the full items array per character; Node iterates, filters by
   * quality + zone, buckets modifiers by (slot, mod.name), and computes
   * count / avg / median / p75 per bucket.
   */
  public async aggregateAffixMods(
    cohortIds: number[],
  ): Promise<IAffixModRow[]> {
    if (cohortIds.length === 0) return [];

    // Pull the raw items array for every character in the cohort.
    // jsonb_array_elements expands the JSON array into one row per item.
    const sql = `
      SELECT
        jsonb_array_elements(C.full_response_json->'items') AS item_json
      FROM Characters C
      WHERE C.character_db_id = ANY($1::int[])
    `;
    const { rows } = await this.pool.query<{ item_json: RawItemJson }>(
      sql,
      [cohortIds],
    );

    // slot -> modKey -> values[]
    const grouped = new Map<Slot, Map<string, number[]>>();
    // slot -> number of eligible items (denominator for pct)
    const itemCountBySlot = new Map<Slot, number>();

    for (const row of rows) {
      const item = row.item_json;
      if (!item) continue;

      // Quality gate: only Rare / Magic / Crafted
      const quality = item.quality?.name;
      if (quality !== "Rare" && quality !== "Magic" && quality !== "Crafted") continue;

      // Zone gate: must be equipped (location.zone === "Equipped")
      if (item.location?.zone !== "Equipped") continue;

      const slot = inferSlot(item.location);
      if (!slot) continue;

      // Track per-slot item count (denominator for pct, same as standalone)
      itemCountBySlot.set(slot, (itemCountBySlot.get(slot) ?? 0) + 1);

      const modifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
      for (const mod of modifiers) {
        if (typeof mod.name !== "string") continue;
        // The magnitude is always the LAST element of `values`.
        // Single-value mods (e.g. item_fastercastrate) → values = [magnitude].
        // Two-value mods (item_singleskill / item_addskill_tab /
        // item_addclassskills) → values = [id_or_tab, magnitude].
        const val = Array.isArray(mod.values) && mod.values.length > 0
          ? Number(mod.values[mod.values.length - 1]) || 0
          : Number(mod.values) || 0;

        // For mods that target a specific skill / tab / class, bucket by the
        // label content so different targets stay in separate rows but
        // different magnitudes (+1 / +3) collapse together.
        // "item_addskill_tab|Combat Skills"     (was: collapsed to a single row)
        // "item_singleskill|Ice Blast"          (was: all single-skill bonuses merged)
        // "item_addclassskills|Sorceress Skills"
        const bucketKey =
          mod.name === SKILL_TAB_MOD ||
          mod.name === SINGLE_SKILL_MOD ||
          mod.name === CLASS_SKILLS_MOD
            ? bucketKeyFromLabel(mod.name, mod.label ?? "")
            : mod.name;

        let bySlot = grouped.get(slot);
        if (!bySlot) {
          bySlot = new Map();
          grouped.set(slot, bySlot);
        }
        const arr = bySlot.get(bucketKey) ?? [];
        arr.push(val);
        bySlot.set(bucketKey, arr);
      }
    }

    const out: IAffixModRow[] = [];

    for (const [slot, byMod] of grouped) {
      // Per-slot item count as denominator (mirrors standalone's itemCount[slot])
      const slotItemCount = itemCountBySlot.get(slot) ?? 1;

      for (const [modKey, vals] of byMod) {
        // Suppress rare mods (< 3 occurrences) to reduce noise
        if (vals.length < 3) continue;

        const sorted = [...vals].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const avg = sum / sorted.length;
        const mid = Math.floor(sorted.length / 2);
        const medianVal =
          sorted.length % 2 === 1
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
        const p75Idx = Math.ceil(0.75 * sorted.length) - 1;
        const p75Val = sorted[Math.max(0, p75Idx)];

        out.push({
          slot,
          modKey,
          numOccurrences: vals.length,
          totalSample: slotItemCount,
          pct: (vals.length / slotItemCount) * 100,
          avg,
          median: medianVal,
          p75: p75Val,
        });
      }
    }

    // Sort by slot asc, then pct desc
    out.sort((a, b) =>
      a.slot === b.slot ? b.pct - a.pct : a.slot.localeCompare(b.slot),
    );

    return out;
  }

  /**
   * Cohort averages of the 6 core stat-panel values (str / dex / vit /
   * energy / life / mana), read straight from character.attributes +
   * character.life / mana. These are the same totals pd2.tools shows on
   * the Stats panel, not gear-modifier sums.
   */
  public async aggregateAvgStats(cohortIds: number[]): Promise<IAvgStatRow[]> {
    if (cohortIds.length === 0) return [];

    const sql = `
      SELECT
        (C.full_response_json->'character'->'attributes'->>'strength')::numeric AS strength,
        (C.full_response_json->'character'->'attributes'->>'dexterity')::numeric AS dexterity,
        (C.full_response_json->'character'->'attributes'->>'vitality')::numeric AS vitality,
        (C.full_response_json->'character'->'attributes'->>'energy')::numeric AS energy,
        (C.full_response_json->'character'->>'life')::numeric AS life,
        (C.full_response_json->'character'->>'mana')::numeric AS mana
      FROM Characters C
      WHERE C.character_db_id = ANY($1::int[])
    `;
    const { rows } = await this.pool.query<{
      strength: string | null;
      dexterity: string | null;
      vitality: string | null;
      energy: string | null;
      life: string | null;
      mana: string | null;
    }>(sql, [cohortIds]);

    const cohortSize = rows.length;
    if (cohortSize === 0) return [];

    const sums = {
      strength: 0,
      dexterity: 0,
      vitality: 0,
      energy: 0,
      life: 0,
      mana: 0,
    };
    for (const row of rows) {
      sums.strength += Number(row.strength) || 0;
      sums.dexterity += Number(row.dexterity) || 0;
      sums.vitality += Number(row.vitality) || 0;
      sums.energy += Number(row.energy) || 0;
      sums.life += Number(row.life) || 0;
      sums.mana += Number(row.mana) || 0;
    }

    const order: Array<keyof typeof sums> = [
      "strength",
      "dexterity",
      "vitality",
      "energy",
      "life",
      "mana",
    ];
    return order.map((k) => ({
      modName: k,
      avgValue: sums[k] / cohortSize,
      charsWithMod: cohortSize,
      pctOfChars: 100,
    }));
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
