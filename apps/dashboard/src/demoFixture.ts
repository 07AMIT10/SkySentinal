import type { Delivery, Metrics, Proposal, RunEvent, RunSnapshot } from './types';

const runId = 'run_demo_001';
const now = () => new Date().toISOString();

export const demoProposal: Proposal = {
  passenger: {
    token: 'TKN-GOLD-4471',
    tier: 'Premium',
    preferences: ['Window seat', 'Vegan meal', 'Lounge access', '45,000 loyalty points']
  },
  alternatives: [
    {
      id: 'offer_1',
      flightNumber: 'BA118',
      departure: '2026-07-18T16:00:00Z',
      arrival: '2026-07-18T19:05:00Z',
      cabin: 'Economy',
      availability: 'held'
    },
    {
      id: 'offer_2',
      flightNumber: 'VS456',
      departure: '2026-07-18T17:30:00Z',
      arrival: '2026-07-18T20:40:00Z',
      cabin: 'Premium Economy',
      availability: 'available'
    },
    {
      id: 'offer_3',
      flightNumber: 'AA789',
      departure: '2026-07-18T18:15:00Z',
      arrival: '2026-07-18T21:25:00Z',
      cabin: 'Business',
      availability: 'available'
    }
  ],
  selectedAlternativeId: 'offer_1',
  perks: [
    { kind: 'coffee', price: 0, currency: 'USD' },
    { kind: 'lounge_pass', price: 20, currency: 'USD' }
  ],
  message:
    'Hello {{passenger_name}}, we are sorry that weather is delaying BA117 from LHR to JFK. We have held a seat on BA118 departing at 16:00 UTC at no fare difference. While you wait, coffee is covered at Terminal 5, and your Gold tier unlocks a discounted lounge pass for $20.',
  reasoning:
    'BA118 preserves the LHR to JFK route, is the earliest held option, keeps the passenger in the requested window-seat flow, and avoids an added fare. The lounge offer is relevant because the passenger has lounge affinity and the delay is long enough to justify it.',
  confidenceScore: 0.92,
  metrics: {
    callCenterDeflectionUsd: 450,
    upsellCapturedUsd: 20,
    inferenceCostUsd: 0.0001,
    avgResponseTimeMs: 819,
    modelUsed: 'llama-3-70b'
  }
};

export const demoDelivery: Delivery = {
  recipient: {
    name: 'Eleanor Vance',
    email: 'e.vance@email.com',
    phone: '+44 7700 900123'
  },
  channels: [
    { channel: 'sms', status: 'delivered', sentAt: now() },
    { channel: 'whatsapp', status: 'delivered', sentAt: now() },
    { channel: 'email', status: 'delivered', sentAt: now() }
  ],
  finalMessage: demoProposal.message.replace('{{passenger_name}}', 'Eleanor')
};

export const demoMetrics: Metrics = demoProposal.metrics;

export function createDemoEvents(): RunEvent[] {
  return [
    {
      id: 'evt_001',
      runId,
      type: 'run.started',
      at: now(),
      data: { summary: 'Weather disruption detected for BA117 LHR to JFK' }
    },
    {
      id: 'evt_002',
      runId,
      type: 'context.anonymized',
      at: now(),
      data: { summary: 'Passenger identity tokenized via Appwrite' }
    },
    {
      id: 'evt_003',
      runId,
      type: 'tool.completed',
      at: now(),
      data: {
        tool: 'get_affected_passengers',
        durationMs: 12,
        summary: 'Fetched affected passenger manifest',
        provider: 'Appwrite'
      }
    },
    {
      id: 'evt_004',
      runId,
      type: 'tool.completed',
      at: now(),
      data: {
        tool: 'search_rebooking_options',
        durationMs: 412,
        summary: 'Found 3 LHR to JFK alternatives',
        provider: 'Amadeus'
      }
    },
    {
      id: 'evt_005',
      runId,
      type: 'tool.completed',
      at: now(),
      data: {
        tool: 'get_comm_template',
        durationMs: 85,
        summary: 'Retrieved Premium Tier Weather Delay template',
        provider: 'Contentstack'
      }
    },
    {
      id: 'evt_006',
      runId,
      type: 'tool.completed',
      at: now(),
      data: {
        tool: 'draft_recovery_message',
        durationMs: 310,
        summary: 'Reasoned recovery package and drafted message',
        provider: 'Groq'
      }
    },
    {
      id: 'evt_007',
      runId,
      type: 'proposal.ready',
      at: now(),
      data: demoProposal as unknown as Record<string, unknown>
    }
  ];
}

export function createCompletedSnapshot(decision: 'approve' | 'reject', message = demoProposal.message): RunSnapshot {
  const proposal = { ...demoProposal, message };
  const approved = decision === 'approve';
  const delivery = approved
    ? {
        ...demoDelivery,
        finalMessage: message.replace('{{passenger_name}}', 'Eleanor')
      }
    : null;

  return {
    runId,
    state: approved ? 'completed' : 'rejected',
    events: [
      ...createDemoEvents(),
      {
        id: 'evt_008',
        runId,
        type: 'decision.recorded',
        at: now(),
        data: { decision, summary: approved ? 'Approval recorded by human reviewer' : 'Recovery proposal rejected' }
      },
      {
        id: 'evt_009',
        runId,
        type: approved ? 'delivery.queued' : 'delivery.rejected',
        at: now(),
        data: approved ? { delivery } : { summary: 'No de-tokenization or dispatch performed' }
      },
      {
        id: 'evt_010',
        runId,
        type: 'metrics.updated',
        at: now(),
        data: approved ? demoMetrics : { ...demoMetrics, upsellCapturedUsd: 0 }
      },
      {
        id: 'evt_011',
        runId,
        type: 'run.completed',
        at: now(),
        data: { summary: approved ? 'Run completed with delivery' : 'Run completed without delivery' }
      }
    ],
    proposal,
    delivery,
    metrics: approved ? demoMetrics : { ...demoMetrics, upsellCapturedUsd: 0 }
  };
}
