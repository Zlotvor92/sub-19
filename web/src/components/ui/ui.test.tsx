import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmAction } from '../../app/confirm';
import { useUIStore, type Banner } from '../../stores/uiStore';
import { BannerHost } from './BannerHost';
import { ConfirmHost } from './ConfirmHost';
import { Sheet, sheetTitle } from './Sheet';
import { AuthGate, Page, Splash, Tabbar } from './Shell';

/* parity: test/list-dijalog.test.mjs (Sheet), test/potvrda.test.mjs (potvrda). Namera: modal je modal — naziv, fokus ulazi i
   vraća se, pozadina je inertna, Escape zatvara, Tab ne izlazi; potvrda se uvek prikazuje. */

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header>
        <button onClick={() => setOpen(true)}>Otvori</button>
      </header>
      <main>
        <button>pozadina</button>
      </main>
      <nav id="tabbar">
        <button>tab</button>
      </nav>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="sh-t">Izmeni trening</div>
        <button>Prvo</button>
        <button>Zadnje</button>
      </Sheet>
    </>
  );
}

/** jsdom nema `inert`: implementacija tada pada na `aria-hidden` (sakriva pozadinu bar od čitača). */
const hidden = (sel: string): boolean => {
  const el = document.querySelector<HTMLElement>(sel);
  return !!el && (el.inert === true || el.getAttribute('aria-hidden') === 'true');
};

describe('Sheet', () => {
  it('modal sa nazivom iz prvog naslova; fokus ide NA SAM LIST; pozadina je inertna', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Otvori' }));
    const dlg = screen.getByRole('dialog', { name: 'Izmeni trening' });
    expect(dlg).toHaveFocus();
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    for (const sel of ['header', 'main', '#tabbar']) expect(hidden(sel), sel).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('Escape zatvara, pozadina se vraća, fokus se vraća na dugme koje je otvorilo list', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Otvori' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Izmeni trening' })).toBeNull()
    );
    expect(hidden('main')).toBe(false);
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('Tab ne izlazi iz lista: ciklično od zadnjeg ka prvom i obrnuto', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Otvori' }));
    const first = screen.getByRole('button', { name: 'Prvo' });
    const last = screen.getByRole('button', { name: 'Zadnje' });
    last.focus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it('klik na pozadinu zatvara', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Otvori' }));
    await user.click(screen.getByRole('button', { name: 'Zatvori', hidden: true }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Izmeni trening' })).toBeNull()
    );
  });

  it('naziv: prvi naslov SA TEKSTOM — prazan `.card-t` ne gasi lanac; bez naslova „Detalji"', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="card-t"> </div><h2>Pravi naziv</h2>';
    expect(sheetTitle(root)).toBe('Pravi naziv');
    expect(sheetTitle(document.createElement('div'))).toBe('Detalji');
  });
});

describe('potvrda', () => {
  beforeEach(() => useUIStore.setState({ confirm: null }));
  afterEach(() => useUIStore.setState({ confirm: null }));

  it('uvek se prikazuje (ne može da je proguta pregledač); fokus je na „Ne"', async () => {
    const user = userEvent.setup();
    render(<ConfirmHost />);
    const answer = confirmAction('Obrisati unos?');
    const dlg = await screen.findByRole('alertdialog');
    expect(dlg).toHaveTextContent('Obrisati unos?');
    expect(screen.getByRole('button', { name: 'Ne' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Da' }));
    await expect(answer).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('„Ne", Escape i klik na pozadinu = false', async () => {
    const user = userEvent.setup();
    render(<ConfirmHost />);
    const a = confirmAction('a?');
    await user.click(await screen.findByRole('button', { name: 'Ne' }));
    await expect(a).resolves.toBe(false);
    const b = confirmAction('b?');
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    await expect(b).resolves.toBe(false);
  });

  it('novo pitanje dok je staro otvoreno zatvara staro kao „ne" (nema viseće obećanje)', async () => {
    render(<ConfirmHost />);
    const first = confirmAction('prvo?');
    await screen.findByRole('alertdialog');
    const second = confirmAction('drugo?');
    await expect(first).resolves.toBe(false);
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent('drugo?'));
    act(() => useUIStore.getState().confirm?.resolve(true));
    await expect(second).resolves.toBe(true);
  });

  it('Tab ostaje unutar dijaloga', async () => {
    const user = userEvent.setup();
    render(<ConfirmHost />);
    void confirmAction('x?');
    await screen.findByRole('alertdialog');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Da' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Ne' })).toHaveFocus();
  });
});

describe('trake', () => {
  const banner: Banner = {
    id: 'sync-sukob',
    kind: 'upozorenje',
    title: 'Podaci se razlikuju',
    body: 'Dok ne izabereš, ništa se ne menja.',
    actions: [
      { id: 'pull', label: 'Uzmi sa servera' },
      { id: 'push', label: 'Zadrži sa telefona', ghost: true }
    ]
  };
  it('prikazuje naslov, tekst i akcije; akcija javlja (traka, akcija)', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    useUIStore.setState({ banners: [banner] });
    render(<BannerHost onAction={onAction} />);
    expect(screen.getByRole('status')).toHaveTextContent('Podaci se razlikuju');
    await user.click(screen.getByRole('button', { name: 'Zadrži sa telefona' }));
    expect(onAction).toHaveBeenCalledWith(banner, 'push');
    useUIStore.setState({ banners: [] });
  });
  it('greška ima `alert` ulogu; isti id se ne dupla', () => {
    useUIStore.setState({ banners: [] });
    useUIStore.getState().pushBanner({ ...banner, id: 'x', kind: 'greska' });
    useUIStore.getState().pushBanner({ ...banner, id: 'x', kind: 'greska' });
    expect(useUIStore.getState().banners).toHaveLength(1);
    render(<BannerHost onAction={() => undefined} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    useUIStore.setState({ banners: [] });
  });
});

describe('traka tabova i kapija', () => {
  it('tab menja aktivan ekran i označava ga za čitač', async () => {
    const user = userEvent.setup();
    useUIStore.setState({ tab: 'danas' });
    const onSelect = vi.fn();
    render(<Tabbar onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'Danas' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Plan' }));
    expect(useUIStore.getState().tab).toBe('plan');
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
    expect(onSelect).toHaveBeenCalledWith('plan');
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });
  it('kapija: poruka greške je `alert`, dugme poziva prijavu', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<AuthGate message="Nalog više ne postoji." onLogin={onLogin} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Nalog više ne postoji.');
    await user.click(screen.getByRole('button', { name: 'Prijavi se Google nalogom' }));
    expect(onLogin).toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Prijavi se da nastaviš');
  });
  it('ekran koji nije aktivan ne crta sadržaj', () => {
    render(
      <>
        <Page id="plan" active={false}>
          <p>skriveno</p>
        </Page>
        <Page id="danas" active>
          <p>vidljivo</p>
        </Page>
      </>
    );
    expect(screen.queryByText('skriveno')).toBeNull();
    expect(screen.getByText('vidljivo')).toBeInTheDocument();
  });
});

describe('uvodni ekran', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('zaključava skrol dok traje, i sam se gasi posle 1,55 s', () => {
    const done = vi.fn();
    const view = render(<Splash onDone={done} />);
    expect(document.body.classList.contains('uvod-radi')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1549);
    });
    expect(done).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(done).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(document.body.classList.contains('uvod-radi')).toBe(false);
  });

  it('dodir ga preskače: klasa `gasi`, pa gašenje posle 0,24 s — samo jednom, bez dvostrukog zatvaranja', () => {
    const done = vi.fn();
    const { container } = render(<Splash onDone={done} />);
    const el = container.querySelector('#uvod') as HTMLElement;
    act(() => {
      el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(el.classList.contains('gasi')).toBe(true);
    expect(done).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(done).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(done).toHaveBeenCalledTimes(1); // stari rok od 1,55 s je otkazan
  });
});
