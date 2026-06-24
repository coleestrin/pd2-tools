# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

**Project Summary:**
This repository powers pd2.tools, a Project Diablo 2 toolkit with a React/Vite/Mantine frontend and a TypeScript Express API backed by Postgres and Redis; it ingests PD2 character data through scheduled jobs, stores season-aware characters, accounts, items, mercenaries, snapshots, economy listings, online-player history, and leaderboards, then exposes UI flows for build discovery, character/account inspection, economy price tracking, statistics, leaderboards, corrupted-zone tracking, character export, and damage/stat calculations using committed PD2 game data tables, with Docker Compose and GitHub Actions covering local/dev/prod deployment, linting, type checks, builds, and backend tests.

**One very important principle to follow at all times is always try to solve the problem with the bare minimum number of changes. Always be very thorough in your research and analysis of the codebase, be certain that your answer is correct always. Don't make assumptions, instead put in the effort to verify things and actually read the code and trace logic.**

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Damage Calculator Regression Scope

After every change that affects damage calculator output, compare the changed output against the committed damage regression snapshot to validate that the differences are intentionally scoped. If the changed calculator output is accepted as correct, update the snapshot in the same change so future regressions use the new accepted values.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
