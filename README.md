# SkySentinel

SkySentinel is a privacy-first, human-governed disruption recovery demo. It shows an airline agent responding proactively to a flight delay: searching alternatives, preparing a brand-compliant recovery offer, and pausing at a Human-in-the-Loop (HITL) gate before any de-tokenization or delivery.

This repository is deliberately scaffolded before implementation so two teams can work in parallel with no source-file overlap. Read the project structure, frozen integration contract, and workflow plan in [`docs/`](docs/).

## Technology direction

- `apps/dashboard`: React + TypeScript UI, deployable as an Appwrite Site
- `apps/orchestrator`: TypeScript Appwrite Function / HTTP API for the agent run
- External integrations: Amadeus Flight Offers, Groq or OpenRouter, Contentstack, Appwrite, and mocked SurrealDB context

## Working agreement

Start from the foundation commit containing this scaffold. The two workflow branches must treat `contracts/` and root workspace files as read-only. Their permitted paths and merge gates are defined in [`docs/02-parallel-workflows.md`](docs/02-parallel-workflows.md).
