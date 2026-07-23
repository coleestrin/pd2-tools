import type { IModifier } from "../types";
import {
  expandItemStats,
  getExpandedItemElementalDamageRanges,
} from "./item-stat-expansion";

function modifier(
  name: string,
  values: IModifier["values"] = []
): IModifier {
  return {
    name,
    values,
    label: "",
    priority: 0,
  };
}

function item(modifiers: IModifier[]) {
  return { modifiers };
}

describe("item stat expansion", () => {
  it("expands elemental property codes through Properties.txt stats", () => {
    const ledger = expandItemStats(
      item([
        modifier("dmg-fire", [26, 92]),
        modifier("dmg-ltng", [1, "120"]),
        modifier("dmg-cold", [15, 45, 100]),
        modifier("poisondam", [25, 40, 75]),
      ])
    );

    expect(ledger).toMatchObject({
      firemindam: 26,
      firemaxdam: 92,
      lightmindam: 1,
      lightmaxdam: 120,
      coldmindam: 15,
      coldmaxdam: 45,
      coldlength: 100,
      poisonmindam: 25,
      poisonmaxdam: 40,
      poisonlength: 75,
    });
  });

  it("normalizes armory aliases and collapsed min-stat payloads", () => {
    const ranges = getExpandedItemElementalDamageRanges(
      item([
        modifier("firedam", [3, 5]),
        modifier("lightmindam", [1, 162]),
        modifier("magicmindam", ["500", "650"]),
        modifier("cold-min", [40]),
        modifier("cold-max", [80]),
      ])
    );

    expect(ranges.fire).toEqual({ min: 3, max: 5 });
    expect(ranges.lightning).toEqual({ min: 1, max: 162 });
    expect(ranges.magic).toEqual({ min: 500, max: 650 });
    expect(ranges.cold).toEqual({ min: 40, max: 80 });
  });

  it("combines split direct min and max stats", () => {
    const ranges = getExpandedItemElementalDamageRanges(
      item([modifier("lightmindam", [1]), modifier("lightmaxdam", [120])])
    );

    expect(ranges.lightning).toEqual({ min: 1, max: 120 });
  });

  it("expands raw poison item modifiers to concrete poison stats", () => {
    const ledger = expandItemStats(
      item([
        modifier("dmg-pois", [25, 40, 75]),
        modifier("poisonmindam", [2, 4, 25]),
        modifier("poisonmaxdam", [3]),
        modifier("poisonlength", ["10"]),
      ])
    );

    expect(ledger).toMatchObject({
      poisonmindam: 27,
      poisonmaxdam: 47,
      poisonlength: 110,
    });
  });

  it("expands multi-element damage properties to each concrete stat", () => {
    const ledger = expandItemStats(item([modifier("dmg-elem", [10, 20, 75])]));

    expect(ledger).toMatchObject({
      firemindam: 10,
      firemaxdam: 20,
      lightmindam: 10,
      lightmaxdam: 20,
      coldmindam: 10,
      coldmaxdam: 20,
      coldlength: 75,
    });
  });

  it("expands func 3 multi-stat damage properties with the shared value", () => {
    const ranges = getExpandedItemElementalDamageRanges(
      item([modifier("dmg-elem-min", [10]), modifier("dmg-elem-max", [20])])
    );

    expect(ranges.fire).toEqual({ min: 10, max: 20 });
    expect(ranges.lightning).toEqual({ min: 10, max: 20 });
    expect(ranges.cold).toEqual({ min: 10, max: 20 });
  });

  it("expands per-level Deadly Strike from the func 17 coefficient slot", () => {
    const ledger = expandItemStats(
      item([modifier("deadly/lvl", [0, 0, 0.25])])
    );

    expect(ledger.item_deadlystrike_perlevel).toBe(0.25);
  });
});
