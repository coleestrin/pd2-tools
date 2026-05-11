import type { CommonFilter, GameMode } from "./api";

// What the UI tracks beyond CommonFilter (mode toggle, diff name, future skills).
export type UiState = {
  filter: CommonFilter;
  mode: "guide" | "diff";
  diffName: string;
  // Phase 2 — read but not applied yet.
  skills: Array<{ name: string; minLevel: number }>;
};

const DEFAULTS: UiState = {
  filter: { gameMode: "hardcore", className: "Paladin", minLevel: 80 },
  mode: "guide",
  diffName: "",
  skills: [],
};

export function uiStateToParams(s: UiState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("mode", s.mode);
  p.set("gameMode", s.filter.gameMode);
  if (s.filter.className) p.set("className", s.filter.className);
  if (s.filter.minLevel !== undefined) p.set("minLevel", String(s.filter.minLevel));
  if (s.skills.length > 0) p.set("skills", JSON.stringify(s.skills));
  if (s.diffName) p.set("char", s.diffName);
  return p;
}

export function paramsToUiState(p: URLSearchParams): UiState {
  const skillsRaw = p.get("skills");
  let skills: UiState["skills"] = [];
  if (skillsRaw) {
    try { skills = JSON.parse(skillsRaw); } catch { skills = []; }
  }
  return {
    filter: {
      gameMode: ((p.get("gameMode") as GameMode) ?? DEFAULTS.filter.gameMode),
      className: p.get("className") ?? DEFAULTS.filter.className,
      minLevel: p.get("minLevel") ? Number(p.get("minLevel")) : DEFAULTS.filter.minLevel,
    },
    mode: ((p.get("mode") as "guide" | "diff") ?? DEFAULTS.mode),
    diffName: p.get("char") ?? "",
    skills,
  };
}

export const DEFAULT_UI_STATE: UiState = DEFAULTS;
