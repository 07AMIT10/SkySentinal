import { createCompletedSnapshot, createDemoEvents, demoProposal } from './demoFixture';
import type { Decision, RunEvent, RunSnapshot } from './types';

const baseUrl = import.meta.env.VITE_ORCHESTRATOR_BASE_URL?.replace(/\/$/, '') ?? '';

const scenario = {
  scenarioId: 'wx-delay-lhr-jfk',
  flightNumber: 'BA117',
  route: { origin: 'LHR', destination: 'JFK' },
  delayMinutes: 180
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let safeMessage = `Request failed with ${response.status}`;
    try {
      const body = await response.json();
      safeMessage = body?.safeMessage ?? body?.error?.safeMessage ?? safeMessage;
    } catch {
      // Keep the status-only message if the body is not JSON.
    }
    throw new Error(safeMessage);
  }

  return response.json() as Promise<T>;
}

export async function startRun(): Promise<{ runId: string; state: string; isMock: boolean }> {
  if (!baseUrl) {
    return { runId: 'run_demo_001', state: 'running', isMock: true };
  }

  const response = await fetch(`${baseUrl}/v1/disruption-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario)
  });
  return { ...(await parseJson<{ runId: string; state: string }>(response)), isMock: false };
}

export function subscribeToRun(
  runId: string,
  handlers: {
    onEvent: (event: RunEvent) => void;
    onSnapshot: (snapshot: RunSnapshot) => void;
    onError: (message: string) => void;
  }
): () => void {
  if (!baseUrl) {
    const timers = createDemoEvents().map((event, index) =>
      window.setTimeout(() => {
        handlers.onEvent(event);
        if (event.type === 'proposal.ready') {
          handlers.onSnapshot({
            runId,
            state: 'awaiting_approval',
            events: createDemoEvents(),
            proposal: demoProposal,
            delivery: null,
            metrics: demoProposal.metrics
          });
        }
      }, index * 520 + 180)
    );

    return () => timers.forEach(window.clearTimeout);
  }

  if ('EventSource' in window) {
    const source = new EventSource(`${baseUrl}/v1/disruption-runs/${runId}/events`);
    let stopPolling: (() => void) | null = null;
    source.onmessage = (message) => {
      try {
        handlers.onEvent(JSON.parse(message.data) as RunEvent);
      } catch {
        handlers.onError('Received an unreadable event from the orchestrator.');
      }
    };
    source.onerror = () => {
      source.close();
      stopPolling = startPolling(runId, handlers);
    };
    return () => {
      source.close();
      stopPolling?.();
    };
  }

  return startPolling(runId, handlers);
}

function startPolling(
  runId: string,
  handlers: {
    onSnapshot: (snapshot: RunSnapshot) => void;
    onError: (message: string) => void;
  }
): () => void {
  let stopped = false;

  const poll = async () => {
    try {
      const response = await fetch(`${baseUrl}/v1/disruption-runs/${runId}`);
      const snapshot = await parseJson<RunSnapshot>(response);
      handlers.onSnapshot(snapshot);
      if (!['completed', 'rejected', 'failed'].includes(snapshot.state) && !stopped) {
        window.setTimeout(poll, 750);
      }
    } catch (error) {
      handlers.onError(error instanceof Error ? error.message : 'Could not read the run state.');
    }
  };

  void poll();
  return () => {
    stopped = true;
  };
}

export async function postDecision(
  runId: string,
  decision: Decision,
  selectedAlternativeId: string,
  message: string
): Promise<RunSnapshot> {
  if (!baseUrl) {
    if (decision === 'edit') {
      return {
        runId,
        state: 'awaiting_approval',
        events: createDemoEvents(),
        proposal: { ...demoProposal, selectedAlternativeId, message },
        delivery: null,
        metrics: demoProposal.metrics
      };
    }

    return createCompletedSnapshot(decision, message);
  }

  const response = await fetch(`${baseUrl}/v1/disruption-runs/${runId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, selectedAlternativeId, message })
  });
  return parseJson<RunSnapshot>(response);
}
