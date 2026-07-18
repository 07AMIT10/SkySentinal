import assert from "node:assert/strict";
import test from "node:test";

import { isSafeError } from "../src/errors.js";
import { createProviders } from "../src/providers.js";
import { RunEngine } from "../src/run-engine.js";
import type { ProviderGateway, RuntimeConfig, RunState, StartRunInput } from "../src/types.js";

const config: RuntimeConfig = { demoMode: true, traceStepDelayMs: 0 };
const goldenInput: StartRunInput = {
  scenarioId: "wx-delay-lhr-jfk",
  flightNumber: "BA117",
  route: { origin: "LHR", destination: "JFK" },
  delayMinutes: 180,
};

const waitForState = async (engine: RunEngine, runId: string, expected: RunState): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (engine.get(runId).state === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.fail(`Run ${runId} did not reach ${expected}.`);
};

test("a deterministic run emits the contract trace and reaches the HITL gate", async () => {
  const engine = new RunEngine(createProviders(config), config);
  const started = engine.start(goldenInput);

  await waitForState(engine, started.runId, "awaiting_approval");
  const run = engine.get(started.runId);

  assert.equal(run.proposal?.passenger.token, "TKN-GOLD-4471");
  assert.deepEqual(
    run.events.map((event) => event.type),
    [
      "run.started",
      "context.anonymized",
      "tool.completed",
      "tool.completed",
      "tool.completed",
      "tool.completed",
      "proposal.ready",
    ],
  );
  assert.equal(run.events.filter((event) => event.type === "tool.completed").length, 4);
});

test("raw identity fields are rejected before a run begins", () => {
  const engine = new RunEngine(createProviders(config), config);
  assert.throws(
    () => engine.start({ ...goldenInput, passengerName: "Ada Lovelace" } as unknown as StartRunInput),
    (error: unknown) => isSafeError(error) && error.code === "PII_BLOCKED",
  );
});

test("an edit keeps the run at the HITL gate and cannot dispatch", async () => {
  let deliveries = 0;
  const demo = createProviders(config);
  const providers: ProviderGateway = {
    getAffectedPassenger: (input) => demo.getAffectedPassenger(input),
    searchRebookingOptions: (input) => demo.searchRebookingOptions(input),
    getCommunicationTemplate: (input, passenger) => demo.getCommunicationTemplate(input, passenger),
    draftRecoveryMessage: (input) => demo.draftRecoveryMessage(input),
    queueApprovedDelivery: async (input) => {
      deliveries += 1;
      return demo.queueApprovedDelivery(input);
    },
  };
  const engine = new RunEngine(providers, config);
  const started = engine.start(goldenInput);
  await waitForState(engine, started.runId, "awaiting_approval");

  const selectedAlternativeId = engine.get(started.runId).proposal!.selectedAlternativeId;
  const outcome = engine.decide(started.runId, {
    decision: "edit",
    selectedAlternativeId,
    message: "We have updated your recovery option for review.",
  });

  assert.equal(outcome.state, "awaiting_approval");
  assert.equal(deliveries, 0);
  assert.equal(engine.get(started.runId).proposal?.message, "We have updated your recovery option for review.");
});

test("only approval can invoke the delivery gateway", async () => {
  let deliveries = 0;
  const demo = createProviders(config);
  const providers: ProviderGateway = {
    getAffectedPassenger: (input) => demo.getAffectedPassenger(input),
    searchRebookingOptions: (input) => demo.searchRebookingOptions(input),
    getCommunicationTemplate: (input, passenger) => demo.getCommunicationTemplate(input, passenger),
    draftRecoveryMessage: (input) => demo.draftRecoveryMessage(input),
    queueApprovedDelivery: async (input) => {
      deliveries += 1;
      return demo.queueApprovedDelivery(input);
    },
  };
  const engine = new RunEngine(providers, config);
  const started = engine.start(goldenInput);
  await waitForState(engine, started.runId, "awaiting_approval");

  const selectedAlternativeId = engine.get(started.runId).proposal!.selectedAlternativeId;
  engine.decide(started.runId, { decision: "approve", selectedAlternativeId });
  await waitForState(engine, started.runId, "completed");

  assert.equal(deliveries, 1);
  assert.deepEqual(
    engine.get(started.runId).events.slice(-3).map((event) => event.type),
    ["delivery.queued", "metrics.updated", "run.completed"],
  );
});
