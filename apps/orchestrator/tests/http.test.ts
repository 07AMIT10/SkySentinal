import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { ApiRouter, createHttpHandler } from "../src/http.js";
import { createProviders } from "../src/providers.js";
import { RunEngine } from "../src/run-engine.js";
import type { RuntimeConfig } from "../src/types.js";

const config: RuntimeConfig = { demoMode: true, traceStepDelayMs: 0 };

test("the HTTP API starts a sanitized run and backfills its SSE trace", async (context) => {
  const engine = new RunEngine(createProviders(config), config);
  const server = createServer(createHttpHandler(new ApiRouter(engine)));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const startResponse = await fetch(`${baseUrl}/v1/disruption-runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioId: "wx-delay-lhr-jfk",
      flightNumber: "BA117",
      route: { origin: "LHR", destination: "JFK" },
      delayMinutes: 180,
    }),
  });
  assert.equal(startResponse.status, 202);
  assert.equal(startResponse.headers.get("access-control-allow-origin"), "*");
  const started = (await startResponse.json()) as { runId: string };

  for (let attempt = 0; attempt < 100 && engine.get(started.runId).state !== "awaiting_approval"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.equal(engine.get(started.runId).state, "awaiting_approval");

  const stream = await fetch(`${baseUrl}/v1/disruption-runs/${started.runId}/events`);
  assert.equal(stream.status, 200);
  assert.equal(stream.headers.get("content-type"), "text/event-stream; charset=utf-8");
  const reader = stream.body?.getReader();
  assert.ok(reader);
  let trace = "";
  while (!trace.includes("proposal.ready")) {
    const next = await reader.read();
    assert.equal(next.done, false);
    trace += new TextDecoder().decode(next.value);
  }
  await reader.cancel();
  assert.match(trace, /context\.anonymized/);
  assert.match(trace, /TKN-GOLD-4471/);
  assert.doesNotMatch(trace, /passport|@/i);
});
