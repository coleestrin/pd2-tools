import { CharacterResponse, SkillDefinition, SkillBonus } from "../types";

class D2SkillParser {
  private readonly debug: boolean;
  //private readonly skillDefinitions: SkillDefinition[];

  constructor(debug: boolean = false) {
    this.debug = debug;
  }
  private readonly skillDefinitions: SkillDefinition[] = [
    // Amazon Skills
    {
      name: "Magic Arrow",
      categories: ["bow and crossbow skills", "amazon skills", "magic arrow"],
    },
    {
      name: "Fire Arrow",
      categories: [
        "bow and crossbow skills",
        "amazon skills",
        "fire arrow",
        "fire skills",
      ],
    },
    {
      name: "Inner Sight",
      categories: ["passive and magic skills", "amazon skills", "inner sight"],
    },
    {
      name: "Critical Strike",
      categories: [
        "passive and magic skills",
        "amazon skills",
        "critical strike",
      ],
    },
    {
      name: "Jab",
      categories: ["javelin and spear skills", "amazon skills", "jab"],
    },
    {
      name: "Cold Arrow",
      categories: [
        "bow and crossbow skills",
        "amazon skills",
        "cold arrow",
        "cold skills",
      ],
    },
    {
      name: "Multiple Shot",
      categories: ["bow and crossbow skills", "amazon skills", "multiple shot"],
    },
    {
      name: "Dodge",
      categories: ["passive and magic skills", "amazon skills", "dodge"],
    },
    {
      name: "Power Strike",
      categories: [
        "javelin and spear skills",
        "amazon skills",
        "power strike",
        "lightning skills",
      ],
    },
    {
      name: "Poison Javelin",
      categories: [
        "javelin and spear skills",
        "amazon skills",
        "poison javelin",
        "poison skills",
      ],
    },
    {
      name: "Exploding Arrow",
      categories: [
        "bow and crossbow skills",
        "amazon skills",
        "exploding arrow",
        "fire skills",
      ],
    },
    {
      name: "Slow Missiles",
      categories: [
        "passive and magic skills",
        "amazon skills",
        "slow missiles",
      ],
    },
    {
      name: "Avoid",
      categories: ["passive and magic skills", "amazon skills", "avoid"],
    },
    {
      name: "Impale",
      categories: ["javelin and spear skills", "amazon skills", "impale"],
    },
    {
      name: "Lightning Bolt",
      categories: [
        "javelin and spear skills",
        "amazon skills",
        "lightning bolt",
        "lightning skills",
      ],
    },
    {
      name: "Ice Arrow",
      categories: [
        "bow and crossbow skills",
        "amazon skills",
        "ice arrow",
        "cold skills",
      ],
    },
    {
      name: "Guided Arrow",
      categories: ["bow and crossbow skills", "amazon skills", "guided arrow"],
    },
    {
      name: "Penetrate",
      categories: ["passive and magic skills", "amazon skills", "penetrate"],
    },
    {
      name: "Charged Strike",
      categories: [
        "javelin and spear skills",
        "amazon skills",
        "charged strike",
        "lightning skills",
      ],
    },
    {
      name: "Plague Javelin",
      categories: [
        "javelin and spear skills",
        "amazon skills",
        "plague javelin",
        "poison skills",
      ],
    },
    {
      name: "Strafe",
      categories: ["bow and crossbow skills", "amazon skills", "strafe"],
    },
    {
      name: "Immolation Arrow",
      categories: [
        "bow and crossbow skills",
        "amazon skills",
        "immolation arrow",
        "fire skills",
      ],
    },
    {
      name: "Decoy",
      categories: ["passive and magic skills", "amazon skills", "decoy"],
    },
    {
      name: "Evade",
      categories: ["passive and magic skills", "amazon skills", "evade"],
    },
    {
      name: "Fend",
      categories: ["javelin and spear skills", "amazon skills", "fend"],
    },
    {
      name: "Freezing Arrow",
      categories: [
        "bow and crossbow skills",
        "amazon skills",
        "freezing arrow",
        "cold skills",
      ],
    },
    {
      name: "Valkyrie",
      categories: ["passive and magic skills", "amazon skills", "valkyrie"],
    },
    {
      name: "Pierce",
      categories: ["passive and magic skills", "amazon skills", "pierce"],
    },
    {
      name: "Lightning Strike",
      categories: [
        "javelin and spear skills",
        "amazon skills",
        "lightning strike",
        "lightning skills",
      ],
    },
    {
      name: "Lightning Fury",
      categories: [
        "javelin and spear skills",
        "amazon skills",
        "lightning fury",
        "lightning skills",
      ],
    },

    // Assassin Skills
    {
      name: "Fire Blast",
      categories: [
        "trap skills",
        "assassin skills",
        "fire blast",
        "fire skills",
      ],
    },
    {
      name: "Tiger Strike",
      categories: ["martial arts", "assassin skills", "tiger strike"],
    },
    {
      name: "Dragon Talon",
      categories: ["martial arts", "assassin skills", "dragon talon"],
    },
    {
      name: "Claw Mastery",
      categories: ["martial arts", "assassin skills", "claw mastery"],
    },
    {
      name: "Psychic Hammer",
      categories: ["shadow disciplines", "assassin skills", "psychic hammer"],
    },
    {
      name: "Shock Web",
      categories: [
        "trap skills",
        "assassin skills",
        "shock web",
        "lightning skills",
      ],
    },
    {
      name: "Blade Sentinel",
      categories: ["trap skills", "assassin skills", "blade sentinel"],
    },
    {
      name: "Burst of Speed",
      categories: ["shadow disciplines", "assassin skills", "burst of speed"],
    },
    {
      name: "Fists of Fire",
      categories: [
        "martial arts",
        "assassin skills",
        "fists of fire",
        "fire skills",
      ],
    },
    {
      name: "Dragon Claw",
      categories: ["martial arts", "assassin skills", "dragon claw"],
    },
    {
      name: "Charged Bolt Sentry",
      categories: [
        "trap skills",
        "assassin skills",
        "charged bolt sentry",
        "lightning skills",
      ],
    },
    {
      name: "Wake of Fire",
      categories: [
        "trap skills",
        "assassin skills",
        "wake of fire",
        "fire skills",
      ],
    },
    {
      name: "Weapon Block",
      categories: ["shadow disciplines", "assassin skills", "weapon block"],
    },
    {
      name: "Cloak of Shadows",
      categories: ["shadow disciplines", "assassin skills", "cloak of shadows"],
    },
    {
      name: "Cobra Strike",
      categories: ["martial arts", "assassin skills", "cobra strike"],
    },
    {
      name: "Blade Fury",
      categories: ["martial arts", "assassin skills", "blade fury"],
    },
    {
      name: "Fade",
      categories: ["shadow disciplines", "assassin skills", "fade"],
    },
    {
      name: "Lightning Sentry",
      categories: [
        "trap skills",
        "assassin skills",
        "lightning sentry",
        "lightning skills",
      ],
    },
    {
      name: "Wake of Inferno",
      categories: [
        "trap skills",
        "assassin skills",
        "wake of inferno",
        "fire skills",
      ],
    },
    {
      name: "Mind Blast",
      categories: ["shadow disciplines", "assassin skills", "mind blast"],
    },
    {
      name: "Blades of Ice",
      categories: [
        "martial arts",
        "assassin skills",
        "blades of ice",
        "cold skills",
      ],
    },
    {
      name: "Dragon Flight",
      categories: ["martial arts", "assassin skills", "dragon flight"],
    },
    {
      name: "Death Sentry",
      categories: [
        "trap skills",
        "assassin skills",
        "death sentry",
        "lightning skills",
      ],
    },
    {
      name: "Blade Shield",
      categories: ["trap skills", "assassin skills", "blade shield"],
    },
    {
      name: "Venom",
      categories: [
        "shadow disciplines",
        "assassin skills",
        "venom",
        "poison skills",
      ],
    },
    {
      name: "Shadow Master",
      categories: ["shadow disciplines", "assassin skills", "shadow master"],
    },
    {
      name: "Phoenix Strike",
      categories: [
        "martial arts",
        "assassin skills",
        "phoenix strike",
        "fire skills",
        "lightning skills",
        "cold skills",
      ],
    },
    {
      name: "Dragon Tail",
      categories: [
        "martial arts",
        "assassin skills",
        "dragon tail",
        "fire skills",
      ],
    },

    // Barbarian Skills
    {
      name: "Bash",
      categories: ["combat skills", "barbarian skills", "bash"],
    },
    {
      name: "Sword Mastery",
      categories: ["masteries skills", "barbarian skills", "sword mastery"],
    },
    {
      name: "General Mastery",
      categories: ["masteries skills", "barbarian skills", "general mastery"],
    },
    {
      name: "Axe Mastery",
      categories: ["masteries skills", "barbarian skills", "axe mastery"],
    },
    {
      name: "Mace Mastery",
      categories: ["masteries skills", "barbarian skills", "mace mastery"],
    },
    {
      name: "Howl",
      categories: ["warcries skills", "barbarian skills", "howl"],
    },
    {
      name: "Find Potion",
      categories: ["warcries skills", "barbarian skills", "find potion"],
    },
    {
      name: "Double Swing",
      categories: ["combat skills", "barbarian skills", "double swing"],
    },
    {
      name: "Pole Arm and Spear Mastery",
      categories: [
        "masteries skills",
        "barbarian skills",
        "pole arm and spear mastery",
      ],
    },
    {
      name: "Taunt",
      categories: ["warcries skills", "barbarian skills", "taunt"],
    },
    {
      name: "Shout",
      categories: ["warcries skills", "barbarian skills", "shout"],
    },
    {
      name: "Stun",
      categories: ["combat skills", "barbarian skills", "stun"],
    },
    {
      name: "Double Throw",
      categories: ["combat skills", "barbarian skills", "double throw"],
    },
    {
      name: "Increased Stamina",
      categories: ["masteries skills", "barbarian skills", "increased stamina"],
    },
    {
      name: "Find Item",
      categories: ["warcries skills", "barbarian skills", "find item"],
    },
    {
      name: "Leap",
      categories: ["combat skills", "barbarian skills", "leap"],
    },
    {
      name: "Concentrate",
      categories: ["combat skills", "barbarian skills", "concentrate"],
    },
    {
      name: "Iron Skin",
      categories: ["masteries skills", "barbarian skills", "iron skin"],
    },
    {
      name: "Battle Cry",
      categories: ["warcries skills", "barbarian skills", "battle cry"],
    },
    {
      name: "Frenzy",
      categories: ["combat skills", "barbarian skills", "frenzy"],
    },
    {
      name: "Increased Speed",
      categories: ["masteries skills", "barbarian skills", "increased speed"],
    },
    {
      name: "Battle Orders",
      categories: ["warcries skills", "barbarian skills", "battle orders"],
    },
    {
      name: "Leap Attack",
      categories: ["combat skills", "barbarian skills", "leap attack"],
    },
    {
      name: "Whirlwind",
      categories: ["combat skills", "barbarian skills", "whirlwind"],
    },
    {
      name: "Berserk",
      categories: ["combat skills", "barbarian skills", "berserk"],
    },
    {
      name: "Natural Resistance",
      categories: [
        "masteries skills",
        "barbarian skills",
        "natural resistance",
      ],
    },
    {
      name: "War Cry",
      categories: ["warcries skills", "barbarian skills", "war cry"],
    },
    {
      name: "Battle Command",
      categories: ["warcries skills", "barbarian skills", "battle command"],
    },
    {
      name: "Deep Wounds",
      categories: ["masteries skills", "barbarian skills", "deep wounds"],
    },

    // Druid Skills
    {
      name: "Raven",
      categories: ["summoning skills", "druid skills", "raven"],
    },
    {
      name: "Poison Creeper",
      categories: [
        "summoning skills",
        "druid skills",
        "poison creeper",
        "poison skills",
      ],
    },
    {
      name: "Werewolf",
      categories: ["shape shifting skills", "druid skills", "werewolf"],
    },
    {
      name: "Firestorm",
      categories: [
        "elemental skills",
        "druid skills",
        "firestorm",
        "fire skills",
      ],
    },
    {
      name: "Oak Sage",
      categories: ["summoning skills", "druid skills", "oak sage"],
    },
    {
      name: "Summon Spirit Wolf",
      categories: ["summoning skills", "druid skills", "summon spirit wolf"],
    },
    {
      name: "Werebear",
      categories: ["shape shifting skills", "druid skills", "werebear"],
    },
    {
      name: "Molten Boulder",
      categories: [
        "elemental skills",
        "druid skills",
        "molten boulder",
        "fire skills",
      ],
    },
    {
      name: "Arctic Blast",
      categories: [
        "elemental skills",
        "druid skills",
        "arctic blast",
        "cold skills",
      ],
    },
    {
      name: "Carrion Vine",
      categories: ["summoning skills", "druid skills", "carrion vine"],
    },
    {
      name: "Lycanthropy",
      categories: ["shape shifting skills", "druid skills", "lycanthropy"],
    },
    {
      name: "Fire Claws",
      categories: [
        "shape shifting skills",
        "druid skills",
        "fire claws",
        "fire skills",
      ],
    },
    {
      name: "Twister",
      categories: ["elemental skills", "druid skills", "twister"],
    },
    {
      name: "Solar Creeper",
      categories: ["summoning skills", "druid skills", "solar creeper"],
    },
    {
      name: "Heart of Wolverine",
      categories: ["summoning skills", "druid skills", "heart of wolverine"],
    },
    {
      name: "Summon Dire Wolf",
      categories: ["summoning skills", "druid skills", "summon dire wolf"],
    },
    {
      name: "Rabies",
      categories: [
        "shape shifting skills",
        "druid skills",
        "rabies",
        "poison skills",
      ],
    },
    {
      name: "Fissure",
      categories: [
        "elemental skills",
        "druid skills",
        "fissure",
        "fire skills",
      ],
    },
    {
      name: "Cyclone Armor",
      categories: ["elemental skills", "druid skills", "cyclone armor"],
    },
    {
      name: "Heart of the Oak",
      categories: ["summoning skills", "druid skills", "heart of the oak"],
    },
    {
      name: "Summon Grizzly",
      categories: ["summoning skills", "druid skills", "summon grizzly"],
    },
    {
      name: "Fury",
      categories: ["shape shifting skills", "druid skills", "fury"],
    },
    {
      name: "Volcano",
      categories: [
        "elemental skills",
        "druid skills",
        "volcano",
        "fire skills",
      ],
    },
    {
      name: "Tornado",
      categories: ["elemental skills", "druid skills", "tornado"],
    },
    {
      name: "Spirit of Barbs",
      categories: ["summoning skills", "druid skills", "spirit of barbs"],
    },
    {
      name: "Hurricane",
      categories: [
        "elemental skills",
        "druid skills",
        "hurricane",
        "cold skills",
      ],
    },
    {
      name: "Fire Storm",
      categories: [
        "elemental skills",
        "druid skills",
        "fire storm",
        "fire skills",
      ],
    },
    {
      name: "Hunger",
      categories: ["shape shifting skills", "druid skills", "hunger"],
    },
    {
      name: "Armageddon",
      categories: [
        "elemental skills",
        "druid skills",
        "armageddon",
        "fire skills",
      ],
    },
    {
      name: "Gust",
      categories: ["elemental skills", "druid skills", "gust"],
    },

    // Continuing Necromancer Skills
    {
      name: "Bone Armor",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "bone armor",
      ],
    },
    {
      name: "Skeleton Mastery",
      categories: [
        "summoning skills",
        "necromancer skills",
        "skeleton mastery",
      ],
    },
    {
      name: "Raise Skeleton",
      categories: ["summoning skills", "necromancer skills", "raise skeleton"],
    },
    {
      name: "Dim Vision",
      categories: ["curses skills", "necromancer skills", "dim vision"],
    },
    {
      name: "Poison Dagger",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "poison dagger",
        "poison skills",
      ],
    },
    {
      name: "Corpse Explosion",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "corpse explosion",
        "fire skills",
      ],
    },
    {
      name: "Clay Golem",
      categories: ["summoning skills", "necromancer skills", "clay golem"],
    },
    {
      name: "Iron Maiden",
      categories: ["curses skills", "necromancer skills", "iron maiden"],
    },
    {
      name: "Amplify Damage",
      categories: ["curses skills", "necromancer skills", "amplify damage"],
    },
    {
      name: "Bone Wall",
      categories: ["poison and bone skills", "necromancer skills", "bone wall"],
    },
    {
      name: "Golem Mastery",
      categories: ["summoning skills", "necromancer skills", "golem mastery"],
    },
    {
      name: "Raise Skeletal Mage",
      categories: [
        "summoning skills",
        "necromancer skills",
        "raise skeletal mage",
      ],
    },
    {
      name: "Terror",
      categories: ["curses skills", "necromancer skills", "terror"],
    },
    {
      name: "Bone Spear",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "bone spear",
      ],
    },
    {
      name: "Blood Golem",
      categories: ["summoning skills", "necromancer skills", "blood golem"],
    },
    {
      name: "Confuse",
      categories: ["curses skills", "necromancer skills", "confuse"],
    },
    {
      name: "Poison Explosion",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "poison explosion",
        "poison skills",
      ],
    },
    {
      name: "Bone Prison",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "bone prison",
      ],
    },
    {
      name: "Iron Golem",
      categories: ["summoning skills", "necromancer skills", "iron golem"],
    },
    {
      name: "Lower Resist",
      categories: ["curses skills", "necromancer skills", "lower resist"],
    },
    {
      name: "Curse Mastery",
      categories: ["curses skills", "necromancer skills", "curse mastery"],
    },
    {
      name: "Poison Nova",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "poison nova",
        "poison skills",
      ],
    },
    {
      name: "Bone Spirit",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "bone spirit",
      ],
    },
    {
      name: "Fire Golem",
      categories: [
        "summoning skills",
        "necromancer skills",
        "fire golem",
        "fire skills",
      ],
    },
    {
      name: "Weaken",
      categories: ["curses skills", "necromancer skills", "weaken"],
    },
    {
      name: "Life Tap",
      categories: ["curses skills", "necromancer skills", "life tap"],
    },
    {
      name: "Decrepify",
      categories: ["curses skills", "necromancer skills", "decrepify"],
    },
    // { name: 'Bone Spirit', categories: ['poison and bone skills', 'necromancer skills', 'bone spirit'] },
    {
      name: "Revive",
      categories: ["summoning skills", "necromancer skills", "revive"],
    },
    // New Necromancer Skills
    {
      name: "Blood Warp",
      categories: ["summoning skills", "necromancer skills", "blood warp"],
    },
    {
      name: "Dark Pact",
      categories: ["curses skills", "necromancer skills", "dark pact"],
    },
    {
      name: "Poison Strike",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "poison strike",
        "poison skills",
      ],
    },
    {
      name: "Desecrate",
      categories: [
        "poison and bone skills",
        "necromancer skills",
        "desecrate",
        "poison skills",
      ],
    },
    {
      name: "Raise Skeleton Archer",
      categories: [
        "summoning skills",
        "necromancer skills",
        "raise skeleton archer",
      ],
    },
    // Paladin Skills
    {
      name: "Might",
      categories: ["offensive auras", "paladin skills", "might"],
    },
    {
      name: "Holy Bolt",
      categories: ["combat skills", "paladin skills", "holy bolt"],
    },
    {
      name: "Prayer",
      categories: ["defensive auras", "paladin skills", "prayer"],
    },
    {
      name: "Sacrifice",
      categories: ["combat skills", "paladin skills", "sacrifice"],
    },
    {
      name: "Smite",
      categories: ["combat skills", "paladin skills", "smite"],
    },
    {
      name: "Holy Fire",
      categories: [
        "offensive auras",
        "paladin skills",
        "holy fire",
        "fire skills",
      ],
    },
    {
      name: "Defiance",
      categories: ["defensive auras", "paladin skills", "defiance"],
    },
    {
      name: "Resist Fire",
      categories: [
        "defensive auras",
        "paladin skills",
        "resist fire",
        "fire skills",
      ],
    },
    {
      name: "Zeal",
      categories: ["combat skills", "paladin skills", "zeal"],
    },
    {
      name: "Charge",
      categories: ["combat skills", "paladin skills", "charge"],
    },
    {
      name: "Blessed Aim",
      categories: ["offensive auras", "paladin skills", "blessed aim"],
    },
    {
      name: "Cleansing",
      categories: ["defensive auras", "paladin skills", "cleansing"],
    },
    {
      name: "Resist Cold",
      categories: [
        "defensive auras",
        "paladin skills",
        "resist cold",
        "cold skills",
      ],
    },
    {
      name: "Vigor",
      categories: ["defensive auras", "paladin skills", "vigor"],
    },
    {
      name: "Blessed Hammer",
      categories: ["combat skills", "paladin skills", "blessed hammer"],
    },
    {
      name: "Concentration",
      categories: ["offensive auras", "paladin skills", "concentration"],
    },
    {
      name: "Holy Freeze",
      categories: [
        "offensive auras",
        "paladin skills",
        "holy freeze",
        "cold skills",
      ],
    },
    {
      name: "Resist Lightning",
      categories: [
        "defensive auras",
        "paladin skills",
        "resist lightning",
        "lightning skills",
      ],
    },
    {
      name: "Vengeance",
      categories: [
        "combat skills",
        "paladin skills",
        "vengeance",
        "fire skills",
        "cold skills",
        "lightning skills",
      ],
    },
    {
      name: "Blessed Shield",
      categories: ["combat skills", "paladin skills", "blessed shield"],
    },
    {
      name: "Holy Shock",
      categories: [
        "offensive auras",
        "paladin skills",
        "holy shock",
        "lightning skills",
      ],
    },
    {
      name: "Sanctuary",
      categories: ["defensive auras", "paladin skills", "sanctuary"],
    },
    {
      name: "Meditation",
      categories: ["defensive auras", "paladin skills", "meditation"],
    },
    {
      name: "Fist of the Heavens",
      categories: [
        "combat skills",
        "paladin skills",
        "fist of the heavens",
        "lightning skills",
      ],
    },
    {
      name: "Fanaticism",
      categories: ["offensive auras", "paladin skills", "fanaticism"],
    },
    {
      name: "Conviction",
      categories: ["offensive auras", "paladin skills", "conviction"],
    },
    {
      name: "Redemption",
      categories: ["defensive auras", "paladin skills", "redemption"],
    },
    {
      name: "Salvation",
      categories: ["defensive auras", "paladin skills", "salvation"],
    },

    // Sorceress Skills
    {
      name: "Fire Bolt",
      categories: ["fire skills", "sorceress skills", "fire bolt"],
    },
    {
      name: "Charged Bolt",
      categories: ["lightning skills", "sorceress skills", "charged bolt"],
    },
    {
      name: "Ice Bolt",
      categories: ["cold skills", "sorceress skills", "ice bolt"],
    },
    {
      name: "Frozen Armor",
      categories: ["cold skills", "sorceress skills", "frozen armor"],
    },
    {
      name: "Inferno",
      categories: ["fire skills", "sorceress skills", "inferno"],
    },
    {
      name: "Static Field",
      categories: ["lightning skills", "sorceress skills", "static field"],
    },
    {
      name: "Telekinesis",
      categories: ["lightning skills", "sorceress skills", "telekinesis"],
    },
    {
      name: "Frost Nova",
      categories: ["cold skills", "sorceress skills", "frost nova"],
    },
    {
      name: "Warmth",
      categories: ["fire skills", "sorceress skills", "warmth"],
    },
    {
      name: "Cold Enchant",
      categories: ["cold skills", "sorceress skills", "cold enchant"],
    },
    {
      name: "Ice Barrage",
      categories: ["cold skills", "sorceress skills", "ice barrage"],
    },
    {
      name: "Combustion",
      categories: ["fire skills", "sorceress skills", "combustion"],
    },
    {
      name: "Lesser Hydra",
      categories: ["fire skills", "sorceress skills", "lesser hydra"],
    },
    {
      name: "Ice Blast",
      categories: ["cold skills", "sorceress skills", "ice blast"],
    },
    {
      name: "Blaze",
      categories: ["fire skills", "sorceress skills", "blaze"],
    },
    {
      name: "Fire Ball",
      categories: ["fire skills", "sorceress skills", "fire ball"],
    },
    {
      name: "Nova",
      categories: ["lightning skills", "sorceress skills", "nova"],
    },
    {
      name: "Lightning",
      categories: ["lightning skills", "sorceress skills", "lightning"],
    },
    {
      name: "Shiver Armor",
      categories: ["cold skills", "sorceress skills", "shiver armor"],
    },
    {
      name: "Fire Wall",
      categories: ["fire skills", "sorceress skills", "fire wall"],
    },
    {
      name: "Enchant",
      categories: ["fire skills", "sorceress skills", "enchant"],
    },
    {
      name: "Chain Lightning",
      categories: ["lightning skills", "sorceress skills", "chain lightning"],
    },
    {
      name: "Teleport",
      categories: ["lightning skills", "sorceress skills", "teleport"],
    },
    {
      name: "Glacial Spike",
      categories: ["cold skills", "sorceress skills", "glacial spike"],
    },
    {
      name: "Meteor",
      categories: ["fire skills", "sorceress skills", "meteor"],
    },
    {
      name: "Thunder Storm",
      categories: ["lightning skills", "sorceress skills", "thunder storm"],
    },
    {
      name: "Energy Shield",
      categories: ["lightning skills", "sorceress skills", "energy shield"],
    },
    {
      name: "Blizzard",
      categories: ["cold skills", "sorceress skills", "blizzard"],
    },
    {
      name: "Chilling Armor",
      categories: ["cold skills", "sorceress skills", "chilling armor"],
    },
    {
      name: "Fire Mastery",
      categories: ["fire skills", "sorceress skills", "fire mastery"],
    },
    {
      name: "Hydra",
      categories: ["fire skills", "sorceress skills", "hydra"],
    },
    {
      name: "Lightning Mastery",
      categories: ["lightning skills", "sorceress skills", "lightning mastery"],
    },
    {
      name: "Frozen Orb",
      categories: ["cold skills", "sorceress skills", "frozen orb"],
    },
    {
      name: "Cold Mastery",
      categories: ["cold skills", "sorceress skills", "cold mastery"],
    },
  ];

  private normalize(str: string): string {
    return str.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private log(message: string, ...args: unknown[]) {
    if (this.debug) {
      console.log(`[D2SkillParser] ${message}`, ...args);
    }
  }
  calculateTotalSkills(
    characterData: CharacterResponse
  ): Array<{ skill: string; level: number; baseLevel: number | undefined }> {
    if (!characterData.character || !characterData.items) {
      throw new Error(characterData.nullReason || "Invalid character data");
    }

    const bonuses: SkillBonus[] = [];
    const oskillBonuses = new Map<string, number>();
    const totalSkills = new Map<string, number>();
    const baseLevels = new Map<string, number>();
    const character = characterData.character;
    const characterClass = this.normalize(character.class.name);

    // Initialize with base skills
    this.log("Initializing base skills:");
    character.skills.forEach((skill) => {
      totalSkills.set(skill.name, skill.level);
      baseLevels.set(skill.name, skill.level);
      this.log(`Base skill: ${skill.name} = ${skill.level}`);
    });

    // Process all items
    characterData.items.forEach((item, index) => {
      if (
        item.location.equipment === "Left Hand Switch" ||
        item.location.equipment === "Right Hand Switch"
      ) {
        return;
      }
      this.log(`Processing item #${index + 1}`);
      //    console.log(item.properties, item.name)

      item.properties.forEach((prop) => {
        if (prop === null) return;
        const newBonuses = this.parseProperty(prop, characterClass);
        bonuses.push(...newBonuses);
      });
    });

    // Apply bonuses in correct order: direct -> tree -> class -> all
    this.log("Applying bonuses in order:");
    this.applyBonusesByType(bonuses, "direct", characterClass, totalSkills, oskillBonuses);
    this.applyBonusesByType(bonuses, "tree", characterClass, totalSkills);
    this.applyBonusesByType(bonuses, "class", characterClass, totalSkills);
    this.applyBonusesByType(bonuses, "all", characterClass, totalSkills);

    // Apply oskill bonuses with per-character cap
    this.applyOskillBonuses(oskillBonuses, totalSkills);

    const baseSkills = new Set(character.skills.map((skill) => skill.name));
    for (const [skillName] of totalSkills.entries()) {
      if (
        !baseSkills.has(skillName) ||
        character.skills.find((s) => s.name === skillName)?.level === 0
      ) {
        totalSkills.delete(skillName);
      }
    }
    const sortedSkills = Array.from(totalSkills.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by level in descending order
      .map(([skill, level]) => ({
        skill: skill,
        level: level,
        baseLevel: baseLevels.get(skill),
      }));
    return sortedSkills;
  }

private isNativeToClass(skillName: string, characterClass: string): boolean {
    const skill = this.skillDefinitions.find(
      (s) => this.normalize(s.name) === this.normalize(skillName)
    );
    if (!skill) return false;
    return skill.categories.some(
      (cat) => this.normalize(cat) === `${characterClass} skills`
    );
  }

  private applyOskillBonuses(
    oskillBonuses: Map<string, number>,
    totalSkills: Map<string, number>
  ) {
    oskillBonuses.forEach((amount, skillName) => {
      const cappedAmount = Math.min(amount, 3);
      const currentLevel = totalSkills.get(skillName) || 0;
      const newLevel = currentLevel + cappedAmount;
      totalSkills.set(skillName, newLevel);
      this.log(
        `Applied oskill bonus to ${skillName}: +${cappedAmount} (${currentLevel} -> ${newLevel})${cappedAmount !== amount ? ` [capped from +${amount}]` : ""}`
      );
    });
  }

  private parseProperty(prop: string, characterClass: string): SkillBonus[] {
    const bonuses: SkillBonus[] = [];
    const normalizedProp = this.normalize(prop);

    this.log(`Parsing property: "${prop}"`);
    const classDirectSkillMatch = normalizedProp.match(
      /^\+(\d+) to ([^(]+?)\s*\((\w+)\s+only\)$/i
    );
    if (classDirectSkillMatch) {
      const [, amount, skillName, targetClass] = classDirectSkillMatch;
      if (
        this.normalize(targetClass) === characterClass &&
        !skillName.toLowerCase().includes("skills")
      ) {
        bonuses.push({
          type: "direct",
          amount: parseInt(amount),
          target: this.normalize(skillName),
          source: prop,
        });
        this.log(`Found direct class skill bonus: +${amount} to ${skillName}`);
        return bonuses;
      }
    }
    // Order matters! Check most specific patterns first
    const classSkillMatch = normalizedProp.match(
      /^\+(\d+) to (.*?) skills \((\w+) only\)$/i
    );
    if (classSkillMatch) {
      const [, amount, category, targetClass] = classSkillMatch;
      if (this.normalize(targetClass) === characterClass) {
        bonuses.push({
          type: "tree",
          amount: parseInt(amount),
          target: this.normalize(category),
          source: prop,
        });
        this.log(
          `Found class-specific tree bonus: +${amount} to ${category} (${targetClass})`
        );
      }
      return bonuses;
    }
    // All Skills: "+X to All Skills"
    const allSkillsMatch = normalizedProp.match(/^\+(\d+) to all skills$/);
    if (allSkillsMatch) {
      const amount = parseInt(allSkillsMatch[1]);
      bonuses.push({
        type: "all",
        amount,
        target: "all",
        source: prop,
      });
      this.log(`Found all skills bonus: +${amount}`);
      return bonuses;
    }

    // Tree Skills: "+X to [Tree] Skills"
    const treeMatch = normalizedProp.match(/^\+(\d+) to (.+?) skills$/);
    if (treeMatch) {
      const amount = parseInt(treeMatch[1]);
      const category = this.normalize(treeMatch[2]);
      bonuses.push({
        type: "tree",
        amount,
        target: category,
        source: prop,
      });
      this.log(`Found tree bonus: +${amount} to ${category} skills`);
      return bonuses;
    }

    // Direct Skill: "+X to [Skill]"
    const directMatch = normalizedProp.match(/^\+(\d+) to (.+)$/);
    if (directMatch) {
      const amount = parseInt(directMatch[1]);
      const skillName = this.normalize(directMatch[2]);
      if (this.isValidSkillName(skillName)) {
        bonuses.push({
          type: "direct",
          amount,
          target: skillName,
          source: prop,
        });
        this.log(`Found direct skill bonus: +${amount} to ${skillName}`);
      }
    }

    return bonuses;
  }

  private isValidSkillName(skillName: string): boolean {
    return this.skillDefinitions.some(
      (def) => this.normalize(def.name) === skillName
    );
  }

  private applyBonusesByType(
    bonuses: SkillBonus[],
    type: SkillBonus["type"],
    characterClass: string,
    totalSkills: Map<string, number>,
    oskillBonuses?: Map<string, number>
  ) {
    bonuses
      .filter((bonus) => bonus.type === type)
      .forEach((bonus) => {
        switch (type) {
          case "direct":
            this.applyDirectBonus(bonus, totalSkills, characterClass, oskillBonuses);
            break;
          case "tree":
            this.applyTreeBonus(bonus, characterClass, totalSkills);
            break;
          case "class":
            this.applyClassBonus(bonus, characterClass, totalSkills);
            break;
          case "all":
            this.applyAllSkillsBonus(bonus, characterClass, totalSkills);
            break;
        }
      });
  }

  private applyDirectBonus(
    bonus: SkillBonus,
    totalSkills: Map<string, number>,
    characterClass: string,
    oskillBonuses?: Map<string, number>
  ) {
    const skill = this.skillDefinitions.find(
      (s) => this.normalize(s.name) === this.normalize(bonus.target)
    );

    if (skill) {
      const isNative = this.isNativeToClass(skill.name, characterClass);
      const isClassSpecific = bonus.source.toLowerCase().includes(" only");
      if (isNative && oskillBonuses && !isClassSpecific) {
        const currentOskill = oskillBonuses.get(skill.name) || 0;
        oskillBonuses.set(skill.name, currentOskill + bonus.amount);
        this.log(
          `Accumulated oskill bonus for ${skill.name}: +${bonus.amount} (total: ${currentOskill + bonus.amount})`
        );
      } else {
        const currentLevel = totalSkills.get(skill.name) || 0;
        const newLevel = currentLevel + bonus.amount;
        totalSkills.set(skill.name, newLevel);
        this.log(
          `Applied direct bonus to ${skill.name}: +${bonus.amount} (${currentLevel} -> ${newLevel})`
        );
      }
    }
  }

  private applyTreeBonus(
    bonus: SkillBonus,
    characterClass: string,
    totalSkills: Map<string, number>
  ) {
    const targetCategory = this.normalize(bonus.target) + " skills"; // Add 'skills' to match category format
    const affectedSkills = this.skillDefinitions.filter((skill) => {
      const hasCategory = skill.categories.some(
        (category) => this.normalize(category) === targetCategory
      );
      const isClassSkill = skill.categories.some(
        (category) => this.normalize(category) === `${characterClass} skills`
      );
      return hasCategory && isClassSkill;
    });

    affectedSkills.forEach((skill) => {
      const currentLevel = totalSkills.get(skill.name) || 0;
      const newLevel = currentLevel + bonus.amount;
      totalSkills.set(skill.name, newLevel);
      this.log(
        `Applied tree bonus to ${skill.name}: +${bonus.amount} (${currentLevel} -> ${newLevel})`
      );
    });
  }

  private applyClassBonus(
    bonus: SkillBonus,
    characterClass: string,
    totalSkills: Map<string, number>
  ) {
    if (this.normalize(bonus.target) === characterClass) {
      this.skillDefinitions
        .filter((skill) =>
          skill.categories.some(
            (cat) => this.normalize(cat) === `${characterClass} skills`
          )
        )
        .forEach((skill) => {
          const currentLevel = totalSkills.get(skill.name) || 0;
          const newLevel = currentLevel + bonus.amount;
          totalSkills.set(skill.name, newLevel);
          this.log(
            `Applied class bonus to ${skill.name}: +${bonus.amount} (${currentLevel} -> ${newLevel})`
          );
        });
    }
  }

  private applyAllSkillsBonus(
    bonus: SkillBonus,
    characterClass: string,
    totalSkills: Map<string, number>
  ) {
    this.skillDefinitions
      .filter((skill) =>
        skill.categories.some(
          (cat) => this.normalize(cat) === `${characterClass} skills`
        )
      )
      .forEach((skill) => {
        const currentLevel = totalSkills.get(skill.name) || 0;
        const newLevel = currentLevel + bonus.amount;
        totalSkills.set(skill.name, newLevel);
        this.log(
          `Applied all skills bonus to ${skill.name}: +${bonus.amount} (${currentLevel} -> ${newLevel})`
        );
      });
  }
}

// Helper function to calculate total skills
export function calculateTotalSkills(
  characterData: CharacterResponse
): Array<{ skill: string; level: number; baseLevel: number | undefined }> {
  const parser = new D2SkillParser();
  return parser.calculateTotalSkills(characterData);
}

export default D2SkillParser;
