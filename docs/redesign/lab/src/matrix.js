/* OCENA 10 KONCEPATA. Ocene 1–5 su MOJA PROCENA posle gledanja renderovanih ekrana (ordinalne, ne merenje).
   Kolona „novo u domenu/UI“ je ČINJENICA: šta koncept traži da postoji, a danas ne postoji u kodu. */
const CRITERIA = [
  ['clarity', 'Jasnoća'], ['usab', 'Upotrebljivost'], ['cred', 'Sportski kredibilitet'], ['hier', 'Vizuelna hijerarhija'],
  ['diff', 'Diferencijacija'], ['mob', 'Mobilni UX'], ['anim', 'Potencijal animacije'], ['scal', 'Dugoročna skalabilnost']
];
const SCORES = {
  '01': [4, 4, 5, 4, 4, 3, 4, 4], '02': [3, 3, 3, 5, 5, 4, 3, 2], '03': [5, 5, 3, 4, 2, 5, 3, 5], '04': [4, 4, 3, 3, 3, 4, 4, 3],
  '05': [5, 3, 3, 5, 4, 4, 4, 2], '06': [3, 3, 5, 3, 4, 3, 2, 4], '07': [4, 3, 4, 5, 5, 4, 3, 3], '08': [5, 4, 4, 4, 3, 4, 4, 5],
  '09': [4, 5, 3, 4, 3, 5, 4, 3], '10': [4, 3, 3, 4, 3, 4, 5, 4]
};
const NEEDS = {
  '01': 'ništa novo u domenu; mono font; labele ≥ 11 px (danas 9,5)',
  '02': 'tabela naslova po tipu treninga; izvor fotografija; Oporavak/Podešavanja ne staju u format članka',
  '03': 'ništa novo; najmanje karaktera',
  '04': '<b>nova logika dostignuća</b> („najbrže lagano“…) — nije u domenu; zavisi od Zajednice',
  '05': 'tiha varijanta za odmor/oporavak; kondenzovan font',
  '06': 'jezik bez žargona; tabele moraju da se pretvore u kartice < 360 px',
  '07': 'generator rečenica-zaključaka iz brojeva (aritmetika, ali mora se držati istine)',
  '08': '<b>ništa novo u domenu</b>: faze, nedelje, dani, urađeno/sledeće već postoje (<code>planPhases</code>, <code>weekChart</code>, <code>ResolvedWeek</code>, <code>log</code>)',
  '09': 'gestovi (sheet-drag, pager, swipe) + dugme-alternativa za svaki; sloj interakcije ~5–8 KB',
  '10': 'razvijanje slojeva + morf doka; sadržaj u zatvorenim slojevima je jedan dodir dalje'
};
const WEIGHTINGS = [
  ['Jednake težine', [1, 1, 1, 1, 1, 1, 1, 1]],
  ['Jasnoća + upotrebljivost + mobilni ×2', [2, 2, 1, 1, 1, 2, 1, 1]],
  ['Kredibilitet + diferencijacija + hijerarhija ×2', [1, 1, 2, 2, 2, 1, 1, 1]],
  ['Skalabilnost + kredibilitet + upotrebljivost ×2', [1, 2, 2, 1, 1, 1, 1, 2]],
  ['Animacija + diferencijacija ×2', [1, 1, 1, 1, 2, 1, 2, 1]]
];
function MATRIX_HTML() {
  const ids = CONCEPTS.map((c) => c.id);
  const tot = (id, w) => SCORES[id].reduce((a, v, i) => a + v * w[i], 0);
  const eq = Object.fromEntries(ids.map((id) => [id, tot(id, WEIGHTINGS[0][1])]));
  const best = Math.max(...Object.values(eq));
  const rank = (w) => ids.map((id) => [id, tot(id, w)]).sort((a, b) => b[1] - a[1]);
  const nm = (id) => CONCEPTS.find((c) => c.id === id).name;
  const rows = ids
    .map((id) => `<tr class="${eq[id] === best ? 'win' : ''}"><td><b>${id}</b> ${nm(id)}</td>${SCORES[id].map((s) => `<td class="s${s}">${s}</td>`).join('')}<td><b>${eq[id]}</b></td></tr>`)
    .join('');
  const sens = WEIGHTINGS.map(([n, w]) => {
    const r = rank(w);
    return `<tr><td>${n}</td><td>${r.slice(0, 3).map(([id, t]) => `<b>${id}</b> ${nm(id)} <span style="color:var(--dim)">${t}</span>`).join(' · ')}</td></tr>`;
  }).join('');
  const inTop3 = ids.map((id) => [id, WEIGHTINGS.filter(([, w]) => rank(w).slice(0, 3).some(([x]) => x === id)).length]).filter(([, n]) => n === WEIGHTINGS.length).map(([id]) => id);
  return `
<h2 class="sec">Ocena po 8 kriterijuma iz zadatka</h2>
<p class="note"><b>Ovo su moje ocene (1–5), ordinalne, dato posle gledanja renderovanih ekrana — ne merenje.</b> Razlike od 1–2 boda su šum. Zato ispod stoji provera osetljivosti: da li pobednik ostaje pobednik kad se težine promene.</p>
<div class="mxw"><table class="mx"><thead><tr><th>Koncept</th>${CRITERIA.map(([, t]) => `<th>${t}</th>`).join('')}<th>Σ</th></tr></thead><tbody>${rows}</tbody></table></div>
<h2 class="sec">Provera osetljivosti</h2>
<div class="mxw"><table class="mx" style="min-width:560px"><thead><tr><th>Težine</th><th style="text-align:left">Prva tri</th></tr></thead><tbody>${sens}</tbody></table></div>
<p class="note"><b>Zaključak.</b> Pobednik nije stabilan: pod „jasnoća + mobilni“ vodi 03, pod „kredibilitet + diferencijacija“ vode 01 i 07. <b>Samo koncept ${inTop3.map((i) => i + ' ' + nm(i)).join(', ')} ostaje u prva tri pod SVIH ${WEIGHTINGS.length} težina.</b> To je razlog izbora, a ne razlika u zbiru.</p>
<h2 class="sec">Šta koncept traži da postoji a ne postoji</h2>
<div class="mxw"><table class="mx" style="min-width:560px"><tbody>${ids.map((id) => `<tr><td style="white-space:nowrap"><b>${id}</b> ${nm(id)}</td><td style="text-align:left">${NEEDS[id]}</td></tr>`).join('')}</tbody></table></div>
<h2 class="sec">Odluka</h2>
<p class="note"><b>Izabran: 08 COMMAND CENTER</b> kao struktura (traka ciklusa uvek na vrhu, jedan dominantan panel „Danas“, završeno / sledeće, mapa ciklusa). Preuzimam <b>tačno četiri mehanizma</b> iz drugih pravaca, svaki sa razlogom: (1) <b>oznake porekla MERENO / PROCENA / PROJEKCIJA</b> u obliku koji najdoslednije sprovode 01 i 06 — direktno rešava nalaz audita o mešanju izmerenog i procenjenog; (2) <b>prikovana primarna akcija ≥ 56 px</b> sa 09 i 03; (3) <b>progresivno otkrivanje „Zašto“, zone pulsa</b> sa 03 i 10 — rešava „zid teksta“; (4) <b>naslov-zaključak na Napredku</b> sa 07 („Procena danas 20:13, cilj 19:59, razlika 14 s“) — samo aritmetika nad postojećim brojevima.</p>
<p class="note"><b>Rizik izabranog pravca.</b> Tamni paneli sa jednim akcentom su najbliži „generičkom dark dashboard-u“. Zaštita je u onome što je specifično za ovaj proizvod: boja <b>faze</b> kao jezik celog sistema, traka ciklusa, mapa ciklusa kao kalendar treninga, tipografski glas (uski verzal za oznake + brojevi 800). Ako implementacija izgubi ta četiri elementa, postaje generička — to je kriterijum za završnu proveru.</p>`;
}
