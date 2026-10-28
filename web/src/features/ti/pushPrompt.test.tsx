import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setApp } from '../../app/appContext';
import type { createApp } from '../../app/createApp';
import { useUIStore } from '../../stores/uiStore';
import type { PushResult, PushStatus } from '../../services/push/push';
import { PushPromptSheet, pushPromptFor, resetPushPrompt, usePushPrompt } from './pushPrompt';

type App = ReturnType<typeof createApp>;

function stubApp(
  status: PushStatus,
  enable: () => Promise<PushResult> = () => Promise.resolve({ ok: true })
) {
  const push = { status: vi.fn(() => Promise.resolve(status)), enable: vi.fn(enable) };
  setApp({ push } as unknown as App);
  return push;
}

function standalone(on: boolean): void {
  window.matchMedia = ((q: string) => ({
    matches: on && q === '(display-mode: standalone)',
    media: q,
    addEventListener() {},
    removeEventListener() {}
  })) as unknown as typeof window.matchMedia;
}

function Harness({ active }: { active: boolean }) {
  usePushPrompt(active);
  return null;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  resetPushPrompt();
  useUIStore.setState({ sheet: null, confirm: null, wizard: null } as never);
});
afterEach(() => setApp(null));

describe('pushPromptFor', () => {
  it('nudi samo kad je isključeno ili odbijeno', () => {
    expect(pushPromptFor({ kind: 'off' })).toBe('off');
    expect(pushPromptFor({ kind: 'denied' })).toBe('denied');
    expect(pushPromptFor({ kind: 'on' })).toBeNull();
    expect(pushPromptFor({ kind: 'unconfigured' })).toBeNull();
    expect(pushPromptFor({ kind: 'unsupported', ios: true })).toBeNull();
  });
});

describe('usePushPrompt', () => {
  it('instalirana aplikacija, obaveštenja isključena → list iskoči', async () => {
    standalone(true);
    stubApp({ kind: 'off' });
    render(<Harness active />);
    await waitFor(() =>
      expect(useUIStore.getState().sheet).toEqual({ kind: 'push-prompt', props: { kind: 'off' } })
    );
  });

  it('odbijena dozvola → list sa uputstvom', async () => {
    standalone(true);
    stubApp({ kind: 'denied' });
    render(<Harness active />);
    await waitFor(() =>
      expect(useUIStore.getState().sheet).toEqual({
        kind: 'push-prompt',
        props: { kind: 'denied' }
      })
    );
  });

  it('jednom po pokretanju: posle „Ne sada" se ne vraća dok se aplikacija ponovo ne pokrene', async () => {
    standalone(true);
    stubApp({ kind: 'off' });
    const first = render(<Harness active />);
    await waitFor(() => expect(useUIStore.getState().sheet).not.toBeNull());
    useUIStore.getState().closeSheet();
    first.unmount();
    render(<Harness active />);
    await flush();
    expect(useUIStore.getState().sheet).toBeNull();
  });

  it('ne iskače u pregledaču, kad je uključeno, ni dok aplikacija nije spremna', async () => {
    standalone(false);
    const p1 = stubApp({ kind: 'off' });
    const a = render(<Harness active />);
    await flush();
    expect(p1.status).not.toHaveBeenCalled();
    a.unmount();

    standalone(true);
    const p2 = stubApp({ kind: 'off' });
    const b = render(<Harness active={false} />);
    await flush();
    expect(p2.status).not.toHaveBeenCalled();
    b.unmount();

    stubApp({ kind: 'on' });
    render(<Harness active />);
    await flush();
    expect(useUIStore.getState().sheet).toBeNull();
  });

  it('ne prekriva list koji je već otvoren', async () => {
    standalone(true);
    stubApp({ kind: 'off' });
    useUIStore.getState().openSheet({ kind: 'alt', props: { id: 'x' } });
    render(<Harness active />);
    await flush();
    expect(useUIStore.getState().sheet?.kind).toBe('alt');
  });
});

describe('PushPromptSheet', () => {
  it('„Uključi" pali obaveštenja i zatvara list', async () => {
    const push = stubApp({ kind: 'off' });
    useUIStore.getState().openSheet({ kind: 'push-prompt', props: { kind: 'off' } });
    render(<PushPromptSheet kind="off" />);
    await userEvent.click(screen.getByRole('button', { name: 'Uključi' }));
    await waitFor(() => expect(useUIStore.getState().sheet).toBeNull());
    expect(push.enable).toHaveBeenCalledOnce();
  });

  it('neuspeh ostavlja list otvoren sa razlogom', async () => {
    stubApp({ kind: 'off' }, () =>
      Promise.resolve({ ok: false, error: 'Obaveštenja su odbijena.' })
    );
    useUIStore.getState().openSheet({ kind: 'push-prompt', props: { kind: 'off' } });
    render(<PushPromptSheet kind="off" />);
    await userEvent.click(screen.getByRole('button', { name: 'Uključi' }));
    expect(await screen.findByText('Obaveštenja su odbijena.')).toBeTruthy();
    expect(useUIStore.getState().sheet).not.toBeNull();
  });

  it('„Ne sada" samo zatvara, bez traženja dozvole', async () => {
    const push = stubApp({ kind: 'off' });
    useUIStore.getState().openSheet({ kind: 'push-prompt', props: { kind: 'off' } });
    render(<PushPromptSheet kind="off" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ne sada' }));
    expect(useUIStore.getState().sheet).toBeNull();
    expect(push.enable).not.toHaveBeenCalled();
  });

  it('odbijena dozvola: uputstvo, bez dugmeta za uključivanje', () => {
    stubApp({ kind: 'denied' });
    render(<PushPromptSheet kind="denied" />);
    expect(screen.getByText('Obaveštenja su blokirana')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Uključi' })).toBeNull();
  });
});
