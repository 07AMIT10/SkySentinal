# Appwrite Deployment Notes

Deploy `apps/orchestrator` as a Node.js 22 Appwrite Function. Use `npm.cmd run build` as its build command and `dist/appwrite.js` as its entrypoint. Configure a custom function domain that forwards `/v1/*` paths to the function. The dashboard uses `GET /v1/disruption-runs/{runId}` polling when hosted on Appwrite; the local Node server additionally provides the SSE endpoint used during development.

## Function variables

Create the variables already named in the repository's `.env.example`. Start with `DEMO_MODE=true` for a credential-free, deterministic judge demo. Set `DEMO_MODE=false` only after all provider values are configured.

The function requires the least-privilege Appwrite API key needed to invoke the separate `skysentinel-delivery-adapter` function. That adapter is the only component that may resolve a passenger token and invoke a messaging provider; it must return no identity data to this orchestrator.

## Required Appwrite resources

1. An authenticated human-agent role allowed to invoke the orchestrator endpoint.
2. The `skysentinel-orchestrator` function, with Node.js 22 runtime and only the variables in `.env.example`.
3. The privileged `skysentinel-delivery-adapter` function, inaccessible to the browser and LLM-facing routes.
4. A custom domain/CORS configuration permitting the deployed dashboard origin only.

## Deployment smoke check

After deployment, post the `wx-delay-lhr-jfk` contract request, poll the returned run until `awaiting_approval`, then approve its selected alternative. Review the Appwrite logs for the run ID and event type only; do not log request bodies, provider headers, or resolved identity.
