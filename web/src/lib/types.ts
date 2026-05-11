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

// CONFIRMED: From character.status.is_hardcore. Values observed: true | false
export type HardcoreStatus = boolean;

// CONFIRMED: From quality objects. All items have a quality object with id + name fields.
// Observed quality names: "Normal", "Superior", "Magic", "Rare", "Set", "Unique", "Crafted"
// Superior has optional sub_id field (e.g., sub_id: 1, 2, 7)
export type QualityName =
  | "Normal"
  | "Magic"
  | "Rare"
  | "Set"
  | "Unique"
  | "Crafted"
  | "Superior";

export type ItemQuality = {
  // CONFIRMED: id is a number (2-8 range observed)
  id: number;
  // CONFIRMED: name is one of the quality names
  name: QualityName;
  // CONFIRMED: present on Superior quality items only; optional
  sub_id?: number;
};

// CONFIRMED: Each item base object contains these fields
export type ItemBase = {
  // CONFIRMED: item base identifier (e.g., "amu" for amulet)
  id: string;
  // CONFIRMED: display name (e.g., "Amulet")
  name: string;
  // CONFIRMED: item category (e.g., "misc", "armor", "weapon")
  type: string;
  // CONFIRMED: item type code (e.g., "amul", "armo", "weap")
  type_code: string;
  // CONFIRMED: item category enum
  category: string;
  // CONFIRMED: width and height dimensions
  size: {
    width: number;
    height: number;
  };
  // CONFIRMED: codes for different rarity tiers
  codes: {
    normal: string;
    exceptional: string;
    elite: string;
  };
  // CONFIRMED: whether item is stackable
  stackable: boolean;
  // CONFIRMED: requirements object with level, strength, dexterity
  requirements: {
    level?: number;
    strength?: number;
    dexterity?: number;
  };
};

// CONFIRMED: Modifier object shape from items[].modifiers[]
// Sample modifier: { name: "item_addskill_tab", label: "+3 to Summoning Skills (Druid Only)", values: [40, 3], priority: 151 }
// Some have optional min/max range fields (observed on item_goldbonus, tohit)
export type ItemModifier = {
  // CONFIRMED: modifier key/id (e.g., "item_addskill_tab", "item_fastercastrate")
  name: string;
  // CONFIRMED: human-readable label (e.g., "+3 to Summoning Skills (Druid Only)")
  label: string;
  // CONFIRMED: array of numbers; can be single value or multiple (min, max, param)
  values: number[];
  // CONFIRMED: priority number for display ordering
  priority: number;
  // CONFIRMED: optional min/max for range modifiers (observed on item_goldbonus, tohit)
  min?: number;
  max?: number;
};

// CONFIRMED: Location object shape from items[].location
export type ItemLocation = {
  // CONFIRMED: zone name (e.g., "Equipped", storage zone names)
  zone: string;
  // CONFIRMED: storage type (e.g., "Unknown", "Inventory")
  storage: string;
  // CONFIRMED: zone id number
  zone_id: number;
  // CONFIRMED: equipment slot name (e.g., "Amulet", "Head")
  equipment: string;
  // CONFIRMED: storage id number
  storage_id: number;
  // CONFIRMED: equipment id number
  equipment_id: number;
};

// CONFIRMED: Position object shape from items[].position
export type ItemPosition = {
  // CONFIRMED: row index in inventory
  row: number;
  // CONFIRMED: column index in inventory
  column: number;
};

// CONFIRMED: Unique item reference object
// Observed: { id: 442, requirements: { level: 38 } } when item is unique
export type UniqueItemRef = {
  // CONFIRMED: unique item id (varies by item)
  id: number;
  // CONFIRMED: requirements specific to unique variant
  requirements: {
    level?: number;
    strength?: number;
    dexterity?: number;
  };
};

// CONFIRMED: Defense object shape on armor items
export type DefenseStats = {
  // CONFIRMED: base defense value
  base: number;
  // CONFIRMED: total defense including affixes
  total: number;
};

// CONFIRMED: Durability object shape on weapons/armor
export type DurabilityStats = {
  // CONFIRMED: current durability
  current: number;
  // CONFIRMED: maximum durability
  maximum: number;
};

// CONFIRMED: Requirements object shape on items[].requirements
export type ItemRequirements = {
  // CONFIRMED: level requirement
  level?: number;
  // CONFIRMED: strength requirement
  strength?: number;
  // CONFIRMED: dexterity requirement
  dexterity?: number;
};

// CONFIRMED: Item object shape from characters[].items[]
// Contains all fields actually present in snapshot
export type Item = {
  // CONFIRMED: unique item id number
  id: number;
  // CONFIRMED: item base data
  base: ItemBase;
  // CONFIRMED: item hash (SHA-256 hex string)
  hash: string;
  // CONFIRMED: quality object with id and name
  quality: ItemQuality;
  // CONFIRMED: item name (for unique/set/crafted items)
  name?: string;
  // CONFIRMED: item location in character inventory/equipment
  location: ItemLocation;
  // CONFIRMED: position within zone/storage
  position: ItemPosition;
  // CONFIRMED: base type code (shorthand for base.type_code)
  base_code: string;
  // CONFIRMED: item category (duplicate of base.category)
  category: string;
  // CONFIRMED: list of modifiers/affixes
  modifiers: ItemModifier[];
  // CONFIRMED: display properties (human-readable descriptions)
  properties: string[];
  // CONFIRMED: item level (1-255)
  item_level: number;
  // CONFIRMED: requirements for using item
  requirements: ItemRequirements;
  // CONFIRMED: whether item is identified
  is_identified: boolean;
  // CONFIRMED: whether item is ethereal
  is_ethereal: boolean;
  // CONFIRMED: whether item is a runeword
  is_runeword: boolean;
  // CONFIRMED: whether item is socketed (has sockets)
  is_socketed: boolean;
  // CONFIRMED: number of available sockets
  socket_count: number;
  // CONFIRMED: number of filled sockets
  socketed_count: number;
  // CONFIRMED: whether item is corrupted (has corruption mods)
  corrupted: boolean;
  // CONFIRMED: whether item is desecrated
  desecrated: boolean;
  // CONFIRMED: whether item is simple (no affixes)
  is_simple: boolean;
  // CONFIRMED: whether item is an ear
  is_ear: boolean;
  // CONFIRMED: whether item is newly found
  is_new: boolean;
  // CONFIRMED: whether item is a starter item
  is_starter: boolean;
  // CONFIRMED: graphic display id (usually boolean or number)
  graphic_id: number | boolean;
  // CONFIRMED: D2 file format version
  format_version: number;
  // CONFIRMED: unique item reference (if quality is Unique)
  unique?: UniqueItemRef;
  // CONFIRMED: defense stats (on armor items)
  defense?: DefenseStats;
  // CONFIRMED: durability stats (on weapons/armor)
  durability?: DurabilityStats;
  // CONFIRMED: whether item is personalized
  is_personalized?: boolean;
  // CONFIRMED: whether item has class-specific properties
  class_specifics?: boolean;
};

// CONFIRMED: Skill object shape
export type Skill = {
  // CONFIRMED: skill id number
  id: number;
  // CONFIRMED: skill name
  name: string;
  // CONFIRMED: skill level (1-99)
  level: number;
};

// CONFIRMED: Real skill object shape (from realSkills[])
export type RealSkill = {
  // CONFIRMED: skill name
  skill: string;
  // CONFIRMED: skill level
  level: number;
  // CONFIRMED: base level without bonuses
  baseLevel: number;
};

// CONFIRMED: Character class object
export type CharacterClass = {
  // CONFIRMED: class id (0-6 for 7 D2 classes)
  id: number;
  // CONFIRMED: class name
  name: string;
};

// CONFIRMED: Character attributes object
export type CharacterAttributes = {
  // CONFIRMED: vitality attribute
  vitality: number;
  // CONFIRMED: strength attribute
  strength: number;
  // CONFIRMED: dexterity attribute
  dexterity: number;
  // CONFIRMED: energy attribute
  energy: number;
};

// CONFIRMED: Character points object
export type CharacterPoints = {
  // CONFIRMED: stat points remaining
  stat: number;
  // CONFIRMED: skill points remaining
  skill: number;
};

// CONFIRMED: Character gold storage object
export type CharacterGold = {
  // CONFIRMED: gold in stash
  stash: number;
  // CONFIRMED: gold on character
  character: number;
  // CONFIRMED: total gold (stash + character)
  total: number;
};

// CONFIRMED: Character status object
export type CharacterStatus = {
  // CONFIRMED: whether character is dead
  is_dead: boolean;
  // CONFIRMED: whether character is on ladder
  is_ladder: boolean;
  // CONFIRMED: whether character is hardcore
  is_hardcore: HardcoreStatus;
  // CONFIRMED: whether character is expansion
  is_expansion: boolean;
};

// CONFIRMED: Character metadata object (nested within Character)
export type CharacterMeta = {
  // CONFIRMED: character name
  name: string;
  // CONFIRMED: character level (1-99)
  level: number;
  // CONFIRMED: character class
  class: CharacterClass;
  // CONFIRMED: current life
  life: number;
  // CONFIRMED: current mana
  mana: number;
  // CONFIRMED: stamina
  stamina: number;
  // CONFIRMED: experience points
  experience: number;
  // CONFIRMED: character attributes (vitality, strength, dexterity, energy)
  attributes: CharacterAttributes;
  // CONFIRMED: remaining stat and skill points
  points: CharacterPoints;
  // CONFIRMED: gold storage
  gold: CharacterGold;
  // CONFIRMED: character status flags
  status: CharacterStatus;
  // CONFIRMED: learned skills array
  skills: Skill[];
};

// CONFIRMED: Mercenary object shape
export type Mercenary = {
  // CONFIRMED: mercenary id
  id: number;
  // CONFIRMED: mercenary name
  name: string;
  // CONFIRMED: mercenary type (act number or similar)
  type: number;
  // CONFIRMED: mercenary experience
  experience: number;
  // CONFIRMED: mercenary description
  description: string;
  // CONFIRMED: mercenary name_id (for display variants)
  name_id: number;
  // CONFIRMED: mercenary items array
  items: Item[];
};

// CONFIRMED: File metadata object
export type FileMetadata = {
  // CONFIRMED: file header value
  header: number;
  // CONFIRMED: file version
  version: number;
  // CONFIRMED: file checksum
  checksum: number;
  // CONFIRMED: file size in bytes
  filesize: number;
  // CONFIRMED: last update timestamp
  updated_at: number;
};

// CONFIRMED: Character object shape from characters[]
export type Character = {
  // CONFIRMED: account name
  accountName: string;
  // CONFIRMED: character metadata
  character: CharacterMeta;
  // CONFIRMED: real skills (with base level)
  realSkills: RealSkill[];
  // CONFIRMED: character items array
  items: Item[];
  // CONFIRMED: mercenary data
  mercenary: Mercenary;
  // CONFIRMED: file metadata
  file: FileMetadata;
  // CONFIRMED: last updated timestamp
  lastUpdated: number;
};

// CONFIRMED: Snapshot envelope object (top level of data/snapshot.json)
export type SnapshotEnvelope = {
  // CONFIRMED: when snapshot was fetched (unix timestamp)
  fetchedAt: number;
  // CONFIRMED: filter query string used
  filters: string;
  // CONFIRMED: number of pages fetched
  pagesFetched: number;
  // CONFIRMED: sample size (number of characters)
  sampleSize: number;
  // CONFIRMED: total population count
  populationTotal: number;
  // CONFIRMED: array of characters
  characters: Character[];
};
