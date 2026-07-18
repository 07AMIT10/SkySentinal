export type RunState = 'idle' | 'running' | 'awaiting_approval' | 'approved' | 'completed' | 'rejected' | 'failed';

export type RunEventType =
  | 'run.started'
  | 'context.anonymized'
  | 'tool.completed'
  | 'tool.failed'
  | 'proposal.ready'
  | 'decision.recorded'
  | 'delivery.queued'
  | 'delivery.rejected'
  | 'metrics.updated'
  | 'run.completed'
  | 'run.failed';

export interface RunEvent {
  id: string;
  runId: string;
  type: RunEventType;
  at: string;
  data: Record<string, unknown>;
}

export interface PassengerSummary {
  token: string;
  tier: string;
  preferences: string[];
}

export interface Alternative {
  id: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  cabin: string;
  availability: string;
}

export interface Perk {
  kind: string;
  price: number;
  currency: string;
}

export interface Proposal {
  passenger: PassengerSummary;
  alternatives: Alternative[];
  selectedAlternativeId: string;
  perks: Perk[];
  message: string;
  reasoning?: string;
  confidenceScore?: number;
  metrics: Metrics;
}

export interface Metrics {
  callCenterDeflectionUsd: number;
  upsellCapturedUsd: number;
  inferenceCostUsd: number;
  avgResponseTimeMs?: number;
  modelUsed?: string;
}

export interface Delivery {
  recipient?: {
    name: string;
    email: string;
    phone: string;
  };
  channels: Array<{
    channel: 'sms' | 'whatsapp' | 'email';
    status: 'queued' | 'sent' | 'delivered' | 'failed';
    sentAt: string | null;
  }>;
  finalMessage?: string;
}

export interface RunSnapshot {
  runId: string;
  state: Exclude<RunState, 'idle'>;
  events: RunEvent[];
  proposal: Proposal | null;
  delivery: Delivery | null;
  metrics: Metrics | null;
  safeError?: {
    code: string;
    safeMessage: string;
    retryable: boolean;
  };
}

export type Decision = 'approve' | 'edit' | 'reject';
