import { readConfig } from "./config.js";
import { isSafeError, toSafeError } from "./errors.js";
import { ApiRouter } from "./http.js";
import { createProviders } from "./providers.js";
import { RunEngine } from "./run-engine.js";

interface AppwriteRequest {
  method: string;
  path: string;
  bodyJson?: unknown;
}

interface AppwriteResponse {
  json: (body: Record<string, unknown>, status?: number, headers?: Record<string, string>) => unknown;
}

interface AppwriteContext {
  req: AppwriteRequest;
  res: AppwriteResponse;
  error: (message: string) => void;
}

const config = readConfig();
const router = new ApiRouter(new RunEngine(createProviders(config), config));
const noStoreHeaders = { "cache-control": "no-store", "access-control-allow-origin": "*" };

/**
 * Appwrite Functions use a request/response handler rather than a long-lived Node response.
 * The dashboard therefore uses GET run state polling after deployment; local Node hosting also
 * exposes the contract's SSE endpoint for the live trace.
 */
export default async ({ req, res, error }: AppwriteContext): Promise<unknown> => {
  if (req.method === "GET" && /^\/v1\/disruption-runs\/[^/]+\/events$/.test(req.path)) {
    return res.json(
      {
        code: "SSE_UNAVAILABLE",
        safeMessage: "This deployment uses run-state polling for the trace.",
        retryable: false,
      },
      501,
      noStoreHeaders,
    );
  }
  try {
    const result = router.dispatch(req.method, req.path, (req.bodyJson ?? {}) as Record<string, unknown>);
    return res.json(result.body, result.status, noStoreHeaders);
  } catch (caught) {
    error("SkySentinel function request failed safely.");
    const safe = isSafeError(caught) ? caught : toSafeError(caught);
    return res.json(
      { code: safe.code, safeMessage: safe.message, retryable: safe.retryable },
      safe.statusCode,
      noStoreHeaders,
    );
  }
};
