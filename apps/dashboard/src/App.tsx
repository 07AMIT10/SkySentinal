import { FormEvent, useMemo, useRef, useState } from 'react';
import { postDecision, startRun, subscribeToRun } from './api';
import type { Alternative, Delivery, Decision, Metrics, Proposal, RunEvent, RunState } from './types';

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(value));
}

function eventSummary(event: RunEvent): string {
  return String(event.data.summary ?? event.type);
}

function eventProvider(event: RunEvent): string {
  if (event.type === 'context.anonymized') return 'Appwrite';
  if (event.type === 'proposal.ready') return 'HITL';
  if (event.type === 'run.started' || event.type === 'run.completed') return 'System';
  return String(event.data.provider ?? event.data.tool ?? 'System');
}

function selectedAlternative(proposal: Proposal): Alternative {
  return proposal.alternatives.find((item) => item.id === proposal.selectedAlternativeId) ?? proposal.alternatives[0];
}

export function App() {
  const [state, setState] = useState<RunState>('idle');
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [decisionPending, setDecisionPending] = useState<Decision | null>(null);
  const [safeError, setSafeError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const activeEventIndex = state === 'running' ? events.length : -1;
  const canReview = Boolean(proposal) && ['awaiting_approval', 'approved', 'completed', 'rejected'].includes(state);

  async function handleStart() {
    unsubscribeRef.current?.();
    setState('running');
    setRunId(null);
    setEvents([]);
    setProposal(null);
    setDelivery(null);
    setMetrics(null);
    setSafeError(null);

    try {
      const started = await startRun();
      setRunId(started.runId);
      unsubscribeRef.current = subscribeToRun(started.runId, {
        onEvent: (event) => {
          setEvents((current) => (current.some((item) => item.id === event.id) ? current : [...current, event]));
          if (event.type === 'proposal.ready') {
            const nextProposal = event.data as unknown as Proposal;
            setProposal(nextProposal);
            setMessageDraft(nextProposal.message);
            setMetrics(nextProposal.metrics);
            setState('awaiting_approval');
          }
        },
        onSnapshot: (snapshot) => {
          setState(snapshot.state);
          setEvents(snapshot.events);
          setProposal(snapshot.proposal);
          setMessageDraft(snapshot.proposal?.message ?? '');
          setDelivery(snapshot.delivery);
          setMetrics(snapshot.metrics);
          if (snapshot.safeError) setSafeError(snapshot.safeError.safeMessage);
        },
        onError: (message) => {
          setSafeError(message);
          setState('failed');
        }
      });
    } catch (error) {
      setSafeError(error instanceof Error ? error.message : 'Could not start the disruption run.');
      setState('failed');
    }
  }

  async function handleDecision(decision: Decision) {
    if (!runId || !proposal) return;
    setDecisionPending(decision);
    if (decision === 'approve') setState('approved');

    try {
      const snapshot = await postDecision(runId, decision, proposal.selectedAlternativeId, messageDraft);
      setEvents(snapshot.events);
      setProposal(snapshot.proposal);
      setDelivery(snapshot.delivery);
      setMetrics(snapshot.metrics);
      setState(snapshot.state);
    } catch (error) {
      setSafeError(error instanceof Error ? error.message : `Could not ${decision} the run.`);
      setState('awaiting_approval');
    } finally {
      setDecisionPending(null);
    }
  }

  const traceComplete = events.some((event) => event.type === 'proposal.ready');

  return (
    <main className="dashboard-shell">
      <section className="hero-band">
        <div>
          <p className="eyebrow">SkySentinel Agent Console</p>
          <h1>Privacy-first disruption recovery</h1>
          <p className="hero-copy">
            Simulate a weather delay, watch the agent assemble a tokenized recovery package, and approve delivery only
            after human review.
          </p>
        </div>
        <TriggerPanel status={state} onTrigger={handleStart} />
      </section>

      {safeError && (
        <section className="alert-panel" role="alert">
          <strong>Safe error</strong>
          <span>{safeError}</span>
        </section>
      )}

      {state !== 'idle' && <AgentTrace events={events} activeEventIndex={activeEventIndex} traceComplete={traceComplete} />}

      {canReview && proposal && (
        <HitlGate
          proposal={proposal}
          messageDraft={messageDraft}
          status={state}
          pendingDecision={decisionPending}
          onMessageChange={setMessageDraft}
          onDecision={handleDecision}
        />
      )}

      {state === 'completed' && (
        <div className="final-grid">
          <ChannelDispatch delivery={delivery} />
          <MetricsPanel metrics={metrics} />
        </div>
      )}

      {state === 'rejected' && (
        <section className="glass-panel terminal-panel">
          <p className="eyebrow">Run Completed</p>
          <h2>Proposal rejected</h2>
          <p>No de-tokenization or dispatch was performed. The passenger identity remained hidden.</p>
        </section>
      )}
    </main>
  );
}

function TriggerPanel({ status, onTrigger }: { status: RunState; onTrigger: () => void }) {
  const busy = status === 'running' || status === 'approved';

  return (
    <aside className="trigger-panel">
      <div className="brand-row">
        <div className="logo-mark" aria-hidden="true">
          SS
        </div>
        <div>
          <strong>SkySentinel</strong>
          <span>Proactive Disruption Recovery Agent</span>
        </div>
      </div>
      <div className="flight-strip">
        <span>BA117</span>
        <span>LHR - JFK</span>
        <span>13:45 UTC</span>
      </div>
      <button className="danger-trigger" disabled={busy} onClick={onTrigger}>
        {busy ? 'Agent run in progress' : 'Simulate WX Delay'}
      </button>
    </aside>
  );
}

function AgentTrace({
  events,
  activeEventIndex,
  traceComplete
}: {
  events: RunEvent[];
  activeEventIndex: number;
  traceComplete: boolean;
}) {
  return (
    <section className="glass-panel trace-panel" aria-live="polite">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Agent Trace</p>
          <h2>{traceComplete ? 'Recovery package assembled' : 'Live orchestration'}</h2>
        </div>
        <span className="status-pill">{traceComplete ? 'Awaiting human gate' : 'Streaming'}</span>
      </div>
      <div className="terminal">
        {events.map((event, index) => (
          <div className="trace-row" key={event.id}>
            <span className="trace-duration">[{String(event.data.durationMs ?? 5).padStart(3, ' ')}ms]</span>
            <span className="trace-icon">{index === activeEventIndex ? '...' : event.type.includes('failed') ? 'x' : 'OK'}</span>
            <span className="trace-summary">{eventSummary(event)}</span>
            <span className={`provider-badge provider-${eventProvider(event).toLowerCase().replace(/[^a-z]/g, '')}`}>
              {eventProvider(event)}
            </span>
          </div>
        ))}
        {events.length === 0 && <div className="trace-row muted-row">Waiting for disruption trigger...</div>}
      </div>
    </section>
  );
}

function HitlGate({
  proposal,
  messageDraft,
  status,
  pendingDecision,
  onMessageChange,
  onDecision
}: {
  proposal: Proposal;
  messageDraft: string;
  status: RunState;
  pendingDecision: Decision | null;
  onMessageChange: (value: string) => void;
  onDecision: (decision: Decision) => void;
}) {
  const alternative = selectedAlternative(proposal);
  const confidence = Math.round((proposal.confidenceScore ?? 0.92) * 100);
  const approved = status === 'completed';

  function handleEdit(event: FormEvent) {
    event.preventDefault();
    onDecision('edit');
  }

  return (
    <section className={`glass-panel hitl-panel ${approved ? 'approved' : ''}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Human-in-the-Loop</p>
          <h2>{approved ? 'Approved and de-tokenized' : 'Review required before delivery'}</h2>
        </div>
        <span className="privacy-badge">{approved ? 'PII unlocked after approval' : 'No PII visible'}</span>
      </div>

      <div className="review-grid">
        <div className="review-card">
          <h3>Passenger Context</h3>
          <dl>
            <div>
              <dt>Token</dt>
              <dd>{proposal.passenger.token}</dd>
            </div>
            <div>
              <dt>Tier</dt>
              <dd>{proposal.passenger.tier}</dd>
            </div>
            <div>
              <dt>Preferences</dt>
              <dd>{proposal.passenger.preferences.join(', ')}</dd>
            </div>
          </dl>
        </div>

        <div className="review-card">
          <h3>Proposed Recovery</h3>
          <dl>
            <div>
              <dt>Original</dt>
              <dd>BA117 LHR-JFK, delayed 3h 15m</dd>
            </div>
            <div>
              <dt>Alternative</dt>
              <dd>
                {alternative.flightNumber}, {formatTime(alternative.departure)}, {alternative.cabin}
              </dd>
            </div>
            <div>
              <dt>Upsell</dt>
              <dd>Lounge pass, $20</dd>
            </div>
          </dl>
          <div className="confidence">
            <span>Agent confidence</span>
            <strong>{confidence}%</strong>
            <div>
              <i style={{ width: `${confidence}%` }} />
            </div>
          </div>
        </div>
      </div>

      <form className="message-panel" onSubmit={handleEdit}>
        <label htmlFor="draft-message">Draft message</label>
        <textarea
          id="draft-message"
          value={messageDraft}
          disabled={approved}
          onChange={(event) => onMessageChange(event.target.value)}
        />
        <details>
          <summary>Agent reasoning</summary>
          <p>{proposal.reasoning}</p>
        </details>
        <div className="action-row">
          <button type="button" className="approve-button" disabled={approved || Boolean(pendingDecision)} onClick={() => onDecision('approve')}>
            {pendingDecision === 'approve' ? 'Approving...' : 'Approve & De-Tokenize'}
          </button>
          <button type="submit" className="secondary-button" disabled={approved || Boolean(pendingDecision)}>
            {pendingDecision === 'edit' ? 'Saving...' : 'Save Edit'}
          </button>
          <button type="button" className="reject-button" disabled={approved || Boolean(pendingDecision)} onClick={() => onDecision('reject')}>
            Reject
          </button>
        </div>
      </form>
    </section>
  );
}

function ChannelDispatch({ delivery }: { delivery: Delivery | null }) {
  if (!delivery) return null;

  return (
    <section className="glass-panel dispatch-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Dispatch</p>
          <h2>Channels delivered</h2>
        </div>
        <span className="status-pill success">Unlocked</span>
      </div>
      <div className="channel-grid">
        {delivery.channels.map((channel, index) => (
          <div className="channel-card" key={channel.channel} style={{ animationDelay: `${index * 180}ms` }}>
            <strong>{channel.channel.toUpperCase()}</strong>
            <span>Delivered OK</span>
          </div>
        ))}
      </div>
      {delivery.recipient && (
        <div className="pii-reveal">
          <span>{delivery.recipient.name}</span>
          <span>{delivery.recipient.email}</span>
          <span>{delivery.recipient.phone}</span>
        </div>
      )}
    </section>
  );
}

function MetricsPanel({ metrics }: { metrics: Metrics | null }) {
  const cards = useMemo(
    () =>
      metrics
        ? [
            ['Call Center Saved', `$${metrics.callCenterDeflectionUsd}`, 'metric-green'],
            ['Upsell Captured', `$${metrics.upsellCapturedUsd}`, 'metric-blue'],
            ['Inference Cost', `$${metrics.inferenceCostUsd}`, 'metric-purple']
          ]
        : [],
    [metrics]
  );

  if (!metrics) return null;

  return (
    <section className="glass-panel metrics-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Metrics</p>
          <h2>Business impact</h2>
        </div>
      </div>
      <div className="metric-grid">
        {cards.map(([label, value, className]) => (
          <div className={`metric-card ${className}`} key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="metric-footnote">
        Model: {metrics.modelUsed ?? 'llama-3-70b'} - Avg response: {metrics.avgResponseTimeMs ?? 819}ms
      </p>
    </section>
  );
}
