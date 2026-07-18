import { randomUUID } from "node:crypto";

import { SafeError, toSafeError } from "./errors.js";
import { demoPerks } from "./fixtures.js";
import { assertNoPii } from "./privacy.js";
import type {
  AgentEvent,
  Alternative,
  DecisionInput,
  PassengerContext,
  Proposal,
  ProviderGateway,
  ProviderResult,
  RunSnapshot,
  RunState,
  RuntimeConfig,
  StartRunInput,
} from "./types.js";

interface RunRecord extends RunSnapshot {
  subscribers: Set<(event: AgentEvent) => void>;
}

const terminalStates = new Set<RunState>(["completed", "rejected", "failed"]);

const wait = (milliseconds: number): Promise<void> =>
  milliseconds === 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, milliseconds));

const toolSummary = (source: ProviderResult<unknown>["source"]): Record<string, unknown> =>
  source === "demo-fallback" ? { source, degraded: true } : { source };

export class RunEngine {
  private readonly runs = new Map<string, RunRecord>();

  constructor(
    private readonly providers: ProviderGateway,
    private readonly config: Pick<RuntimeConfig, "traceStepDelayMs">,
  ) {}

  start(input: StartRunInput): RunSnapshot {
    this.validateStartInput(input);
    const runId = `run_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const run: RunRecord = { runId, state: "running", input, events: [], subscribers: new Set() };
    this.runs.set(runId, run);
    this.emit(run, "run.started", {
      scenarioId: input.scenarioId,
      flightNumber: input.flightNumber,
      route: input.route,
      delayMinutes: input.delayMinutes,
    });
    void this.execute(runId);
    return this.snapshot(run);
  }

  get(runId: string): RunSnapshot {
    return this.snapshot(this.requireRun(runId));
  }

  subscribe(runId: string, listener: (event: AgentEvent) => void): () => void {
    const run = this.requireRun(runId);
    run.subscribers.add(listener);
    return () => run.subscribers.delete(listener);
  }

  decide(runId: string, input: DecisionInput): { runId: string; state: RunState } {
    const run = this.requireRun(runId);
    if (run.state !== "awaiting_approval") {
      throw new SafeError("INVALID_STATE", "This disruption run is not awaiting human approval.", 409, false);
    }
    this.validateDecision(input, run.proposal);

    if (input.decision === "edit") {
      if (input.message) run.proposal!.message = input.message;
      if (input.selectedAlternativeId) run.proposal!.selectedAlternativeId = input.selectedAlternativeId;
      this.emit(run, "decision.recorded", { decision: "edit", state: "awaiting_approval" });
      return { runId, state: run.state };
    }

    if (input.decision === "reject") {
      run.state = "rejected";
      this.emit(run, "decision.recorded", { decision: "reject", state: "rejected" });
      this.emit(run, "delivery.rejected", { reason: "human_rejection" });
      this.emit(run, "metrics.updated", {
        ...run.proposal!.metrics,
        upsellCapturedUsd: 0,
        deliveryStatus: "not_sent",
      });
      this.emit(run, "run.completed", { state: "rejected" });
      return { runId, state: run.state };
    }

    run.state = "approved";
    if (input.message) run.proposal!.message = input.message;
    if (input.selectedAlternativeId) run.proposal!.selectedAlternativeId = input.selectedAlternativeId;
    this.emit(run, "decision.recorded", { decision: "approve", state: "approved" });
    void this.deliverApprovedRun(runId);
    return { runId, state: run.state };
  }

  private async execute(runId: string): Promise<void> {
    const run = this.requireRun(runId);
    try {
      await wait(this.config.traceStepDelayMs);
      const passengerResult = await this.providers.getAffectedPassenger(run.input);
      const passenger = passengerResult.value;
      assertNoPii(passenger, "passengerContext");
      this.emit(run, "context.anonymized", { passenger });
      this.emitToolCompleted(run, "get_affected_passengers", 12, "Fetched affected passenger manifest (tokenized)", passengerResult);

      await wait(this.config.traceStepDelayMs);
      const alternativesResult = await this.providers.searchRebookingOptions(run.input);
      const alternatives = alternativesResult.value;
      if (!alternatives.length) throw new SafeError("NO_ALTERNATIVES", "No rebooking alternatives are available.", 502, true);
      this.emitToolCompleted(
        run,
        "search_rebooking_options",
        412,
        `Found ${alternatives.length} alternative ${run.input.route.origin} to ${run.input.route.destination} flights`,
        alternativesResult,
      );

      await wait(this.config.traceStepDelayMs);
      const templateResult = await this.providers.getCommunicationTemplate(run.input, passenger);
      this.emitToolCompleted(
        run,
        "get_comm_template",
        85,
        `Retrieved ${passenger.tier} tier ${templateResult.value.locale} weather-delay template`,
        templateResult,
      );

      const selectedAlternative = alternatives[0];
      const perks = demoPerks();
      await wait(this.config.traceStepDelayMs);
      const messageResult = await this.providers.draftRecoveryMessage({
        passenger,
        alternative: selectedAlternative,
        perks,
        template: templateResult.value,
      });
      assertNoPii(messageResult.value, "draftedMessage");
      this.emitToolCompleted(run, "draft_recovery_message", 310, "Drafted recovery package and brand-compliant message", messageResult);

      const proposal: Proposal = {
        passenger,
        alternatives,
        selectedAlternativeId: selectedAlternative.id,
        perks,
        message: messageResult.value,
        metrics: {
          callCenterDeflectionUsd: 450,
          upsellCapturedUsd: 20,
          inferenceCostUsd: messageResult.source === "live" ? 0.0001 : 0,
        },
      };
      assertNoPii(proposal, "proposal");
      run.proposal = proposal;
      run.state = "awaiting_approval";
      this.emit(run, "proposal.ready", proposal as unknown as Record<string, unknown>);
    } catch (error) {
      const safe = toSafeError(error);
      run.state = "failed";
      this.emit(run, "run.failed", { code: safe.code, safeMessage: safe.message, retryable: safe.retryable });
    }
  }

  private async deliverApprovedRun(runId: string): Promise<void> {
    const run = this.requireRun(runId);
    try {
      if (run.state !== "approved" || !run.proposal) {
        throw new SafeError("INVALID_STATE", "Only an approved proposal may be delivered.", 409, false);
      }
      const proposal = run.proposal;
      const receipt = await this.providers.queueApprovedDelivery({
        runId,
        passengerToken: proposal.passenger.token,
        message: proposal.message,
        selectedAlternativeId: proposal.selectedAlternativeId,
      });
      this.emit(run, "delivery.queued", { channels: receipt.value.channels, ...toolSummary(receipt.source) });
      this.emit(run, "metrics.updated", { ...proposal.metrics, deliveryStatus: "queued" });
      run.state = "completed";
      this.emit(run, "run.completed", { state: "completed" });
    } catch (error) {
      const safe = toSafeError(error);
      run.state = "failed";
      this.emit(run, "run.failed", { code: safe.code, safeMessage: safe.message, retryable: safe.retryable });
    }
  }

  private emitToolCompleted<T>(
    run: RunRecord,
    tool: string,
    durationMs: number,
    summary: string,
    result: ProviderResult<T>,
  ): void {
    this.emit(run, "tool.completed", { tool, durationMs, summary, details: toolSummary(result.source) });
  }

  private emit(run: RunRecord, type: AgentEvent["type"], data: Record<string, unknown>): void {
    assertNoPii(data, `event.${type}`);
    const event: AgentEvent = {
      id: `evt_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      runId: run.runId,
      type,
      at: new Date().toISOString(),
      data,
    };
    run.events.push(event);
    for (const subscriber of run.subscribers) subscriber(structuredClone(event));
  }

  private requireRun(runId: string): RunRecord {
    const run = this.runs.get(runId);
    if (!run) throw new SafeError("RUN_NOT_FOUND", "The requested disruption run does not exist.", 404, false);
    return run;
  }

  private snapshot(run: RunRecord): RunSnapshot {
    const { subscribers: _subscribers, ...snapshot } = run;
    return structuredClone(snapshot);
  }

  private validateStartInput(input: StartRunInput): void {
    assertNoPii(input, "startRequest");
    if (
      input.scenarioId !== "wx-delay-lhr-jfk" ||
      input.flightNumber !== "BA117" ||
      input.route?.origin !== "LHR" ||
      input.route?.destination !== "JFK" ||
      !Number.isInteger(input.delayMinutes) ||
      input.delayMinutes < 1 ||
      input.delayMinutes > 1_440
    ) {
      throw new SafeError("INVALID_REQUEST", "The supplied disruption scenario is not valid.", 400, false);
    }
  }

  private validateDecision(input: DecisionInput, proposal: Proposal | undefined): void {
    assertNoPii(input, "decisionRequest");
    if (!proposal || !["approve", "edit", "reject"].includes(input.decision)) {
      throw new SafeError("INVALID_DECISION", "The supplied human decision is not valid.", 400, false);
    }
    if (input.decision === "approve" && !input.selectedAlternativeId) {
      throw new SafeError("ALTERNATIVE_REQUIRED", "Approval requires a selected alternative.", 400, false);
    }
    if (
      input.selectedAlternativeId &&
      !proposal.alternatives.some((alternative: Alternative) => alternative.id === input.selectedAlternativeId)
    ) {
      throw new SafeError("INVALID_ALTERNATIVE", "The selected alternative is not available for this run.", 400, false);
    }
  }

  isTerminal(state: RunState): boolean {
    return terminalStates.has(state);
  }
}
