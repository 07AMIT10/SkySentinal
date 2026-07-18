# Project Structure

## Chosen boundary

The dashboard is a standalone browser application and the orchestrator is a server-side Appwrite Function. The browser never receives Appwrite admin credentials, raw passenger PII, or third-party provider secrets. It communicates only with the orchestrator's public HTTP API and its sanitized event stream.

```text
SkySentinel/
├── apps/
│   ├── dashboard/              # Workflow A: judge-facing React/Vite experience
│   │   ├── public/
│   │   └── src/
│   └── orchestrator/           # Workflow B: Appwrite Function and integrations
│       ├── src/
│       └── tests/
├── contracts/                  # Frozen, shared HTTP and event contract
│   └── agent-run-contract.md
├── infra/
│   └── appwrite/               # Workflow B: deployment/configuration assets
├── docs/
│   ├── 00-project-structure.md
│   ├── 01-architecture.md
│   └── 02-parallel-workflows.md
├── .env.example                # Variable names only; never commit real values
├── package.json                # Root workspace manifest; freeze after scaffold
└── pnpm-workspace.yaml         # Root workspace manifest; freeze after scaffold
```

## Ownership rules

| Area | Owner | Purpose |
| --- | --- | --- |
| `apps/dashboard/**` | Workflow A | User interface, animation, accessibility, and dashboard-only tests |
| `apps/orchestrator/**` | Workflow B | API, agent tools, providers, PII enforcement, and server tests |
| `infra/appwrite/**` | Workflow B | Appwrite deployment/function configuration |
| `contracts/**` | Foundation only | Contract is fixed before parallel work begins |
| root manifests and `.env.example` | Foundation only | Avoid root-manifest merge conflicts during the hackathon |

`docs/` is frozen except for the workflow-specific handoff files named in the parallel-workflow plan.
