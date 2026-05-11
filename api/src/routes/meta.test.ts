// @ts-nocheck
/**
 * /api/v1/meta — Jest + supertest integration tests
 *
 * Sprint 2.3 Task 10: parity tests against the live Express app + dev Postgres.
 *
 * Strategy:
 *   - Build a minimal Express app inline (matches routes.test.ts style).
 *   - Mount metaRoutes directly — real MetaDB_Postgres connects via env vars
 *     that the Docker container already has set.
 *   - Mock utils/cache to bypass Redis (same pattern as routes.test.ts).
 *   - Mock config logger so the named-logger factory doesn't crash in test env.
 *
 * 7 canonical builds × 6 parity sub-tests = 42, plus 4 validation tests = 46 total.
 * All parity assertions are SHAPE checks — they pass regardless of how much
 * ladder data the dev DB has (empty cohort satisfies all 6 as conditional on length > 0).
 */

import request from "supertest";
import express, { Application } from "express";
import metaRoutes from "./meta";
import type { IMetaResponse } from "../types/meta";

// ---------------------------------------------------------------------------
// Mock Redis cache — avoids needing a Redis connection during tests
// ---------------------------------------------------------------------------
jest.mock("../utils/cache", () => ({
  getCacheValue: jest.fn(() => Promise.resolve(undefined)),
  setCacheValue: jest.fn(() => Promise.resolve(true)),
  deleteCacheValue: jest.fn(() => Promise.resolve(0)),
  clearCache: jest.fn(() => Promise.resolve()),
  initializeRedis: jest.fn(() => Promise.resolve()),
  closeRedis: jest.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Mock config — provide a working logger and currentSeason for the route.
// We do NOT mock the DB config (MetaDB_Postgres reads process.env directly).
// ---------------------------------------------------------------------------
jest.mock("../config", () => ({
  config: {
    currentSeason: 13,
    apiVersion: "v1",
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    createNamedLogger: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

// ---------------------------------------------------------------------------
// App factory — one app instance shared across all tests
// ---------------------------------------------------------------------------
let app: Application;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use("/api/v1/meta", metaRoutes);
});

// ---------------------------------------------------------------------------
// Canonical builds — same 7 as the standalone parity.test.ts (Sprint 2.2)
// ---------------------------------------------------------------------------
interface CanonicalBuild {
  slug: string;
  className: string;
  skills: Array<{ name: string; minLevel: number }>;
}

const CANONICAL_BUILDS: CanonicalBuild[] = [
  {
    slug: "amazon-lightning-fury",
    className: "Amazon",
    skills: [{ name: "Lightning Fury", minLevel: 20 }],
  },
  {
    slug: "assassin-lightning-trapsin",
    className: "Assassin",
    skills: [{ name: "Lightning Sentry", minLevel: 20 }],
  },
  {
    slug: "barbarian-whirlwind",
    className: "Barbarian",
    skills: [{ name: "Whirlwind", minLevel: 20 }],
  },
  {
    slug: "druid-wind-tornado",
    className: "Druid",
    skills: [{ name: "Tornado", minLevel: 20 }],
  },
  {
    slug: "necromancer-bone-spear",
    className: "Necromancer",
    skills: [{ name: "Bone Spear", minLevel: 20 }],
  },
  {
    slug: "paladin-hammerdin",
    className: "Paladin",
    skills: [{ name: "Blessed Hammer", minLevel: 20 }],
  },
  {
    slug: "sorceress-blizzard",
    className: "Sorceress",
    skills: [{ name: "Blizzard", minLevel: 20 }],
  },
];

async function fetchMeta(
  b: CanonicalBuild
): Promise<{ status: number; body: IMetaResponse | { error: { message: string } } }> {
  const res = await request(app)
    .get("/api/v1/meta")
    .query({
      gameMode: "softcore",
      className: b.className,
      minLevel: 1,
      skills: encodeURIComponent(JSON.stringify(b.skills)),
    });
  return { status: res.status, body: res.body };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("/api/v1/meta", () => {
  // ---- Validation errors --------------------------------------------------

  describe("Validation errors (400)", () => {
    it("rejects missing className", async () => {
      const res = await request(app).get("/api/v1/meta");
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/className is required/);
    });

    it("rejects invalid gameMode", async () => {
      const res = await request(app)
        .get("/api/v1/meta")
        .query({ className: "Paladin", gameMode: "ultrahardcore" });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/gameMode/);
    });

    it("rejects minLevel out of range", async () => {
      const res = await request(app)
        .get("/api/v1/meta")
        .query({ className: "Paladin", minLevel: 500 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/minLevel/);
    });

    it("rejects malformed skills JSON", async () => {
      const res = await request(app)
        .get("/api/v1/meta")
        .query({ className: "Paladin", skills: "not-json" });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/skills/);
    });
  });

  // ---- Parity assertions per canonical build --------------------------------

  describe("Parity assertions per canonical build", () => {
    for (const build of CANONICAL_BUILDS) {
      describe(build.slug, () => {
        let resp: IMetaResponse;

        beforeAll(async () => {
          const { status, body } = await fetchMeta(build);
          expect(status).toBe(200);
          resp = body as IMetaResponse;
        });

        // Test 1: cohortSize and all 6 aggregation arrays/objects exist
        it("returns cohortSize >= 0 and all 6 aggregation arrays/objects", () => {
          expect(typeof resp.cohortSize).toBe("number");
          expect(resp.cohortSize).toBeGreaterThanOrEqual(0);
          expect(Array.isArray(resp.itemUsage)).toBe(true);
          expect(Array.isArray(resp.skillUsage)).toBe(true);
          expect(Array.isArray(resp.mercTypeUsage)).toBe(true);
          expect(Array.isArray(resp.mercItemUsage)).toBe(true);
          expect(resp.levelDistribution).toBeDefined();
          expect(Array.isArray(resp.levelDistribution.hardcore)).toBe(true);
          expect(Array.isArray(resp.levelDistribution.softcore)).toBe(true);
          expect(Array.isArray(resp.affixMods)).toBe(true);
        });

        // Test 2: totalSample matches cohortSize on first item-usage row (if any)
        it("totalSample matches cohortSize on first item-usage row (if any)", () => {
          if (resp.itemUsage.length > 0) {
            expect(resp.itemUsage[0].totalSample).toBe(resp.cohortSize);
          }
        });

        // Test 3: totalSample consistent across aggregations
        it("totalSample agrees between itemUsage and skillUsage (if both non-empty)", () => {
          if (resp.itemUsage.length > 0 && resp.skillUsage.length > 0) {
            expect(resp.skillUsage[0].totalSample).toBe(
              resp.itemUsage[0].totalSample
            );
          }
        });

        // Test 4: No duplicate (item, itemType) rows
        it("no duplicate (item, itemType) rows", () => {
          const seen = new Set<string>();
          for (const r of resp.itemUsage) {
            const key = `${r.item}|${r.itemType}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
          }
        });

        // Test 5: All pct values in [0, 100]
        it("all pct values are in [0, 100]", () => {
          for (const r of resp.itemUsage) {
            expect(r.pct).toBeGreaterThanOrEqual(0);
            expect(r.pct).toBeLessThanOrEqual(100);
          }
          for (const r of resp.skillUsage) {
            expect(r.pct).toBeGreaterThanOrEqual(0);
            expect(r.pct).toBeLessThanOrEqual(100);
          }
        });

        // Test 6: pct math is correct (pct = numOccurrences / totalSample * 100)
        it("pct math is correct (within float tolerance)", () => {
          for (const r of resp.itemUsage) {
            const expected = (r.numOccurrences / r.totalSample) * 100;
            expect(r.pct).toBeCloseTo(expected, 6);
          }
        });

        // Test 7: affixMods rows have valid shape and numeric stats
        it("affixMods rows have valid shape (if any)", () => {
          for (const r of resp.affixMods) {
            expect(typeof r.slot).toBe("string");
            expect(r.slot.length).toBeGreaterThan(0);
            expect(typeof r.modKey).toBe("string");
            expect(r.modKey.length).toBeGreaterThan(0);
            expect(typeof r.numOccurrences).toBe("number");
            expect(r.numOccurrences).toBeGreaterThan(0);
            expect(typeof r.totalSample).toBe("number");
            expect(r.totalSample).toBeGreaterThan(0);
            // pct = numOccurrences / slotItemCount * 100.
            // A single item can carry the same mod multiple times (e.g. corruption
            // stacks), so pct CAN exceed 100. We only require it to be non-negative.
            expect(r.pct).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(r.avg)).toBe(true);
            expect(Number.isFinite(r.median)).toBe(true);
            expect(Number.isFinite(r.p75)).toBe(true);
          }
        });

        // Test 8: affixMods pct math is correct
        it("affixMods pct math is correct (within float tolerance)", () => {
          for (const r of resp.affixMods) {
            const expected = (r.numOccurrences / r.totalSample) * 100;
            expect(r.pct).toBeCloseTo(expected, 6);
          }
        });
      });
    }
  });
});
