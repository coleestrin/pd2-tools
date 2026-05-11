# Add /meta build aggregator page

Adds a new top-level page at `/meta` that aggregates Project Diablo 2
ladder build data: top items per slot, affix mod patterns,
skill usage with prereq classification, mercenary, and level
distribution, plus a "diff my character" mode.

This implementation is a port of https://pd2-aggregator.vercel.app —
discussed in Discord. All public-API code paths have been replaced
with direct Postgres aggregations via a new Express route + autoCache.

## What's new

### Backend
- `api/src/routes/meta.ts` — single GET endpoint with strict query-param parsing
- `api/src/database/postgres/meta.ts` — 7 aggregation methods on `MetaDB_Postgres`:
  - `findCohort` — class/level/gameMode/skill filter
  - `aggregateItemUsage` — equipped Uniques/Sets/Runewords
  - `aggregateSkillUsage` — base counts per skill (kept as private helper)
  - `aggregateSkillUsageClassified` — adds prereq classification (1pt skills required by a higher skill are bucketed as "prereq" not "build")
  - `aggregateMercType` + `aggregateMercItems` — mercenary data
  - `aggregateLevelDistribution` — character count per level
  - `aggregateAffixMods` — Rare/Magic/Crafted modifier patterns with avg/median/p75 per (slot, modName)
- `api/src/types/meta.ts` — request + response types
- `api/src/routes/meta.test.ts` — 67 Jest+supertest tests (validation paths + parity assertions across 7 canonical builds)
- All routes use `autoCache(900)` + `validateSeason` matching the rest of the API

### Frontend
- `web/src/pages/Meta.tsx` — top-level page
- `web/src/components/meta/*` — 8 components (FilterForm, BuildSheet, ItemFrequencyTable, AffixFrequencyTable, CharmPanel, DiffView, DataFreshness, MatchBanner) — all Mantine v7
- `web/src/api/meta.ts` — typed API client
- `web/src/hooks/useMetaData.ts` — React Query hook (first one in the codebase — RQ was already wired in App.tsx)
- `web/src/lib/*` — pure logic ported from pd2-aggregator (slot map, build presets, URL state, diff function, types)
- `web/src/data/*` — skill prereq + synergy data, item-slot map, build presets, affix mod dictionary

### Wired in
- `web/src/App.tsx` — `<Route path="/meta">`
- `web/src/components/layout/NavBar/index.tsx` — "Meta" entry between Builds and Economy
- `web/src/config/api.ts` — `meta: "/meta"` endpoint constant
- `api/src/routes/index.ts` — `router.use("/meta", metaRoutes)`
- `api/src/database/index.ts` — exports `metaDB`
- `api/src/types/index.ts` — re-exports meta types

## Verification

- Backend Jest tests: **67/67 passing** (`cd api && npm test -- --testPathPattern=meta.test`)
- Frontend tsc + eslint: clean (`cd web && npx tsc --noEmit && npm run lint`)
- Manual smoke test: cohort lookup + 7 aggregations return correctly across 7 canonical builds (Hammerdin, Blizz Sorc, WW Barb, Bone Spear Necro, Wind Druid, Trapsin, LF Zon)
- Tested at mobile width (375px) — tables wrap in ScrollArea, button rows reflow

## Open follow-ups (not in this PR)

- **Charm aggregation** — currently a placeholder. The standalone shows charm count/size patterns; we'll add `/api/v1/meta/charms` in a follow-up since the fork doesn't load raw character JSON FE-side.
- **Frontend test runner** — `web/` has no vitest/jest setup currently. We lean on `tsc --noEmit` + manual testing. Happy to open a follow-up PR if you'd like vitest added.
- **Aggregate Rare/Magic/Crafted items by base** — currently only Unique/Set/Runeword are name-aggregable. Aggregating by base item type (e.g., "Phase Blade" as a category) would surface common Crafted weapon bases.
- **Build-name auto-detection** — given a cohort, identify which canonical build applies and suggest it.
- **`autoCache` caches 400 responses** — pre-existing across the whole API; a 400 response gets returned as 200 on cache hit. Not introduced by this PR but worth flagging.

## Data sources

- Skill prereq + synergy data scraped from wiki.projectdiablo2.com (CC-BY-SA — re-running the scraper is a one-line script call we'd reuse here)
- Affix mod dictionary: ported from the standalone, derived from PD2 community sources
- Item-slot map: regenerated from pd2-tools' own character snapshots + wiki

## A note on architecture

The aggregator's "look-and-feel" runs Mantine v7 (your stack). The "engine" is direct SQL queries against your existing Postgres schema. We deliberately did NOT preserve the standalone's public-API HTTP path or its IndexedDB cache — those don't add value in a server-rendered environment with `autoCache`.

Happy to iterate on review feedback.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
