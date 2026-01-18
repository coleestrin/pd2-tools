import { CharacterData, CharStats } from "../types";

export default class CharacterStatParser {
  private character: CharacterData;
  private characterStats: CharStats;

  constructor(character: CharacterData) {
    this.character = character;

    const ANYA_RES = 10 * 3;
    const BASE_MAX_RES = 75;
    const HELL_PENALTY = -100;

    this.characterStats = {
      fireRes: ANYA_RES + HELL_PENALTY,
      maxFireRes: BASE_MAX_RES,
      coldRes: ANYA_RES + HELL_PENALTY,
      maxColdRes: BASE_MAX_RES,
      lightningRes: ANYA_RES + HELL_PENALTY,
      maxLightningRes: BASE_MAX_RES,
      poisonRes: ANYA_RES + HELL_PENALTY,
      maxPoisonRes: BASE_MAX_RES,

      strength: character.character.attributes.strength,
      dexterity: character.character.attributes.dexterity,
      vitality: character.character.attributes.vitality,
      energy: character.character.attributes.energy,

      fcr: 0,
      ias: 0, //wont include barb passives or any else that inc ias that isn't on items
      mf: 0,
      gf: 0,
      frw: 0,
      pdr: 0,
      fhr: 0,

      cb: 0,
      ds: 0,
      ll: 0,
      ml: 0,
      pp: 0, 
      ow: 0,
      cs: 0,
      hppk: 0,
      mppk: 0,

      lAbsorbPct: 0,
      lAbsorbFlat: 0,

      cAbsorbPct: 0,
      cAbsorbFlat: 0,

      fAbsorbPct: 0,
      fAbsorbFlat: 0,
    };
  }

  private matchInt(regex: RegExp, teststr: string | null): number | null {
    if (!teststr) return null;
    const match = teststr.match(regex);

    if (match) return parseInt(match[1]);
    else return null;
  }

  public parseAndGetCharStats(): CharStats {
    for (const item of this.character.items) {
      if (
        item.location.equipment === "Left Hand Switch" ||
        item.location.equipment === "Right Hand Switch"
      ) {
        continue;
      }

      for (const property of item.properties) {
        // All Resistances (applies to all)
        const allRes = this.matchInt(/All Resistances \+(\d+)%/, property);
        if (allRes) {
          //			console.log(`applied ${allRes} allres`);
          this.characterStats.coldRes += allRes;
          this.characterStats.fireRes += allRes;
          this.characterStats.lightningRes += allRes;
          this.characterStats.poisonRes += allRes;
          continue;
        }
        const poisonRes = this.matchInt(/Poison Resist (\d+)%/, property);
        if (poisonRes) {
          //	console.log(`applied ${poisonRes} poisonres`);
          this.characterStats.poisonRes += poisonRes;
          continue;
        }
        const maxPoisonRes = this.matchInt(
          /(\d+)% to Maximum Poison Resist/,
          property
        );
        if (maxPoisonRes) {
          this.characterStats.maxPoisonRes += maxPoisonRes;
          continue;
        }
        // Cold Resistance
        const coldRes = this.matchInt(/Cold Resist (\d+)%/, property);
        if (coldRes) {
          //			console.log(`applied ${coldRes} coldres`)
          this.characterStats.coldRes += coldRes;
          continue;
        }

        const maxColdRes = this.matchInt(
          /(\d+)% to Maximum Cold Resist/,
          property
        );
        if (maxColdRes) {
          this.characterStats.maxColdRes += maxColdRes;
          continue;
        }

        // Fire Resistance
        const fireRes = this.matchInt(/Fire Resist (\d+)%/, property);
        if (fireRes) {
          //			console.log(`applied ${fireRes} fireres`);
          this.characterStats.fireRes += fireRes;
          continue;
        }

        const maxFireRes = this.matchInt(
          /(\d+)% to Maximum Fire Resist/,
          property
        );
        if (maxFireRes) {
          this.characterStats.maxFireRes += maxFireRes;
          continue;
        }

        // Lightning Resistance
        const lightningRes = this.matchInt(/Lightning Resist (\d+)%/, property);
        if (lightningRes) {
          //			console.log(`applied ${lightningRes} lightres`);
          this.characterStats.lightningRes += lightningRes;
          continue;
        }

        const maxLightningRes = this.matchInt(
          /(\d+)% to Maximum Lightning Resist/,
          property
        );
        if (maxLightningRes) {
          this.characterStats.maxLightningRes += maxLightningRes;
          continue;
        }

        // Attributes
        const dexterity = this.matchInt(/\+(\d+) to Dexterity/, property);
        if (dexterity) {
          this.characterStats.dexterity += dexterity;
          continue;
        }

        const strength = this.matchInt(/\+(\d+) to Strength/, property);
        if (strength) {
          this.characterStats.strength += strength;
          continue;
        }

        const energy = this.matchInt(/\+(\d+) to Energy/, property);
        if (energy) {
          this.characterStats.energy += energy;
          continue;
        }

        const vitality = this.matchInt(/\+(\d+) to Vitality/, property);
        if (vitality) {
          this.characterStats.vitality += vitality;
          continue;
        }

        // Speed Stats
        const ias = this.matchInt(/(\d+)% Increased Attack Speed/, property);
        if (ias) {
          this.characterStats.ias += ias;
          continue;
        }

        const fcr = this.matchInt(/(\d+)% Faster Cast Rate/, property);
        if (fcr) {
          this.characterStats.fcr += fcr;
          continue;
        }

        const frw = this.matchInt(/(\d+)% Faster Run\/Walk/, property);
        if (frw) {
          this.characterStats.frw += frw;
          continue;
        }

        // Physical Damage Reduction
        const pdr = this.matchInt(
          /Physical Damage Taken Reduced by (\d+)%/,
          property
        );
        if (pdr) {
          this.characterStats.pdr += pdr;
          continue;
        }

        // Absorb Percentage
        const fireAbsPct = this.matchInt(/Fire Absorb (\d+)%/, property);
        if (fireAbsPct) {
          this.characterStats.fAbsorbPct += fireAbsPct;
          continue;
        }

        const coldAbsPct = this.matchInt(/Cold Absorb (\d+)%/, property);
        if (coldAbsPct) {
          this.characterStats.cAbsorbPct += coldAbsPct;
          continue;
        }

        const lightAbsPct = this.matchInt(/Lightning Absorb (\d+)%/, property);
        if (lightAbsPct) {
          this.characterStats.lAbsorbPct += lightAbsPct;
          continue;
        }

        // Absorb Flat Amount
        const fireAbsFlat = this.matchInt(/\+(\d+) Fire Absorb/, property);
        if (fireAbsFlat) {
          this.characterStats.fAbsorbFlat += fireAbsFlat;
          continue;
        }

        const coldAbsFlat = this.matchInt(/\+(\d+) Cold Absorb/, property);
        if (coldAbsFlat) {
          this.characterStats.cAbsorbFlat += coldAbsFlat;
          continue;
        }

        const lightAbsFlat = this.matchInt(
          /\+(\d+) Lightning Absorb/,
          property
        );
        if (lightAbsFlat) {
          this.characterStats.lAbsorbFlat += lightAbsFlat;
          continue;
        }

        // Gold and Magic Find
        const goldFind = this.matchInt(
          /(\d+)% Extra Gold from Monsters/,
          property
        );
        if (goldFind) {
          this.characterStats.gf += goldFind;
          continue;
        }

        const magicFind = this.matchInt(
          /(\d+)% Better Chance of Getting Magic Items/,
          property
        );
        if (magicFind) {
          if (item.name === "Enigma") continue;
          this.characterStats.mf += magicFind;
          continue;
        }

        const fhr = this.matchInt(/(\d+)% Faster Hit Recovery/, property);
        if (fhr) {
          this.characterStats.fhr += fhr;
          continue;
        }

        const cb = this.matchInt(/(\d+)% Chance of Crushing Blow/, property);
        if (cb) {
          this.characterStats.cb += cb;
          continue;
        }

        const ds = this.matchInt(/(\d+)% Deadly Strike/, property);
        if (ds) {
          this.characterStats.ds += ds;
          continue;
        }

        const ll = this.matchInt(/(\d+)% Life stolen per hit/, property);
        if (ll) {
          this.characterStats.ll += ll;
          continue;
        }

        const ml = this.matchInt(/(\d+)% Mana stolen per hit/, property);
        if (ml) {
          this.characterStats.ml += ml;
          continue;
        }

        const ow = this.matchInt(/(\d+)% Chance of Open Wounds/, property);
        if (ow) {
          this.characterStats.ow += ow;
          continue;
        } 
        const cs = this.matchInt(/(\d+)% Chance of Critical Strike/, property);
        if (cs) {
          this.characterStats.cs += cs;
          continue;
        }

        const hppk = this.matchInt(/(\d+) to Life after each Kill/, property);
        if (hppk) {
          this.characterStats.hppk += hppk;
          continue;
        }

        const mppk = this.matchInt(/(\d+) to Mana after each Kill/, property);
        if (mppk) {
          this.characterStats.mppk += mppk;
          continue;
        }

        //max res also doesn't include passives from paladin aura skill
      }
    }

    return this.characterStats;
  }
}
