export interface ISize {
  height: number;
  width: number;
}

export interface IRequirements {
  level: number;
  strength?: number;
  dexterity?: number;
}

export interface ICodes {
  normal?: string;
  exceptional?: string;
  elite?: string;
}

export interface IHandDamage {
  minimum?: number;
  maximum?: number;
}

export interface IItemDamage {
  one_handed: IHandDamage;
  two_handed: IHandDamage;
  missile: IHandDamage;
  kick?: IHandDamage;
}

export interface IStatBonus {
  strength?: number;
  dexterity?: number;
}

export interface IBaseItem {
  id: string;
  category: string;
  codes: ICodes;
  name: string;
  stackable: boolean;
  type: string;
  type_code: string;
  size: ISize;
  requirements: IRequirements;
  class?: {
    base_code: string;
    "2hd_code": string;
    base: string;
    "2hd": string;
  };
  damage?: IItemDamage;
  stat_bonus?: IStatBonus;
}

export interface IItemQuality {
  id: number;
  name: string;
}

export interface IUniqueItem {
  id: number;
  requirements: IRequirements;
}

export interface IRareName {
  prefix_id: number;
  suffix_id: number;
}

export interface IRareItem {
  name: IRareName;
  affixes: (number | boolean)[];
}

export interface IDefense {
  base: number;
  total: number;
}

export interface IDurability {
  maximum: number;
  current: number;
}

export interface IModifier {
  name: string;
  values: (number | string)[];
  label: string;
  priority: number;
  min?: number;
  max?: number;
  corrupted?: boolean;
  desecrated?: boolean;
}

export interface ILocation {
  storage_id: number;
  equipment_id: number;
  zone_id: number;
  zone: string;
  storage: string;
  equipment?: string;
}

export interface IPosition {
  column: number;
  row: number;
}

export interface IModifierLabel {
  secondary_code?: string;
  positive_code: string;
  negative_code: string;
  group: Record<string, never>;
  secondary?: string;
  positive: string;
  negative: string;
}

export interface IModifierDescription {
  function: number;
  priority: number;
  value: number;
  label: IModifierLabel;
}

export interface IRunewordModifier {
  name: string;
  encoding: number;
  description: IModifierDescription;
}

export interface IRuneword {
  key: string;
  name: string;
  modifiers: IRunewordModifier[];
  runes: string[];
}

export interface IItem {
  is_identified: boolean;
  is_socketed: boolean;
  is_new: boolean;
  is_ear: boolean;
  is_starter: boolean;
  is_simple: boolean;
  is_ethereal: boolean;
  is_personalized: boolean;
  is_runeword: boolean;
  base: IBaseItem;
  socketed_count: number;
  id: number | string;
  item_level: number;
  quality: IItemQuality;
  graphic_id: number | boolean;
  class_specifics: number | boolean;
  unique?: IUniqueItem;
  rare?: IRareItem;
  runeword?: IRuneword;
  personalization?: string[];
  defense?: IDefense;
  durability?: IDurability;
  socket_count: number;
  modifiers: IModifier[];
  socketed?: IItem[];
  name: string;
  location: ILocation;
  position: IPosition;
  category: string;
  base_code: string;
  requirements: IRequirements;
  corrupted: boolean;
  corruptions?: string[];
  desecrated: boolean;
  desecrations?: string[];
  properties: (string | null)[];
  hash: string;
  damage?: IItemDamage;
}
