export type Decision = "approve" | "edit" | "reject";

export type RunState =
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export type EventType =
  | "run.started"
  | "context.anonymized"
  | "tool.completed"
  | "proposal.ready"
  | "decision.recorded"
  | "delivery.queued"
  | "delivery.rejected"
  | "metrics.updated"
  | "run.completed"
  | "tool.failed"
  | "run.failed";

export interface Route {
  origin: string;
  destination: string;
}

export interface StartRunInput {
  scenarioId: "wx-delay-lhr-jfk";
  flightNumber: string;
  route: Route;
  delayMinutes: number;
}

export interface PassengerContext {
  token: string;
  tier: "Premium" | "Gold" | "Standard";
  preferences: string[];
}

export interface Alternative {
  id: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  cabin: string;
  availability: "held" | "available";
}

export interface Perk {
  kind: string;
  price: number;
  currency: "USD";
}

export interface Metrics {
  callCenterDeflectionUsd: number;
  upsellCapturedUsd: number;
  inferenceCostUsd: number;
}

export interface Proposal {
  passenger: PassengerContext;
  alternatives: Alternative[];
  selectedAlternativeId: string;
  perks: Perk[];
  message: string;
  metrics: Metrics;
}

export interface AgentEvent {
  id: string;
  runId: string;
  type: EventType;
  at: string;
  data: Record<string, unknown>;
}

export interface RunSnapshot {
  runId: string;
  state: RunState;
  input: StartRunInput;
  proposal?: Proposal;
  events: AgentEvent[];
}

export interface DecisionInput {
  decision: Decision;
  message?: string;
  selectedAlternativeId?: string;
}

export interface CommunicationTemplate {
  locale: string;
  tone: string;
  body: string;
}

export interface ProviderResult<T> {
  value: T;
  source: "demo" | "live" | "demo-fallback";
}

export interface DeliveryReceipt {
  channels: string[];
}

export interface ProviderGateway {
  getAffectedPassenger(input: StartRunInput): Promise<ProviderResult<PassengerContext>>;
  searchRebookingOptions(input: StartRunInput): Promise<ProviderResult<Alternative[]>>;
  getCommunicationTemplate(input: StartRunInput, passenger: PassengerContext): Promise<ProviderResult<CommunicationTemplate>>;
  draftRecoveryMessage(input: {
    passenger: PassengerContext;
    alternative: Alternative;
    perks: Perk[];
    template: CommunicationTemplate;
  }): Promise<ProviderResult<string>>;
  queueApprovedDelivery(input: {
    runId: string;
    passengerToken: string;
    message: string;
    selectedAlternativeId: string;
  }): Promise<ProviderResult<DeliveryReceipt>>;
}

export interface RuntimeConfig {
  demoMode: boolean;
  traceStepDelayMs: number;
  amadeusClientId?: string;
  amadeusClientSecret?: string;
  contentstackApiKey?: string;
  contentstackDeliveryToken?: string;
  contentstackEnvironment?: string;
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
  appwriteEndpoint?: string;
  appwriteProjectId?: string;
  appwriteApiKey?: string;
}
