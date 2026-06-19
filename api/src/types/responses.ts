import { ICharacter } from "./character";
import { IItem } from "./item";
import { IMercenary } from "./mercenary";
import { DamageCalculation } from "./damage";
import { CharStats } from "./stats";

export interface CalculatedSkillLevel {
  skill: string;
  level: number;
  baseLevel?: number;
}

export interface CharacterResponse {
  character: ICharacter | null;
  mercenary?: IMercenary | null;
  items: IItem[] | null;
  nullReason?: string;
  realSkills?: CalculatedSkillLevel[];
  realStats?: CharStats;
  damageCalculation?: DamageCalculation;
  lastUpdated?: number;
  accountName?: string;
  [key: string]: unknown;
}

export interface CharacterData extends CharacterResponse {
  character: ICharacter;
  items: IItem[];
}
