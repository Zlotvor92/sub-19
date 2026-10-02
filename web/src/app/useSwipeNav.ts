import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  SWIPE_DIRECTION_PX,
  SWIPE_RETURN_MS,
  axisOf,
  commits,
  edgeOffset,
  neighborTab,
  settleMs,
  stepOf,
  type Axis
} from '../domain/shell/swipe';
import { VISIBLE_TABS, useUIStore, type Tab } from '../stores/uiStore';

/* PREVLAČENJE IZMEĐU TABOVA. Dva ekrana se pomeraju ZAJEDNO, kao traka: onaj što odlazi ide 1:1 sa prstom, susedni stoji uz njega i ulazi u kadar istom
   brzinom — ruka vidi da vuče sadržaj, a ne da pokreće animaciju. Odluke (osa, prag, flik, trajanje) su u
   `domain/shell/swipe`; ovde su samo slušaoci dodira i pomeranje elemenata.

   `touch*`, a ne `pointer*`: da bi prevlačenje smelo da uzme dodir, uspravno skrolovanje mora da se ODBIJE (`preventDefault`), a `touch-action` u CSS-u
   bi se nasledio na ceo sadržaj i ubio vodoravne trake (filteri u Zajednici) i pinch-zoom (WCAG 1.4.4).

   Pomeranje ide direktno na DOM (`transform`), ne kroz React: kadar je 16 ms, a ekran sa grafikonima ne sme da se ponovo iscrtava pri svakom pomaku. React
   zna samo za dve stvari — koji je susedni ekran izvučen (`peek`, da mu sadržaj postoji) i koji je tab aktivan po dovršetku. */

interface Gesture {
  x: number;
  y: number;
  dx: number;
  axis: Axis;
  /** 0 = smer još nije poznat. */
  step: 0 | 1 | -1;
  target: Tab | null;
  el: HTMLElement | null;
  targetEl: HTMLElement | null;
  width: number;
  calm: boolean;
  lastDx: number;
  lastAt: number;
  velocity: number;
}

const pageEl = (tab: Tab): HTMLElement | null => document.getElementById(`pg-${tab}`);

const calmMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Vrh VIDLJIVOG dela stranice, mereno od `main`: ekran koji dolazi mora da počne tačno tu, jer se nova stranica otvara od vrha a stara je možda skrolovana. */
function visibleTop(): number {
  const main = document.querySelector('main');
  if (!main) return 0;
  const header = document.querySelector('header');
  const h = header ? header.getBoundingClientRect().height : 0;
  return Math.max(0, h - main.getBoundingClientRect().top);
}

/** Dodir koji je počeo u nečemu što se i samo pomera vodoravno pripada TOME (filteri u Zajednici, `<pre>`, klizač). Provera je OPŠTA, ne spisak klasa. */
function touchBusy(el: EventTarget | null): boolean {
  for (let n = el instanceof Element ? el : null; n && n !== document.body; n = n.parentElement) {
    const tag = n.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (n.scrollWidth - n.clientWidth > 4) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

const move = (el: HTMLElement | null, px: number): void => {
  if (el) el.style.transform = `translate3d(${px.toFixed(1)}px,0,0)`;
};

/** Vraća stranicu u stanje pre prevlačenja. */
function clear(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove('dolazi', 'klizi');
  el.style.transform = '';
  el.style.willChange = '';
  el.style.removeProperty('--pv-vrh');
  el.style.removeProperty('--pv-ms');
}

/** Oznaka aktivnog taba se menja PO PUŠTANJU, ne kad ekran legne: tada putuje zajedno sa sadržajem. */
function announce(tab: Tab): void {
  document
    .querySelectorAll<HTMLElement>('nav button')
    .forEach((b) => b.classList.toggle('on', b.dataset['pg'] === tab));
}

/** `enabled` je netačno kad nešto drugo pokriva ekran (čarobnjak, list, kapija za prijavu, uvodni ekran): tada tab ne sme da se menja. */
export function useSwipeNav(enabled: boolean): void {
  const allowed = useRef(enabled);
  useEffect(() => {
    allowed.current = enabled;
  }, [enabled]);

  useEffect(() => {
    let g: Gesture | null = null;
    let finish: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ui = useUIStore;

    const release = (p: Gesture): void => {
      clear(p.el);
      clear(p.targetEl);
    };
    /* Dovršetak koji još leti se izvršava ODMAH: dva prelaska u vazduhu istovremeno nemaju smisla, a ni čekanje da prvi istekne. */
    const flushPending = (): void => {
      const f = finish;
      if (!f) return;
      finish = null;
      clearTimeout(timer);
      f();
    };
    const abort = (): void => {
      const p = g;
      g = null;
      if (p) {
        release(p);
        if (ui.getState().peek) ui.getState().setPeek(null);
      }
    };

    /* Priprema (ili menja) susedni ekran kad se zna smer. Menja se kad prst pređe preko početne tačke na drugu stranu. */
    const aim = (p: Gesture, step: 1 | -1): void => {
      if (p.step === step) return;
      clear(p.targetEl);
      p.targetEl = null;
      p.step = step;
      p.target = neighborTab(VISIBLE_TABS, ui.getState().tab, step);
      if (!p.target || p.calm) return;
      const target = p.target;
      /* sadržaj mora postojati pre nego što uđe u kadar */
      flushSync(() => ui.getState().setPeek(target));
      const el = pageEl(target);
      if (!el) return;
      el.style.setProperty('--pv-vrh', `${visibleTop()}px`);
      el.style.willChange = 'transform';
      el.classList.add('dolazi');
      move(el, p.dx + step * p.width);
      p.targetEl = el;
    };

    /* Dovršetak posle puštanja. `to` je gde staje ekran koji odlazi; onaj što dolazi ide za njim, uvek na razmaku od jedne širine. */
    const fly = (p: Gesture, to: number, ms: number, tab: Tab | null): void => {
      const from = ui.getState().tab;
      for (const x of [p.el, p.targetEl]) {
        if (!x) continue;
        x.style.setProperty('--pv-ms', `${ms}ms`);
        x.classList.add('klizi');
      }
      move(p.el, to);
      if (p.targetEl) move(p.targetEl, to + p.step * p.width);
      finish = () => {
        clear(p.el);
        clear(p.targetEl);
        /* Ako je u međuvremenu neko drugi promenio ekran (dodir na ikonicu dok je ovaj još leteo), prelazak je zakasnio i ne sme da vuče nazad. */
        if (tab && ui.getState().tab === from) ui.getState().setTab(tab, { glided: true });
        else ui.getState().setPeek(null);
      };
      clearTimeout(timer);
      timer = setTimeout(flushPending, ms + 20);
    };

    const onStart = (e: TouchEvent): void => {
      flushPending();
      abort();
      if (e.touches.length !== 1) return; // dva prsta su zumiranje
      /* Uvodni ekran se prepoznaje po klasi na `body` (skida je `uvod.js`), ne po postojanju elementa: klasa stoji tačno dok uvod TRAJE. */
      if (!allowed.current || document.body.classList.contains('uvod-radi')) return;
      if (touchBusy(e.target)) return;
      const t = e.touches[0];
      if (!t) return;
      g = {
        x: t.clientX,
        y: t.clientY,
        dx: 0,
        axis: 'wait',
        step: 0,
        target: null,
        el: pageEl(ui.getState().tab),
        targetEl: null,
        width: window.innerWidth || 360,
        calm: calmMotion(),
        lastDx: 0,
        lastAt: Date.now(),
        velocity: 0
      };
    };

    const onMove = (e: TouchEvent): void => {
      const p = g;
      if (!p) return;
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t) {
        giveBack();
        return;
      }
      const dx = t.clientX - p.x;
      const dy = t.clientY - p.y;
      if (p.axis === 'wait') {
        const axis = axisOf(dx, dy);
        if (axis === 'wait') return; // još se ne zna šta pokret hoće
        if (axis === 'vertical') {
          g = null;
          return;
        }
        p.axis = 'horizontal';
        if (!p.calm && p.el) p.el.style.willChange = 'transform';
      }
      /* Od trenutka kad je osa vodoravna, dodir je naš: bez ovoga stranica nastavi da se skroluje uspravno na svako odstupanje prsta. */
      if (e.cancelable) e.preventDefault();
      /* Brzina se meri na POSLEDNJEM potezu, ne na celom pokretu: prst koji je dugo tražio pa naglo bacio ekran ima prosek blizu nule, a nameru na kraju. */
      const now = Date.now();
      const dt = now - p.lastAt;
      if (dt > 0) {
        p.velocity = (dx - p.lastDx) / dt;
        p.lastDx = dx;
        p.lastAt = now;
      }
      p.dx = dx;
      if (Math.abs(dx) >= SWIPE_DIRECTION_PX) aim(p, stepOf(dx));
      if (p.calm) return; // isključeno kretanje: samo promena taba
      if (p.targetEl) {
        move(p.el, dx);
        move(p.targetEl, dx + p.step * p.width);
      } else {
        /* Kraj niza: ekran samo popusti i vrati se. Otpor je odgovor „tu je kraj". */
        move(p.el, edgeOffset(dx));
      }
    };

    /* Drugi prst usred pokreta (zumiranje): ekran se vraća, tab se ne menja. */
    function giveBack(): void {
      const p = g;
      g = null;
      if (!p) return;
      if (p.axis !== 'horizontal' || p.calm) {
        release(p);
        ui.getState().setPeek(null);
        return;
      }
      fly(p, 0, SWIPE_RETURN_MS, null);
    }

    const onEnd = (): void => {
      const p = g;
      g = null;
      if (!p) return;
      if (p.axis !== 'horizontal') {
        release(p);
        return;
      }
      const ok = commits({
        dx: p.dx,
        width: p.width,
        velocity: p.velocity,
        sinceLastMoveMs: Date.now() - p.lastAt,
        hasTarget: !!p.target
      });
      if (p.calm) {
        release(p);
        if (ok && p.target) ui.getState().setTab(p.target);
        return;
      }
      if (!p.targetEl) {
        fly(p, 0, SWIPE_RETURN_MS, null); // kraj niza
        return;
      }
      const to = ok ? -p.step * p.width : 0;
      const remaining = Math.abs(to - p.dx);
      if (ok && p.target) announce(p.target);
      fly(p, to, settleMs(remaining, p.velocity), ok ? p.target : null);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', giveBack, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', giveBack);
      clearTimeout(timer);
      abort();
    };
  }, []);
}
