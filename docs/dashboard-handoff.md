# Dashboard Handoff

## Local Start

```bash
pnpm --dir apps/dashboard install
pnpm --dir apps/dashboard dev
```

Set `VITE_ORCHESTRATOR_BASE_URL` to point at a contract-conforming orchestrator. Without it, the dashboard runs the deterministic in-browser golden path.

## Build And Test

```bash
pnpm --dir apps/dashboard build
pnpm --dir apps/dashboard test
```

## One-Minute Demo Script

1. Open the dashboard and point out that only tokenized passenger context is visible.
2. Click `Simulate WX Delay` for BA117 LHR to JFK.
3. Narrate the trace: Appwrite tokenization, Amadeus alternatives, Contentstack template, Groq drafting, then the HITL pause.
4. Review the held BA118 alternative, Gold-tier preferences, discounted lounge pass, draft message, and confidence score.
5. Click `Approve & De-Tokenize`.
6. Show SMS, WhatsApp, and email delivered, then the post-approval identity reveal and metrics: `$450` deflected, `$20` upsell, `$0.0001` inference cost.
