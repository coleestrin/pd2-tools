// Types derived from data/snapshot.json (pd2.tools API response).
// Re-run `npx tsx scripts/inspect-snapshot.ts` if the live API shape changes.

export type Slot =
  | "helm"
  | "armor"
  | "weapon"
  | "offhand"
  | "gloves"
  | "belt"
  | "boots"
  | "amulet"
  | "ring";

export type HardcoreStatus = boolean;

// Observed quality names: "Normal", "Superior", "Magic", "Rare", "Set", "Unique", "Crafted"
export type QualityName =
  | "Normal"
  | "Magic"
  | "Rare"
  | "Set"
  | "Unique"
  | "Crafted"
  | "Superior";

export type ItemQuality = {
  id: number;
  name: QualityName;
  sub_id?: number;
};

export type ItemBase = {
  id: string;
  name: string;
  type: string;
  type_code: string;
  category: string;
  size: {
    width: number;
    height: number;
  };
  codes: {
    normal: string;
    exceptional: string;
    elite: string;
  };
  stackable: boolean;
  requirements: {
    level?: number;
    strength?: number;
    dexterity?: number;
  };
};

export type ItemModifier = {
  name: string;
  label: string;
  values: number[];
  priority: number;
  min?: number;
  max?: number;
};

export type ItemLocation = {
  zone: string;
  storage: string;
  zone_id: number;
  equipment: string;
  storage_id: number;
  equipment_id: number;
};

export type ItemPosition = {
  row: number;
  column: number;
};

export type UniqueItemRef = {
  id: number;
  requirements: {
    level?: number;
    strength?: number;
    dexterity?: number;
  };
};

export type DefenseStats = {
  base: number;
  total: number;
};

export type DurabilityStats = {
  current: number;
  maximum: number;
};

export type ItemRequirements = {
  level?: number;
  strength?: number;
  dexterity?: number;
};

// Contains all fields actually present in snapshot
export type Item = {
  id: number;
  base: ItemBase;
  hash: string;
  quality: ItemQuality;
  name?: string;
  location: ItemLocation;
  position: ItemPosition;
  base_code: string;
  category: string;
  modifiers: ItemModifier[];
  properties: string[];
  item_level: number;
  requirements: ItemRequirements;
  is_identified: boolean;
  is_ethereal: boolean;
  is_runeword: boolean;
  is_socketed: boolean;
  socket_count: number;
  socketed_count: number;
  corrupted: boolean;
  desecrated: boolean;
  is_simple: boolean;
  is_ear: boolean;
  is_new: boolean;
  is_starter: boolean;
  graphic_id: number | boolean;
  format_version: number;
  unique?: UniqueItemRef;
  defense?: DefenseStats;
  durability?: DurabilityStats;
  is_personalized?: boolean;
  class_specifics?: boolean;
};

export type Skill = {
  id: number;
  name: string;
  level: number;
};

export type RealSkill = {
  skill: string;
  level: number;
  baseLevel: number;
};

export type CharacterClass = {
  id: number;
  name: string;
};

export type CharacterAttributes = {
  vitality: number;
  strength: number;
  dexterity: number;
  energy: number;
};

export type CharacterPoints = {
  stat: number;
  skill: number;
};

export type CharacterGold = {
  stash: number;
  character: number;
  total: number;
};

export type CharacterStatus = {
  is_dead: boolean;
  is_ladder: boolean;
  is_hardcore: HardcoreStatus;
  is_expansion: boolean;
};

export type CharacterMeta = {
  name: string;
  level: number;
  class: CharacterClass;
  life: number;
  mana: number;
  stamina: number;
  experience: number;
  attributes: CharacterAttributes;
  points: CharacterPoints;
  gold: CharacterGold;
  status: CharacterStatus;
  skills: Skill[];
};

export type Mercenary = {
  id: number;
  name: string;
  type: number;
  experience: number;
  description: string;
  name_id: number;
  items: Item[];
};

export type FileMetadata = {
  header: number;
  version: number;
  checksum: number;
  filesize: number;
  updated_at: number;
};

export type Character = {
  accountName: string;
  character: CharacterMeta;
  realSkills: RealSkill[];
  items: Item[];
  mercenary: Mercenary;
  file: FileMetadata;
  lastUpdated: number;
};

export type SnapshotEnvelope = {
  fetchedAt: number;
  filters: string;
  pagesFetched: number;
  sampleSize: number;
  populationTotal: number;
  characters: Character[];
};
