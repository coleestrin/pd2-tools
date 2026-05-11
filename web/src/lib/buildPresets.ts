import buildsRaw from "../data/builds.json";

export type BuildPreset = {
  /** Display name shown on the button (community-recognized build name). */
  name: string;
  /** Skill names matching `character.character.skills[].name`. ALL of these
   *  must be present at the skill-filter minLevel for a character to match. */
  skills: string[];
};

export type BuildPresetsByClass = Record<string, BuildPreset[]>;

export const BUILD_PRESETS = buildsRaw as BuildPresetsByClass;

/** Default minLevel used when a preset populates the skill filter.
 *  20 is the standard "this is actually the build, not a 1-pt synergy" mark. */
export const PRESET_MIN_LEVEL = 20;

/**
 * True if the current skill-filter set exactly matches the preset's skill
 * list (by name, order-independent). Used to visually mark the active preset.
 */
export function isPresetActive(
  currentSkillNames: string[],
  preset: BuildPreset,
): boolean {
  if (currentSkillNames.length !== preset.skills.length) return false;
  const present = new Set(currentSkillNames);
  return preset.skills.every((n) => present.has(n));
}
