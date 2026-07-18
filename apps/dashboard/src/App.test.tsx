import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('SkySentinel dashboard', () => {
  it('streams the golden path to the HITL gate', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /simulate wx delay/i }));

    expect(await screen.findByText(/Review required before delivery/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('TKN-GOLD-4471')).toBeInTheDocument();
    expect(screen.queryByText('Eleanor Vance')).not.toBeInTheDocument();
  });

  it('approves and reveals delivery only after the HITL action', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /simulate wx delay/i }));
    await screen.findByText(/Review required before delivery/i, {}, { timeout: 5000 });
    await userEvent.click(screen.getByRole('button', { name: /approve & de-tokenize/i }));

    expect(await screen.findByText('Eleanor Vance')).toBeInTheDocument();
    expect(screen.getByText('$450')).toBeInTheDocument();
  });

  it('saves an edit without de-tokenizing or delivering', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /simulate wx delay/i }));
    await screen.findByText(/Review required before delivery/i, {}, { timeout: 5000 });
    await userEvent.clear(screen.getByLabelText(/draft message/i));
    await userEvent.type(screen.getByLabelText(/draft message/i), 'Tokenized edit for TKN-GOLD-4471.');
    await userEvent.click(screen.getByRole('button', { name: /save edit/i }));

    expect(await screen.findByDisplayValue('Tokenized edit for TKN-GOLD-4471.')).toBeInTheDocument();
    expect(screen.queryByText('Eleanor Vance')).not.toBeInTheDocument();
  });

  it('keeps the run tokenized on reject', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /simulate wx delay/i }));
    await screen.findByText(/Review required before delivery/i, {}, { timeout: 5000 });
    await userEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    await waitFor(() => expect(screen.getByText(/Proposal rejected/i)).toBeInTheDocument());
    expect(screen.queryByText('Eleanor Vance')).not.toBeInTheDocument();
  });
});
