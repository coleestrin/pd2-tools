"""
build-skill-classification.py

Builds web/src/data/skill-classification.json by scraping the PD2 wiki's
per-tree skill pages and combining tree-membership with the existing
receivesBonusesFrom data (from skill-prereqs.json) for trees that mix
cores and synergies.

Source: wiki.projectdiablo2.com (community wiki, CC-BY-SA — attribution
surfaced in the app footer).

Re-run when PD2 patches change skill rosters:
    python scripts/build-skill-classification.py
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path
from typing import Literal

Role = Literal["core", "synergy"]

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Tree config: per class, list trees with their default role.
# "mixed" means trees that contain both cores and synergies; we fall back to
# the receivesBonusesFrom heuristic for those (empty list -> synergy, non-empty
# -> core).
TREES: dict[str, list[tuple[str, str]]] = {
    "Amazon": [
        ("Bow_and_Crossbow_Skills", "core"),
        ("Passive_and_Magic_Skills", "synergy"),
        ("Javelin_and_Spear_Skills", "core"),
    ],
    "Assassin": [
        ("Martial_Arts", "core"),
        ("Shadow_Disciplines", "synergy"),
        ("Traps", "core"),
    ],
    "Barbarian": [
        ("Combat_Masteries", "synergy"),
        ("Combat_Skills_(Barbarian)", "core"),
        ("Warcries", "mixed"),
    ],
    "Druid": [
        ("Elemental_Skills", "core"),
        ("Shape_Shifting_Skills", "mixed"),
        ("Summoning_Skills_(Druid)", "mixed"),
    ],
    "Necromancer": [
        ("Curses", "synergy"),
        ("Poison_and_Bone_Spells", "mixed"),
        ("Summoning_Spells", "core"),
    ],
    "Paladin": [
        ("Combat_Skills_(Paladin)", "core"),
        ("Defensive_Auras", "synergy"),
        ("Offensive_Auras", "mixed"),
    ],
    "Sorceress": [
        ("Cold_Spells", "mixed"),
        ("Fire_Spells", "mixed"),
        ("Lightning_Spells", "mixed"),
    ],
}

# Hand-curated overrides. The tree + receivesBonusesFrom signal is wrong for
# these skills (typically utility 1-pointers, mastery passives, or buff
# spells that happen to live in a damage tree). Keep this list small;
# anything not listed falls back to the heuristic.
OVERRIDES: dict[str, dict[str, Role]] = {
    "Amazon": {
        "Inner Sight": "synergy",
        "Slow Missiles": "synergy",
        "Decoy": "synergy",
    },
    "Assassin": {
        "Burst of Speed": "synergy",
        "Cloak of Shadows": "synergy",
        "Mind Blast": "synergy",
        "Shadow Warrior": "synergy",
    },
    "Druid": {
        "Werewolf": "synergy",
        "Werebear": "synergy",
        "Lycanthropy": "synergy",
        "Cyclone Armor": "synergy",
        "Oak Sage": "synergy",
        "Heart of Wolverine": "synergy",
        "Spirit of Barbs": "synergy",
        "Poison Creeper": "synergy",
        "Carrion Vine": "synergy",
        "Solar Creeper": "synergy",
        "Raven": "synergy",
        "Maul": "core",
    },
    "Necromancer": {
        "Bone Armor": "synergy",
        "Bone Wall": "synergy",
        "Bone Prison": "synergy",
        "Skeleton Mastery": "synergy",
        "Golem Mastery": "synergy",
        "Curse Mastery": "synergy",
        "Blood Warp": "synergy",
    },
    "Paladin": {
        "Holy Shield": "synergy",
    },
    "Sorceress": {
        "Cold Mastery": "synergy",
        "Fire Mastery": "synergy",
        "Lightning Mastery": "synergy",
        "Warmth": "synergy",
        "Static Field": "synergy",
        "Telekinesis": "synergy",
        "Teleport": "synergy",
        "Frozen Armor": "synergy",
        "Shiver Armor": "synergy",
        "Chilling Armor": "synergy",
        "Energy Shield": "synergy",
        "Thunder Storm": "synergy",
        "Enchant": "synergy",
    },
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def skills_from_tree_page(html: str) -> list[str]:
    # Each skill section starts with <h2 id="Skill_Name">Skill Name</h2>.
    # We strip "Contents" and any other non-skill headings later.
    matches = re.findall(r'<h2 id="[^"]+">([^<]+)</h2>', html)
    names = []
    for m in matches:
        name = m.strip()
        # Skip generic headings that aren't skills.
        if name.lower() in {"contents", "see also", "notes", "references"}:
            continue
        names.append(name)
    return names


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    prereqs_path = repo_root / "web" / "src" / "data" / "skill-prereqs.json"
    output_path = repo_root / "web" / "src" / "data" / "skill-classification.json"

    with prereqs_path.open() as f:
        prereqs = json.load(f)

    result: dict[str, dict[str, str]] = {}

    for class_name, trees in TREES.items():
        class_classification: dict[str, str] = {}
        overrides = OVERRIDES.get(class_name, {})
        class_prereqs = prereqs.get(class_name, {})

        for slug, default_role in trees:
            url = f"https://wiki.projectdiablo2.com/wiki/{slug}"
            print(f"  fetch {url}")
            html = fetch(url)
            skills = skills_from_tree_page(html)
            for skill in skills:
                if skill in overrides:
                    role = overrides[skill]
                elif default_role == "mixed":
                    receives = class_prereqs.get(skill, {}).get("receivesBonusesFrom", [])
                    role = "core" if receives else "synergy"
                else:
                    role = default_role
                class_classification[skill] = role

        result[class_name] = class_classification
        cores = sum(1 for r in class_classification.values() if r == "core")
        syns = sum(1 for r in class_classification.values() if r == "synergy")
        print(f"  {class_name}: {len(class_classification)} skills ({cores} core, {syns} synergy)")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {output_path}")


if __name__ == "__main__":
    main()
