import type { IncomingMessage, ServerResponse } from "node:http";

import { isSafeError, toSafeError } from "./errors.js";
import { assertNoPii } from "./privacy.js";
import { RunEngine } from "./run-engine.js";
import type { DecisionInput, StartRunInput } from "./types.js";

const JSON_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const readJson = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 20_000) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assertNoPii(body, "requestBody");
    return asRecord(body);
  } catch (error) {
    if (isSafeError(error)) throw error;
    throw new Error("INVALID_JSON");
  }
};

const writeJson = (response: ServerResponse, result: ApiResponse): void => {
  response.writeHead(result.status, JSON_HEADERS);
  response.end(JSON.stringify(result.body));
};

const match = (path: string, pattern: RegExp): string | undefined => path.match(pattern)?.[1];

export class ApiRouter {
  constructor(private readonly engine: RunEngine) {}

  dispatch(method: string, path: string, body: Record<string, unknown> = {}): ApiResponse {
    if (method === "POST" && path === "/v1/disruption-runs") {
      const snapshot = this.engine.start(body as unknown as StartRunInput);
      return { status: 202, body: { runId: snapshot.runId, state: snapshot.state } };
    }

    const decisionRunId = match(path, /^\/v1\/disruption-runs\/([^/]+)\/decision$/);
    if (method === "POST" && decisionRunId) {
      return { status: 200, body: this.engine.decide(decisionRunId, body as unknown as DecisionInput) };
    }

    const runId = match(path, /^\/v1\/disruption-runs\/([^/]+)$/);
    if (method === "GET" && runId) {
      return { status: 200, body: this.engine.get(runId) as unknown as Record<string, unknown> };
    }

    return { status: 404, body: { code: "NOT_FOUND", safeMessage: "The requested API route does not exist.", retryable: false } };
  }

  getEngine(): RunEngine {
    return this.engine;
  }
}

const writeSseEvent = (response: ServerResponse, event: unknown): void => {
  const typedEvent = event as { type: string };
  response.write(`event: ${typedEvent.type}\ndata: ${JSON.stringify(event)}\n\n`);
};

const handleEventStream = (request: IncomingMessage, response: ServerResponse, router: ApiRouter, runId: string): void => {
  const engine = router.getEngine();
  const snapshot = engine.get(runId);
  response.writeHead(200, {
    ...JSON_HEADERS,
    "content-type": "text/event-stream; charset=utf-8",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  response.write("retry: 1000\n\n");
  snapshot.events.forEach((event) => writeSseEvent(response, event));
  if (engine.isTerminal(snapshot.state)) {
    response.end();
    return;
  }

  let unsubscribe: () => void = () => undefined;
  const close = (): void => {
    unsubscribe();
    if (!response.writableEnded) response.end();
  };
  unsubscribe = engine.subscribe(runId, (event) => {
    writeSseEvent(response, event);
    if (engine.isTerminal(engine.get(runId).state)) close();
  });
  request.once("close", close);
};

export const createHttpHandler = (router: ApiRouter) =>
  async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (request.method === "OPTIONS") {
        response.writeHead(204, JSON_HEADERS);
        response.end();
        return;
      }
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      const eventRunId = match(path, /^\/v1\/disruption-runs\/([^/]+)\/events$/);
      if (request.method === "GET" && eventRunId) {
        handleEventStream(request, response, router, eventRunId);
        return;
      }
      const body = request.method === "POST" ? await readJson(request) : {};
      writeJson(response, router.dispatch(request.method ?? "GET", path, body));
    } catch (error) {
      const safe = isSafeError(error)
        ? error
        : error instanceof Error && error.message === "INVALID_JSON"
          ? { code: "INVALID_JSON", message: "Request body must be valid JSON.", statusCode: 400, retryable: false }
          : error instanceof Error && error.message === "REQUEST_TOO_LARGE"
            ? { code: "REQUEST_TOO_LARGE", message: "Request body is too large.", statusCode: 413, retryable: false }
            : toSafeError(error);
      writeJson(response, {
        status: safe.statusCode,
        body: { code: safe.code, safeMessage: safe.message, retryable: safe.retryable },
      });
    }
  };
