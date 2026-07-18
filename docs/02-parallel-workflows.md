# Two Independent Delivery Workflows

## Foundation (complete before either workflow starts)

This scaffold is the foundation change. Commit it first, then create both branches from that same commit:

- `codex/dashboard-demo`
- `codex/orchestrator-governance`

Before branching, agree that `contracts/agent-run-contract.md`, `.env.example`, `package.json`, and `pnpm-workspace.yaml` are frozen. This removes the usual shared-file conflicts from a two-person hackathon build.

## Workflow A — Dashboard and demo experience

**Branch:** `codex/dashboard-demo`  
**Exclusive write scope:** `apps/dashboard/**`, `docs/dashboard-handoff.md`  
**Do not change:** `apps/orchestrator/**`, `infra/**`, `contracts/**`, root manifests, or another workflow's handoff file.

### Milestones

1. **Runnable dashboard shell** — Create the React/Vite/TypeScript app in `apps/dashboard` with a single configuration value, `VITE_ORCHESTRATOR_BASE_URL`. It runs locally with a documented command and contains no service credentials.
2. **Golden-path screens** — Build the scenario trigger, delay-risk/header state, live trace timeline, proposal/HITL screen, and final multi-channel delivery/metrics state. Use the exact data and state vocabulary from the frozen contract.
3. **Transport adapter** — Implement the client side of `POST /v1/disruption-runs`, the SSE stream with polling fallback, read-state recovery, and `POST /decision`. The UI must render safe errors from the contract and must never synthesize PII.
4. **HITL usability gate** — Make approve, edit, and reject visibly distinct. Disable delivery before `awaiting_approval`; preserve the selected offer and edited message until the API confirms a new state.
5. **Demo quality pass** — Ensure trace timings, source badges (Amadeus, Contentstack, LLM), privacy callouts, mobile/desktop layout, loading states, and keyboard-accessible controls are polished. Add dashboard tests for the three decision paths using contract-shaped fixtures.
6. **Handoff complete** — Record local start, build, test, and the exact one-minute demo script in `docs/dashboard-handoff.md`. A dashboard can drive every UI state against a contract-conforming service without edits outside its allowed scope.

### Workflow A definition of done

The dashboard builds and its tests pass. Against a contract-conforming endpoint, the full journey works: simulate -> trace -> proposal -> approve/edit/reject -> terminal result. It displays only tokenized passenger information.

## Workflow B — Orchestrator, integrations, and governance

**Branch:** `codex/orchestrator-governance`  
**Exclusive write scope:** `apps/orchestrator/**`, `infra/appwrite/**`, `docs/orchestrator-handoff.md`  
**Do not change:** `apps/dashboard/**`, `contracts/**`, root manifests, or another workflow's handoff file.

### Milestones

1. **Runnable service shell** — Create the TypeScript Appwrite Function/HTTP service in `apps/orchestrator` and deployment/configuration assets in `infra/appwrite`. Read credentials only from server-side environment variables named in `.env.example`; validate their absence with safe setup errors.
2. **Contract-complete run engine** — Implement the three contract routes, state machine, sanitized snapshots, SSE events, ordered trace, and terminal errors exactly as specified. Provide deterministic local demo mode so the UI remains impressive if providers are unavailable.
3. **Tokenized context enforcement** — Build the input/context mapper and an explicit PII deny-list. Unit-test that names, contacts, passport/booking/payment fields, provider tokens, and raw request bodies cannot reach LLM prompts, events, logs, or API responses.
4. **Agent tool orchestration** — Implement independently testable adapters for mock affected-passenger context/SurrealDB, Amadeus alternative search, Contentstack template retrieval, and Groq/OpenRouter message drafting. Follow the fixed tool order and emit sanitized timing summaries. Real calls use provider adapters; failures degrade to the deterministic demo fixture with a visible safe status.
5. **HITL and delivery guard** — Enforce server-side state transitions. The privileged Appwrite delivery/de-tokenization adapter may be called only for an approved run; `edit` cannot send and `reject` cannot resolve identity. Emit safe delivery and metrics events.
6. **Verification and handoff** — Add API, state-machine, PII, and adapter tests; document setup, required Appwrite resources, real-vs-demo mode, and endpoint smoke commands in `docs/orchestrator-handoff.md`.

### Workflow B definition of done

The service passes its tests and exposes every documented endpoint/event/state. Its deterministic demo flow works without external credentials; its real integration path is configured entirely by environment variables. Tests prove that only a server-side approved action reaches the de-tokenization adapter and that raw PII does not cross the LLM/dashboard boundary.

## Merge and release gate

Merge Workflow B first, then Workflow A; there should be no file conflicts because their write scopes do not overlap. Run the following combined acceptance checks after the second merge:

1. Start the orchestrator in deterministic demo mode and start the dashboard with its base URL.
2. Trigger `wx-delay-lhr-jfk`; verify the eleven ordered run events and a tokenized passenger card.
3. Run an **edit** decision; confirm no delivery event is emitted and the run returns to `awaiting_approval`.
4. Run a **reject** decision; confirm no de-tokenization/delivery adapter call occurs.
5. Run an **approve** decision; confirm delivery/metrics events and the final metrics screen.
6. Execute both test suites and review browser/network logs for raw PII or secrets.
7. Rehearse the one-minute golden path with real integrations enabled where credentials are available; deterministic mode remains the demo fallback.

When all gates pass, the merged repository is a complete, demo-ready SkySentinel MVP: the UI, agent orchestration, real-provider integration path, privacy boundary, and HITL control work together without a post-merge contract change.
