import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmAction } from '../../app/confirm';
import type { CycleModel } from '../../features/cycle/cycle';
import { useUIStore, type Banner } from '../../stores/uiStore';
import { BannerHost } from './BannerHost';
import { ConfirmHost } from './ConfirmHost';
import { Sheet, sheetTitle } from './Sheet';
import { AuthGate, Page, Tabbar } from './Shell';

/* parity: test/list-dijalog.test.mjs (Sheet), test/potvrda.test.mjs (potvrda). Namera: modal je modal — naziv, fokus ulazi i
   vraća se, pozadina je inertna, Escape zatvara, Tab ne izlazi; potvrda se uvek prikazuje. */

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <main>
        <button onClick={() => setOpen(true)}>Otvori</button>
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
    for (const sel of ['main', '#tabbar']) expect(hidden(sel), sel).toBe(true);
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
    /* Zajednica je ugašena: u traci su četiri ekrana */
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Zajednica' })).toBeNull();
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

describe('Oznake (Badge)', () => {
  it('poreklo podatka nosi REČ i oblik, ne samo boju; stanje ima tačku i reč', async () => {
    const { ProvenanceBadge, StatusBadge, PhaseBadge } = await import('./Badge');
    render(
      <>
        <ProvenanceBadge kind="measured" />
        <ProvenanceBadge kind="estimated" />
        <ProvenanceBadge kind="projected" />
        <StatusBadge tone="warn">Pazi</StatusBadge>
        <PhaseBadge phase="RAZVOJ" />
      </>
    );
    expect(screen.getByText('Izmereno')).toHaveClass('prov-m');
    expect(screen.getByText('Procena')).toHaveClass('prov-e');
    expect(screen.getByText('Projekcija')).toHaveClass('prov-p');
    const st = screen.getByText('Pazi');
    expect(st).toHaveClass('badge', 'warn');
    expect(st.querySelector('.led')).not.toBeNull();
    expect(screen.getByText('RAZVOJ')).toHaveClass('phase-tag');
  });
});

describe('Traka ciklusa (CycleRail)', () => {
  it('rečenica za čitač ekrana; jedan segment po nedelji; tekuća označena; pregled, ne dugme', async () => {
    const { CycleRail } = await import('../../features/cycle/CycleRail');
    const model = {
      total: 3,
      weeks: [
        {
          w: 1,
          phase: 'BAZA',
          deload: false,
          state: 'done',
          start: '2026-01-05',
          planKm: 10,
          realKm: 10
        },
        {
          w: 2,
          phase: 'BAZA',
          deload: true,
          state: 'now',
          start: '2026-01-12',
          planKm: 8,
          realKm: 2
        },
        {
          w: 3,
          phase: 'TRKA',
          deload: false,
          state: 'future',
          start: '2026-01-19',
          planKm: 5,
          realKm: 0
        }
      ],
      phases: [],
      current: null
    } as never as CycleModel;
    (model as { current: unknown }).current = (model as { weeks: unknown[] }).weeks[1];
    const { container } = render(<CycleRail model={model} daysToRace={10} />);
    /* pregled cele pripreme, ne dugme: rečenica za čitač ekrana, ali nema radnje (ona je Plan → Pregled celog plana) */
    expect(
      screen.getByRole('img', {
        name: /^Ciklus: nedelja 2 od 3, faza .*\(rasterećenje\), 10 dana do trke/
      })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelectorAll('.rail > i')).toHaveLength(3);
    expect(container.querySelector('i[data-s="now"]')).not.toBeNull();
    expect(container.querySelector('i[data-deload]')).not.toBeNull();
  });
});

describe('Disclosure', () => {
  it('izvorni <details>: zatvoren po podrazumevanju, summary je fokusabilan i otvara ga', async () => {
    const { Disclosure } = await import('./Disclosure');
    const user = userEvent.setup();
    const { container } = render(
      <Disclosure title="Struktura" meta="5 koraka">
        <p>sadržaj</p>
      </Disclosure>
    );
    const d = container.querySelector('details') as HTMLDetailsElement;
    expect(d.open).toBe(false);
    expect(screen.getByText('5 koraka')).toBeInTheDocument();
    const sum = screen.getByText('Struktura').closest('summary') as HTMLElement;
    sum.focus();
    expect(sum).toHaveFocus();
    await user.click(sum); // jsdom ne preslikava Enter u otvaranje; u pregledaču to radi izvorni <summary> (proveren Tab-om)
    expect(d.open).toBe(true);
  });
});

describe('Num', () => {
  it('čitač ekrana dobija samo konačnu vrednost; pod „smanjeno kretanje" odmah tačnu', async () => {
    const { Num } = await import('./Num');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({ matches: /reduce/.test(q), media: q })
    });
    const { container } = render(<Num value={91} format={(n) => `${Math.round(n)}%`} />);
    expect(container.querySelector('.sr-only')).toHaveTextContent('91%');
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('91%');
    Reflect.deleteProperty(window, 'matchMedia');
  });
});
