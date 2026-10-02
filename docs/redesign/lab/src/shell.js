/* LJUSKA LABORATORIJE: izbor koncepta, izbor ekrana, poređenje, matrica ocena, audit. */
const SCREENS = [
  ['today', 'Danas'],
  ['workout', 'Trening'],
  ['plan', 'Plan'],
  ['progress', 'Napredak']
];

/* CSS koncepta se prefiksira klasom `.cNN`, da deset stilova ne može da se meša. */
function scopeCss(css, scope) {
  let i = 0;
  let out = '';
  const n = css.length;
  const skipBlock = (from) => {
    let d = 0;
    let j = from;
    for (; j < n; j++) {
      if (css[j] === '{') d++;
      else if (css[j] === '}') {
        d--;
        if (d === 0) return j + 1;
      }
    }
    return n;
  };
  const rules = (text) => {
    let o = '';
    let k = 0;
    while (k < text.length) {
      const brace = text.indexOf('{', k);
      if (brace < 0) break;
      const sel = text.slice(k, brace).trim();
      let d = 0;
      let e = brace;
      for (; e < text.length; e++) {
        if (text[e] === '{') d++;
        else if (text[e] === '}') {
          d--;
          if (d === 0) break;
        }
      }
      const body = text.slice(brace + 1, e);
      if (sel.startsWith('@keyframes') || sel.startsWith('@font-face')) o += `${sel}{${body}}`;
      else if (sel.startsWith('@media') || sel.startsWith('@supports')) o += `${sel}{${rules(body)}}`;
      else
        o += `${sel
          .split(',')
          .map((s) => {
            s = s.trim();
            if (s === '&' || s === ':scope') return scope;
            if (s.startsWith('&')) return scope + s.slice(1);
            return `${scope} ${s}`;
          })
          .join(',')}{${body}}`;
      k = e + 1;
    }
    return o;
  };
  return rules(css.replace(/\/\*[\s\S]*?\*\//g, ''));
}

const C0 = {
  id: '00',
  name: 'TRENUTNO',
  tag: 'Stanje danas',
  fonts: '',
  css: '',
  screens: {},
  spec: {}
};

const state = { view: 'one', c: '01', s: 'today' };
const byId = (id) => (id === '00' ? C0 : CONCEPTS.find((c) => c.id === id));
const root = document.getElementById('app');

function sizePhone(scale) {
  return `width:${390 * scale}px;height:${844 * scale}px`;
}
function phone(c, s, scale) {
  let inner;
  if (c.id === '00') {
    const src = BEFORE[{ today: '10-danas-pending-fold', workout: '22-day-sheet', plan: '20-plan-fold', progress: '40-trka-fold' }[s]];
    inner = `<div class="scr" style="background:#0b0a1f"><img src="${src}" alt="Trenutni ekran" style="width:100%;height:100%;object-fit:cover;object-position:top"></div>`;
  } else {
    inner = `<div class="scr ${'c' + c.id}" data-s="${s}">${c.screens[s]()}<div class="sb"><span>07:30</span><i></i></div><div class="hi"></div></div>`;
  }
  return `<div class="pw" style="${sizePhone(scale)}"><div class="phone" style="transform:scale(${scale})">${inner}</div></div>`;
}
function specHtml(c) {
  if (c.id === '00') return auditHtml();
  const S = c.spec;
  const rows = [
    ['Filozofija', S.philosophy],
    ['Tipografija', S.type],
    ['Layout', S.layout],
    ['Navigacija', S.nav],
    ['Today', S.today],
    ['Training plan', S.plan],
    ['Workout card', S.workout],
    ['Progres / podaci', S.data],
    ['Animacija', S.motion],
    ['Mobilni model', S.mobile],
    ['Desktop model', S.desktop],
    ['Ključni ekran', S.key]
  ];
  return `<div class="spec"><div class="tag">Koncept ${c.id}</div><h2>${c.name}</h2><p class="lede">${c.tag}</p><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><p class="cost"><b>Cena u produkciji:</b> ${S.cost}</p></div>`;
}
function auditHtml() {
  return `<div class="spec"><div class="tag">Koncept 00</div><h2>Trenutni UI (referenca)</h2><p class="lede">Isti podaci, isti viewport 390 × 844. Snimljeno iz stvarne aplikacije (nedelja 6 od 12, plan 5K sub-20).</p>${AUDIT.short}</div>`;
}

function render() {
  const c = byId(state.c);
  const vp = Math.min(window.innerWidth - 32, 1200);
  let main = '';
  if (state.view === 'one') {
    const scale = Math.min(1, (window.innerWidth - 32) / 390);
    main = `<div class="one">${phone(c, state.s, scale)}${specHtml(c)}</div>`;
  } else if (state.view === 'cmp') {
    const scale = 0.55;
    main = `<p class="note"><b>Isti ekran, 11 pravaca.</b> Dodir otvara koncept u punoj veličini. Ekran: <b>${SCREENS.find((x) => x[0] === state.s)[1]}</b>.</p><div class="cmp">${[C0, ...CONCEPTS].map((k) => `<figure data-c="${k.id}">${phone(k, state.s, scale)}<figcaption><b>${k.id}</b> ${k.name}</figcaption></figure>`).join('')}</div>`;
  } else if (state.view === 'mx') {
    main = MATRIX_HTML();
  } else if (state.view === 'aud') {
    main = AUDIT.full();
  }
  const bar = `
  <div class="lab-top">
    <div class="lab-bar"><div><div class="lab-title">SUB<span>-20</span> · LABORATORIJA KONCEPATA</div><div class="lab-sub">10 pravaca · iste informacije · isti ekrani · plan i VDOT iz stvarnog generatora</div></div>
      <div class="views">${[['one', 'Pregled'], ['cmp', 'Uporedi'], ['mx', 'Ocena'], ['aud', 'Audit']].map(([v, t]) => `<button data-v="${v}" aria-pressed="${state.view === v}">${t}</button>`).join('')}</div></div>
    ${state.view === 'one' ? `<div class="chips" role="tablist">${[C0, ...CONCEPTS].map((k) => `<button data-c="${k.id}" aria-pressed="${state.c === k.id}"><b>${k.id}</b>${k.name}</button>`).join('')}</div>` : ''}
    ${state.view === 'one' || state.view === 'cmp' ? `<div class="screens">${SCREENS.map(([k, t]) => `<button data-s="${k}" aria-pressed="${state.s === k}">${t}</button>`).join('')}</div>` : ''}
  </div>
  <main class="lab-main">${main}</main>`;
  root.innerHTML = bar;
  if (state.view === 'one') document.querySelector('.chips button[aria-pressed=true]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  try {
    history.replaceState(null, '', `#v=${state.view}&c=${state.c}&s=${state.s}`);
  } catch {}
}

root.addEventListener('click', (e) => {
  const lay = e.target.closest('[data-layer]');
  if (lay) {
    const box = lay.closest('[data-layers]');
    box.classList.toggle('hide-' + lay.dataset.layer);
    lay.setAttribute('aria-pressed', String(!box.classList.contains('hide-' + lay.dataset.layer)));
    return;
  }
  const acc = e.target.closest('[data-acc]');
  if (acc) {
    const ly = acc.closest('.ly');
    ly.classList.toggle('open');
    acc.setAttribute('aria-expanded', String(ly.classList.contains('open')));
    return;
  }
  const b = e.target.closest('[data-v],[data-c],[data-s]');
  if (!b) return;
  if (b.dataset.v) state.view = b.dataset.v;
  if (b.dataset.c) {
    state.c = b.dataset.c;
    if (b.closest('figure')) state.view = 'one';
  }
  if (b.dataset.s) state.s = b.dataset.s;
  render();
  if (b.closest('figure')) window.scrollTo(0, 0);
});

/* init */
(function init() {
  const m = /#v=(\w+)&c=(\d+)&s=(\w+)/.exec(location.hash);
  if (m) {
    state.view = m[1];
    state.c = m[2];
    state.s = m[3];
  }
  const style = document.createElement('style');
  style.textContent = CONCEPTS.map((c) => scopeCss(c.css, '.c' + c.id)).join('\n');
  document.head.appendChild(style);
  render();
})();
