# SkySentinel Collaboration Setup Plan

## Summary
Create one pushed foundation commit on `main` that establishes the Next.js project structure, shared API contracts, and two conflict-free workflow docs. After that, both developers continue on the same branch with strict file ownership: this local Codex session owns UI files, and the collaborator owns backend/API files.

## Foundation Commit
- Replace `tasks.md` with a coordination index linking to two workflow files.
- Add `docs/workflows/ui.md` and `docs/workflows/backend.md` with explicit ownership, commands, acceptance criteria, and “do not edit” boundaries.
- Scaffold a runnable Next.js + TypeScript app with shared contracts already defined:
  - `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`
  - `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
  - `lib/types.ts`, `lib/demo-data.ts`
  - `app/api/simulate-disruption/route.ts`, `app/api/approve/route.ts`
  - `components/demo/*`
  - `lib/providers/*`, `lib/orchestration/*`
- Commit message: `chore: scaffold skysentinel collaboration structure`
- Push target: `origin main`

## Workflow A: UI Owner
Owned by this local Codex session after the foundation commit.

- May edit only:
  - `app/page.tsx`
  - `app/globals.css`
  - `components/demo/*`
- Must consume API routes through `fetch`, not by importing backend internals.
- Builds:
  - Disruption trigger
  - Live agent trace
  - HITL approval gate
  - Channel dispatch state
  - Metrics dashboard
- Must not edit:
  - `app/api/*`
  - `lib/providers/*`
  - `lib/orchestration/*`
  - `lib/types.ts` unless both developers coordinate first.

## Workflow B: Backend + Inference Owner
Owned by collaborator after the foundation commit.

- May edit only:
  - `app/api/*`
  - `lib/providers/*`
  - `lib/orchestration/*`
  - `lib/demo-data.ts`
  - backend tests
- Implements provider-shaped adapters for Appwrite, Amadeus, Contentstack, SurrealDB, and Groq/OpenRouter.
- Keeps local demo deterministic without API keys.
- Adds optional free/open-source inference via:
  - `GROQ_API_KEY`
  - `GROQ_MODEL`
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_MODEL`
- Must not edit:
  - `components/demo/*`
  - `app/page.tsx`
  - `app/globals.css`
  - shared contract types unless coordinated.

## Conflict Rules
- `lib/types.ts` is the contract boundary. Foundation commit defines the first version; changes require both developers to sync before editing.
- `tasks.md` is an index only. Each owner updates only their workflow doc.
- `package.json` dependency changes require coordination before committing.
- Both developers should pull before starting, before committing, and before pushing.
- Since the chosen model is single-branch ownership, no one should reformat unrelated files.

## Local Run + Verification
- Install: `npm install`
- Run: `npm run dev`
- Open: `http://localhost:3000`
- Check before push:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## Assumptions
- Use `main` directly with strict file ownership, per your selected branch model.
- This local session will own the UI workflow after the initial scaffold commit.
- The foundation commit may modify the currently empty `tasks.md`.
- Real API credentials are optional; v1 must run locally without them.
