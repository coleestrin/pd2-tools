export interface IStatus {
  is_hardcore: boolean;
  is_dead: boolean;
  is_expansion: boolean;
  is_ladder: boolean;
}

export interface IClassInfo {
  id: number;
  name: string;
}

export interface IAttributes {
  strength: number;
  dexterity: number;
  vitality: number;
  energy: number;
}

export interface IGold {
  character: number;
  stash: number;
  total: number;
}

export interface IPoints {
  stat: number;
  skill: number;
}

export interface ISkill {
  id: number;
  name: string;
  level: number;
}

export interface IFile {
  header: number;
  version: number;
  filesize: number;
  checksum: number;
  updated_at: number;
}

export interface IRealSkill {
  skill: string;
  level: number;
  baseLevel: number;
}

export interface ICharacter {
  name: string;
  status: IStatus;
  class: IClassInfo;
  attributes: IAttributes;
  gold: IGold;
  points: IPoints;
  life: number;
  mana: number;
  stamina: number;
  experience: number;
  level: number;
  skills: ISkill[];
  season: number; // Season number (e.g., 13 for S13)
}
