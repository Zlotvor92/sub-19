import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OAuthConsent } from './OAuthConsent';
import { CLAUDE_CALLBACK, type OAuthServerApi } from '../../services/supabase/oauthServer';

const ok = <T,>(data: T) => ({ ok: true as const, data, status: 200 });

function setup(
  details: Awaited<ReturnType<OAuthServerApi['details']>>,
  decided = `${CLAUDE_CALLBACK}?code=k`
) {
  const api = {
    details: vi.fn(() => Promise.resolve(details)),
    decide: vi.fn((_id: string, _action: 'approve' | 'deny') => Promise.resolve(ok(decided)))
  };
  const forget = vi.fn();
  const close = vi.fn();
  const navigate = vi.fn();
  render(<OAuthConsent id="a1" api={api} forget={forget} close={close} navigate={navigate} />);
  return { api, forget, close, navigate };
}

const claude = ok({
  kind: 'consent' as const,
  clientName: 'Claude',
  redirectUri: CLAUDE_CALLBACK,
  email: 'k@t.rs'
});

describe('ekran odobrenja za Claude konektor', () => {
  it('kaže ko traži, koji nalog i šta će (ne) videti; Dozvoli vraća u Claude sa kodom', async () => {
    const { api, forget, navigate } = setup(claude);
    expect(
      await screen.findByRole('heading', { name: 'Claude traži pristup zdravstvenim podacima' })
    ).toBeInTheDocument();
    expect(screen.getByText(/k@t\.rs/)).toBeInTheDocument();
    expect(screen.getByText(/Ne vidi plan, treninge ni beleške/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dozvoli' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`${CLAUDE_CALLBACK}?code=k`));
    expect(api.decide).toHaveBeenCalledWith('a1', 'approve');
    expect(forget).toHaveBeenCalled();
  });

  it('Odbij šalje odbijanje i vraća u Claude', async () => {
    const { api, navigate } = setup(claude, `${CLAUDE_CALLBACK}?error=access_denied`);
    await userEvent.click(await screen.findByRole('button', { name: 'Odbij' }));
    expect(api.decide).toHaveBeenCalledWith('a1', 'deny');
    await waitFor(() => expect(navigate).toHaveBeenCalledOnce());
  });

  it('zahtev koji ne vodi u Claude: nema „Dozvoli", odbijanje ne vodi na tuđu adresu', async () => {
    const { api, navigate, close } = setup(
      ok({
        kind: 'consent',
        clientName: 'Neko',
        redirectUri: 'https://zlo.example/cb',
        email: null
      }),
      'https://zlo.example/cb?error=access_denied'
    );
    expect(
      await screen.findByRole('heading', { name: 'Zahtev nije od Claude-a' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dozvoli' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Odbij' }));
    expect(api.decide).toHaveBeenCalledWith('a1', 'deny');
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('već odobreno ranije: odmah nazad u Claude, bez pitanja', async () => {
    const { navigate, api } = setup(
      ok({ kind: 'redirect' as const, url: `${CLAUDE_CALLBACK}?code=z` })
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`${CLAUDE_CALLBACK}?code=z`));
    expect(api.decide).not.toHaveBeenCalled();
  });

  it('istekao zahtev: jasna poruka i povratak u aplikaciju', async () => {
    const { close } = setup({ ok: false, kind: 'http', status: 404, error: 'Greška 404' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/istekao ili je već iskorišćen/);
    await userEvent.click(screen.getByRole('button', { name: 'Nazad u aplikaciju' }));
    expect(close).toHaveBeenCalled();
  });
});
