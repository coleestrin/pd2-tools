import type { Character } from "./types";

export type SkillRequirement = {
  /** Skill name as it appears in character.character.skills[].name */
  name: string;
  /** All hard-allocated skill points must be >= this value */
  minLevel: number;
};

export type ClientFilter = {
  /** Must match character.character.class.name exactly */
  className: string;
  /** ALL requirements must be satisfied (AND logic, not OR) */
  skills: SkillRequirement[];
  /**
   * Optional client-side level guard.
   * Server already filters by minLevel, but this acts as a safety net
   * when working with a local snapshot that may have mixed data.
   */
  minCharLevel?: number;
};

/**
 * Filter the sampled raw set down to characters matching `className` and ALL
 * `skills` minimums. Sorted by character level descending. Optionally truncated
 * to `topN` results.
 *
 * Uses `character.character.skills` (hard-allocated points), NOT `realSkills`
 * (which include gear boosts).
 */
export function filterCharacters(
  chars: Character[],
  f: ClientFilter,
  topN?: number,
): Character[] {
  const filtered = chars.filter((c) => {
    // Class must match
    if (c.character.class.name !== f.className) return false;

    // Optional level guard
    if (f.minCharLevel !== undefined && c.character.level < f.minCharLevel) {
      return false;
    }

    // ALL skill requirements must be met (hard-allocated points)
    for (const req of f.skills) {
      const found = c.character.skills.some(
        (s) => s.name === req.name && s.level >= req.minLevel,
      );
      if (!found) return false;
    }

    return true;
  });

  // Sort by level descending
  filtered.sort((a, b) => b.character.level - a.character.level);

  // Optionally truncate
  if (topN !== undefined) return filtered.slice(0, topN);
  return filtered;
}
