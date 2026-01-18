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

      fasterCastRate: 0,
      increasedAttackSpeed: 0, //wont include barb passives or any else that inc ias that isn't on items
      magicFind: 0,
      goldFind: 0,
      fasterRunWalk: 0,
      physicalDamageReduction: 0,
      fasterHitRecovery: 0,

      crushingBlow: 0,
      deadlyStrike: 0,
      lifeLeech: 0,
      manaLeech: 0,
      openWounds: 0,
      openWoundsDPS: 0,
      hpPerKill: 0,
      mpPerKill: 0,

      lAbsorbPct: 0,
      lAbsorbFlat: 0,
      cAbsorbPct: 0,
      cAbsorbFlat: 0,
      fAbsorbPct: 0,
      fAbsorbFlat: 0,
      mAbsorbFlat: 0,

      fireSkillDamage: 0,
      coldSkillDamage: 0,
      lightningSkillDamage: 0,
      poisonSkillDamage: 0,

      firePierce: 0,
      coldPierce: 0,
      lightningPierce: 0,
      poisonPierce: 0,
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
          this.characterStats.increasedAttackSpeed += ias;
          continue;
        }

        const fcr = this.matchInt(/(\d+)% Faster Cast Rate/, property);
        if (fcr) {
          this.characterStats.fasterCastRate += fcr;
          continue;
        }

        const frw = this.matchInt(/(\d+)% Faster Run\/Walk/, property);
        if (frw) {
          this.characterStats.fasterRunWalk += frw;
          continue;
        }

        // Physical Damage Reduction
        const pdr = this.matchInt(
          /Physical Damage Taken Reduced by (\d+)%/,
          property
        );
        if (pdr) {
          this.characterStats.physicalDamageReduction += pdr;
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

        const magicAbsFlat = this.matchInt(/\+(\d+) Magic Absorb/, property);
        if (magicAbsFlat) {
          this.characterStats.mAbsorbFlat += magicAbsFlat;
          continue;
        }

        // Gold and Magic Find
        const goldFind = this.matchInt(
          /(\d+)% Extra Gold from Monsters/,
          property
        );
        if (goldFind) {
          this.characterStats.goldFind += goldFind;
          continue;
        }

        const magicFind = this.matchInt(
          /(\d+)% Better Chance of Getting Magic Items/,
          property
        );
        if (magicFind) {
          if (item.name === "Enigma") continue;
          this.characterStats.magicFind += magicFind;
          continue;
        }

        const fasterHitRecovery = this.matchInt(/(\d+)% Faster Hit Recovery/, property);
        if (fasterHitRecovery) {
          this.characterStats.fasterHitRecovery += fasterHitRecovery;
          continue;
        }

        const crushingBlow = this.matchInt(/(\d+)% Chance of Crushing Blow/, property);
        if (crushingBlow) {
          this.characterStats.crushingBlow += crushingBlow;
          continue;
        }

        const deadlyStrike = this.matchInt(/(\d+)% Deadly Strike/, property);
        if (deadlyStrike) {
          this.characterStats.deadlyStrike += deadlyStrike;
          continue;
        }

        const lifeLeech = this.matchInt(/(\d+)% Life stolen per hit/, property);
        if (lifeLeech) {
          this.characterStats.lifeLeech += lifeLeech;
          continue;
        }

        const manaLeech = this.matchInt(/(\d+)% Mana stolen per hit/, property);
        if (manaLeech) {
          this.characterStats.manaLeech += manaLeech;
          continue;
        }

        const openWounds = this.matchInt(/(\d+)% Chance of Open Wounds/, property);
        if (openWounds) {
          this.characterStats.openWounds += openWounds;
          continue;
        }

        const openWoundsDPS = this.matchInt(/(\d+) Open Wounds Damage Per Second/, property);
        if (openWoundsDPS) {
          this.characterStats.openWoundsDPS += openWoundsDPS;
          continue;
        }

        const hpPerKill = this.matchInt(/(\d+) Life after each Kill/, property);
        if (hpPerKill) {
          this.characterStats.hpPerKill += hpPerKill;
          continue;
        }

        const mpPerKill = this.matchInt(/(\d+) to Mana after each Kill/, property);
        if (mpPerKill) {
          this.characterStats.mpPerKill += mpPerKill;
          continue;
        }

        const fireSkillDamage = this.matchInt(/(\d+)% to Fire Skill Damage/, property);
        if (fireSkillDamage) {
          this.characterStats.fireSkillDamage += fireSkillDamage;
          continue;
        }

        const coldSkillDamage = this.matchInt(/(\d+)% to Cold Skill Damage/, property);
        if (coldSkillDamage) {
          this.characterStats.coldSkillDamage += coldSkillDamage;
          continue;
        }

        const lightningSkillDamage = this.matchInt(/(\d+)% to Lightning Skill Damage/, property);
        if (lightningSkillDamage) {
          this.characterStats.lightningSkillDamage += lightningSkillDamage;
          continue;
        }

        const poisonSkillDamage = this.matchInt(/(\d+)% to Poison Skill Damage/, property);
        if (poisonSkillDamage) {
          this.characterStats.poisonSkillDamage += poisonSkillDamage;
          continue;
        }

        //Elemental Pierce currently does not take into account skills like Cold Mastery
        const firePierce = this.matchInt(/(\d+)% to Enemy Fire Resistance/, property);
        if (firePierce) {
          this.characterStats.firePierce -= firePierce;
          continue;
        }

        const coldPierce = this.matchInt(/(\d+)% to Enemy Cold Resistance/, property);
        if (coldPierce) {
          this.characterStats.coldPierce -= coldPierce;
          continue;
        }

        const lightningPierce = this.matchInt(/(\d+)% to Enemy Lightning Resistance/, property);
        if (lightningPierce) {
          this.characterStats.lightningPierce -= lightningPierce;
          continue;
        }

        const poisonPierce = this.matchInt(/(\d+)% to Enemy Poison Resistance/, property);
        if (poisonPierce) {
          this.characterStats.poisonPierce -= poisonPierce;
          continue;
        }

        //max res also doesn't include passives from paladin aura skill
      }
    }

    return this.characterStats;
  }
}
