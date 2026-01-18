export interface CharStats {
  //Resists
  fireRes: number;
  maxFireRes: number;
  coldRes: number;
  maxColdRes: number;
  lightningRes: number;
  maxLightningRes: number;
  poisonRes: number;
  maxPoisonRes: number;

  //Stats
  strength: number;
  dexterity: number;
  vitality: number;
  energy: number;

  //Speed
  fasterCastRate: number;
  increasedAttackSpeed: number;
  fasterHitRecovery: number;
  fasterRunWalk: number;

  //Damage Procs
  crushingBlow: number;
  deadlyStrike: number;
  openWounds: number;
  criticalStrike: number;

  //Defensive
  physicalDamageReduction: number;

  //Rewards
  magicFind: number;
  goldFind: number;

  //Leech
  lifeLeech: number;
  manaLeech: number;
  hpPerKill: number;
  mpPerKill: number;

  //Absorb
  lAbsorbPct: number;
  lAbsorbFlat: number;
  cAbsorbPct: number;
  cAbsorbFlat: number;
  fAbsorbPct: number;
  fAbsorbFlat: number;
  mAbsorbFlat: number;

  //Elemental Pierce  
  firePierce: number;
  coldPierce: number;
  lightningPierce: number;
  poisonPierce: number;
}
