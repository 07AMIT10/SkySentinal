# Orchestrator Handoff

## Local use

```powershell
cd apps/orchestrator
Copy-Item ../../.env.example .env
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

`DEMO_MODE=true` is the default and needs no third-party credentials. The local service starts at `http://localhost:8080`.

## Endpoint smoke sequence

1. `POST /v1/disruption-runs` with the request in `contracts/agent-run-contract.md`.
2. Read `GET /v1/disruption-runs/{runId}/events` locally, or poll `GET /v1/disruption-runs/{runId}` after an Appwrite deployment.
3. When the snapshot reaches `awaiting_approval`, post an `approve`, `edit`, or `reject` decision to `/decision`.

## Verification

```powershell
npm.cmd run check
npm.cmd test
```

Tests cover ordered golden-path events, PII-field rejection, edit-without-delivery, and approval-only delivery. Before releasing, run the merge-level checks in `docs/02-parallel-workflows.md` and restrict the Appwrite custom-domain origin to the dashboard deployment.
