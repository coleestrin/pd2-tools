import type {
  SkillUsageRow,
  LevelDistribution,
  MercTypeUsageRow,
  MercItemUsageRow,
  GameMode,
} from "../api";
import { slotFromItemName } from "../slot";

export type BuildSheet = {
  skillFrequency: SkillUsageRow[];
  levelDistribution: Array<{ level: number; count: number }>;
  mercenary: {
    topType: string;
    typeFrequency: MercTypeUsageRow[];
    topItemsBySlot: Record<string, Array<{ itemName: string; pct: number }>>;
  };
};

export function shapeBuildSheet(input: {
  skills: SkillUsageRow[];
  levelDist: LevelDistribution;
  mercTypes: MercTypeUsageRow[];
  mercItems: MercItemUsageRow[];
  gameMode: GameMode;
}): BuildSheet {
  const skillFrequency = [...input.skills].sort((a, b) => b.pct - a.pct).slice(0, 12);
  const levelDistribution = input.levelDist[input.gameMode] ?? [];

  const mercItemsBySlot: Record<string, Array<{ itemName: string; pct: number }>> = {};
  for (const it of input.mercItems) {
    const slot = slotFromItemName(it.item) ?? "other";
    mercItemsBySlot[slot] ??= [];
    mercItemsBySlot[slot].push({ itemName: it.item, pct: it.pct });
  }
  for (const k of Object.keys(mercItemsBySlot)) {
    mercItemsBySlot[k].sort((a, b) => b.pct - a.pct);
    mercItemsBySlot[k] = mercItemsBySlot[k].slice(0, 5);
  }

  return {
    skillFrequency,
    levelDistribution,
    mercenary: {
      topType: input.mercTypes[0]?.mercType ?? "",
      typeFrequency: input.mercTypes,
      topItemsBySlot: mercItemsBySlot,
    },
  };
}
