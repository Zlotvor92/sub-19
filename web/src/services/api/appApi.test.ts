import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createAppApi } from './appApi';

describe('account changes during authenticated requests', () => {
  it('does not send a request prepared for A with the newly selected account B', async () => {
    let account = 'A';
    let release!: (token: string) => void;
    const token = new Promise<string>((resolve) => {
      release = resolve;
    });
    const fetcher = vi.fn();
    const api = createAppApi({
      session: { token: () => token },
      fetcher,
      accountKey: () => account
    });
    const result = api.post('/api/analiza', { private: 'A' }, z.unknown());
    account = 'B';
    release('token-B');
    expect((await result).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('discards an old account response arriving after logout', async () => {
    let account = 'A';
    let release!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetcher = vi.fn(() => response);
    const api = createAppApi({
      session: { token: () => Promise.resolve('token-A') },
      fetcher,
      accountKey: () => account
    });
    const result = api.getAuthed('/api/icu', z.object({ private: z.string() }));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    account = 'guest';
    release(new Response(JSON.stringify({ private: 'A' }), { status: 200 }));
    expect(await result).toMatchObject({ ok: false, status: 401 });
  });
});
