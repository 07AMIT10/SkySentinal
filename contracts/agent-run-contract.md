# Agent Run Contract (Frozen for Parallel Delivery)

Version: `0.1.0`

This is the single agreement between `apps/dashboard` and `apps/orchestrator`. All JSON is UTF-8. Every payload is sanitized: it must never include raw PII.

## 1. Start a demo run

`POST /v1/disruption-runs`

Request:

```json
{
  "scenarioId": "wx-delay-lhr-jfk",
  "flightNumber": "BA117",
  "route": { "origin": "LHR", "destination": "JFK" },
  "delayMinutes": 180
}
```

Success (`202 Accepted`):

```json
{ "runId": "run_demo_001", "state": "running" }
```

## 2. Read state or stream events

- `GET /v1/disruption-runs/{runId}` returns the latest sanitized run snapshot.
- `GET /v1/disruption-runs/{runId}/events` provides a Server-Sent Event stream. Each `data:` field is one event object below. The dashboard may fall back to polling the read-state endpoint.

```json
{
  "id": "evt_001",
  "runId": "run_demo_001",
  "type": "tool.completed",
  "at": "2026-07-18T10:00:00.000Z",
  "data": {
    "tool": "search_rebooking_options",
    "durationMs": 412,
    "summary": "Found 3 LHR to JFK alternatives",
    "details": {}
  }
}
```

Permitted event types, in their normal order:

1. `run.started`
2. `context.anonymized`
3. `tool.completed` for `get_affected_passengers`
4. `tool.completed` for `search_rebooking_options`
5. `tool.completed` for `get_comm_template`
6. `tool.completed` for `draft_recovery_message`
7. `proposal.ready`
8. `decision.recorded`
9. `delivery.queued` or `delivery.rejected`
10. `metrics.updated`
11. `run.completed`

`tool.failed` and `run.failed` can occur at any point before `run.completed`. They contain `code`, `safeMessage`, and `retryable`; they never expose provider responses or secrets.

## 3. Proposal shape

The `proposal.ready` event and run snapshot expose the following shape:

```json
{
  "passenger": {
    "token": "TKN-GOLD-4471",
    "tier": "Premium",
    "preferences": ["Vegan"]
  },
  "alternatives": [
    {
      "id": "offer_1",
      "flightNumber": "BA283",
      "departure": "2026-07-18T16:00:00Z",
      "arrival": "2026-07-18T19:00:00Z",
      "cabin": "Economy",
      "availability": "held"
    }
  ],
  "selectedAlternativeId": "offer_1",
  "perks": [
    { "kind": "coffee", "price": 0, "currency": "USD" },
    { "kind": "lounge_pass", "price": 20, "currency": "USD" }
  ],
  "message": "A localized, brand-approved recovery message with no real identity.",
  "metrics": {
    "callCenterDeflectionUsd": 450,
    "upsellCapturedUsd": 20,
    "inferenceCostUsd": 0.0001
  }
}
```

## 4. Human decision

`POST /v1/disruption-runs/{runId}/decision`

```json
{
  "decision": "approve",
  "message": "Optional edited message; omit unless decision is approve.",
  "selectedAlternativeId": "offer_1"
}
```

`decision` is exactly one of `approve`, `edit`, or `reject`.

- `approve` requires a selected alternative and triggers the privileged delivery adapter.
- `edit` stores an edited draft and returns the run to `awaiting_approval`; it does **not** deliver.
- `reject` ends the run without delivery.

Success (`200 OK`): `{ "runId": "run_demo_001", "state": "approved" }`

## 5. Run states

`running` -> `awaiting_approval` -> (`approved` -> `completed` | `rejected`). `failed` is terminal. Only the orchestrator may transition states. The dashboard derives its screens from these values and event types.
