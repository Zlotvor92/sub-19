/* AUDIT POSTOJEĆEG UI-JA — svaka brojka je izmerena (CSS parser, DOM merenje u Chromium-u na 390 × 844, grep). */
const AUDIT = {
  short: `<dl style="display:grid;grid-template-columns:130px 1fr;gap:8px 16px;font-size:13.5px">
<dt>Vizuelni jezik</dt><dd>Staklo + ambijentalni gradijenti (6 radial-gradient slojeva po tabu, 12 backdrop-filter). Upravo ono što brief isključuje.</dd>
<dt>Kartica</dt><dd>Jedini kontejner: 65 upotreba <code>.card</code>, 4 kopije iste komponente zaglavlja.</dd>
<dt>Tekst</dt><dd>70 od 93 tekstualnih čvorova na Planu je ispod 11 px (min 8,3 px).</dd>
<dt>Semantika</dt><dd>0 naslova (h1–h4) na sva 4 glavna taba.</dd>
<dt>Today</dt><dd>Dva jednaka bloka (odbrojavanje + niz) iznad treninga; trening je treći po težini.</dd></dl>`,
  full: () => `
<h2 class="sec">Audit postojećeg UI-ja (web/src)</h2>
<p class="note"><b>Način.</b> Aplikacija je izgrađena i pokrenuta u Chromium-u (390 × 844, DPR 2), plan 5K sub-20 napravljen kroz pravi čarobnjak, zatim popunjen do nedelje 6 od 12. CSS je parsiran, DOM izmeren. <b>Ništa nije menjano.</b> Merenja performansi na pravom telefonu <b>nisu</b> rađena — nedovoljno dokaza o brzini, osim veličine paketa.</p>
<div class="befores">${[['10-danas-pending-fold', 'Danas (nedelja 6)'], ['11-danas-done-fold', 'Danas posle „Završi“'], ['20-plan-fold', 'Plan'], ['30-oporavak-fold', 'Oporavak'], ['40-trka-fold', 'Trka'], ['22-day-sheet', 'List dana']].map(([k, t]) => `<figure><img loading="lazy" src="${BEFORE[k]}" alt="${t}"><figcaption>${t}</figcaption></figure>`).join('')}</div>
<h2 class="sec">Izmereno</h2>
<div class="mxw"><table class="mx" style="min-width:600px"><thead><tr><th>Mera</th><th>Danas</th><th>Plan</th><th>Oporavak</th><th>Trka</th></tr></thead><tbody>
<tr><td>Visina ekrana (px, 390 px širina)</td><td>599</td><td>1097</td><td>1704</td><td>1273</td></tr>
<tr><td><code>.card</code> elemenata</td><td>3</td><td>2</td><td>5</td><td>5</td></tr>
<tr><td>Naslova h1–h4</td><td class="s1">0</td><td class="s1">0</td><td class="s1">0</td><td class="s1">0</td></tr>
<tr><td>Najmanji tekst (px)</td><td>9,9</td><td class="s1">8,3</td><td class="s1">8,5</td><td class="s1">8,5</td></tr>
<tr><td>Tekst ispod 11 px</td><td>5 / 29</td><td class="s1">70 / 93</td><td>29 / 52</td><td>28 / 43</td></tr>
<tr><td>Interaktivnih ispod 44 × 44 px</td><td>0 / 2</td><td>0 / 12</td><td class="s1">26 / 36</td><td class="s1">25 / 27</td></tr></tbody></table></div>
<p class="note">Interaktivni ispod 44 px na Oporavku i Trci su skoro svi pogoci grafikona (SVG krug r = 11 → 22 px) i delovi mape tela. Kolone nedeljnog grafikona su ≈ 27 px široke.</p>
<div class="mxw"><table class="mx" style="min-width:600px"><thead><tr><th>CSS / kod</th><th>Vrednost</th></tr></thead><tbody>
<tr><td><code>legacy.css</code> (ceo stil, i dalje zove „legacy“)</td><td>1128 linija · 72,8 KB (9,8 KB gzip)</td></tr>
<tr><td>Različitih veličina fonta</td><td class="s1">48 (52 pravila ispod 11 px)</td></tr>
<tr><td>Različitih <code>border-radius</code></td><td class="s1">18</td></tr>
<tr><td><code>backdrop-filter</code> · <code>radial-gradient</code> · <code>rgba()</code> literala</td><td>12 · 23 · 124</td></tr>
<tr><td>Inline <code>style={{…}}</code> u TSX</td><td>169 (23 u <code>recovery/cards.tsx</code>)</td></tr>
<tr><td>Isti „zaglavlje kartice“ napisan iznova</td><td class="s1">4× (<code>DayHeader</code>, <code>DayCardTitle</code>, <code>Head</code>, <code>CardHead</code>)</td></tr>
<tr><td>Biblioteke za animaciju / grafikone</td><td>nema (samo CSS i ručni SVG) — dobro, zadržati</td></tr>
<tr><td>Početni paket (gzip) / CSS (gzip)</td><td>204,6 KB / 9,8 KB · ostali tabovi lenji (2,6–9 KB svaki)</td></tr></tbody></table></div>
<h2 class="sec">Nalazi</h2>
<div class="aud">
<div><h3>Izgleda kao generički AI dashboard</h3><ul>
<li>Staklene kartice + ambijentalne mrlje iza (šest slojeva po tabu). <span>Brief ih izričito isključuje.</span></li>
<li>Dva jednaka „hero“ bloka sa velikim brojem (dana do trke, niz) iznad treninga.</li>
<li>Dva prstena na Planu, dva na Trci — prstenovi su ukras kad su prazni (0 % / „—“ na prvom danu).</li>
<li>Sitna kapitalna labela iznad svakog bloka (<code>.card-t</code> 10,9 px) kao jedini nivo naslova.</li></ul></div>
<div><h3>Komponente „jer je bilo najlakše“</h3><ul>
<li><b>Hero sa odbrojavanjem i nizom</b> — podaci su postojali, pa su stavljeni na vrh.</li>
<li><b>12 kartica-prstenova u mreži 4 × 3</b> za nedelje: svaka ista težina, bez faze.</li>
<li><b>Posle „Završi“ uvek stiže forma</b> (4 prazna polja + „Više detalja“): stanje uspeha je obrazac za unos.</li>
<li><b>Šest kartica u steku</b> na urađenom danu (Plan, Uneto, Sa sata, Po zonama, Jutros, Ista sesija, AI).</li>
<li><b>Forma za masu</b> unutar taba Oporavak.</li></ul></div>
<div><h3>Previše teksta za razumevanje</h3><ul>
<li>Oporavak: status „Bez povreda“ nosi legendu „0 = bez bola · 3–5 = pazi · 6+ = stani · 3+ dana ≥3 u 7 dana = fizijatar“.</li>
<li>Oporavak: opterećenje je rečenica o tome <i>kad</i> će se prikazati, ne šta uraditi.</li>
<li>Trka: dva pasusa o testu na 3 km pre samog unosa.</li>
<li>Čarobnjak: jedna napomena od ≈ 70 reči.</li></ul></div>
<div><h3>Nedostaje hijerarhija i fokus</h3><ul>
<li>Today: odgovor na „šta trčim danas?“ je mala pilula 10,9 px („TEMPO ISPREKIDAN“). Veći je broj dana do trke.</li>
<li>Zaglavlje ponavlja „46 dana do trke“ koje hero ponavlja ispod.</li>
<li>Uputstvo „kako i zašto“ (<code>sessionGuide</code>) postoji, ali se prikazuje <b>samo u listu dana</b> na Planu, ne na Today.</li>
<li>„Niz dana po planu“ se vraća na 1 posle jednog propuštenog dana (snimak: 1, a plan je 96 % ispunjen). <span>Mišljenje: to je loš primarni broj; činjenica: dva jednaka bloka pre treninga.</span></li></ul></div>
<div><h3>Plan izgleda kao tabela prstenova</h3><ul>
<li>Faze (BAZA / RAZVOJ / VRHUNAC / TAPER I TRKA) su 9,6 px labele sa linijom; nemaju sopstveni vizuelni identitet.</li>
<li>TAPER i TRKA su spojeni u jednu grupu — a baš taper i trka su vrhunac priče.</li>
<li>Grafikon „plan vs. ostvareno“ nema poruku (natpis: „Dodirni nedelju za detalje“).</li>
<li>Nema prikaza „gde sam u ciklusu“ na Today osim teksta u zaglavlju.</li></ul></div>
<div><h3>Podaci: izmereno / procena / projekcija se mešaju</h3><ul>
<li>VDOT 48,1 je <b>procena</b> iz PB-a, ali stoji kao „tvoja forma“ bez oznake.</li>
<li>Legenda na grafikonu predikcije: „ostvareno · plan (referenca) · cilj“ — nema „procena“, nema „projekcija“.</li>
<li>Čarobnjak piše „48.1“, Trka „48,1“ (<b>nedosledan format broja</b>).</li>
<li>Test 3 km je jedini istinski izmeren signal forme, a vizuelno je jednak ostalim karticama.</li></ul></div>
<div><h3>Izgleda kao web admin panel</h3><ul>
<li>Podešavanja: jedan list sa grupama (<code>tablist</code>) i <code>details</code> akordeonima, uključujući admin sekcije.</li>
<li>Today posle završetka: formular (DISTANCA / VREME / PROS. TEMPO / PROS. PULS) kao CRUD forma.</li>
<li>Emoji kao ikone (📈 ✏️ 💡) pored SVG ikonica i unicode znakova (⇄ ⏭ ✓): nema sistema ikonica.</li></ul></div>
<div><h3>Pristupačnost i mobilni</h3><ul>
<li>0 naslova na glavnim ekranima — čitač ne može da skače po naslovima.</li>
<li>Pogoci grafikona 22 px; kolone nedeljnog grafikona ≈ 27 px.</li>
<li>Tekst 8,3–10,9 px (52 CSS pravila ispod 11 px).</li>
<li>Zaglavlje je sticky (≈ 72 px) na svakom ekranu i ponavlja „nedelja / dana do trke“.</li></ul></div>
<div><h3>Šta je dobro i ostaje</h3><ul>
<li>Cifre su tabularne; kontrast <code>--txt3</code> je već popravljen na ≥ 4,5:1.</li>
<li><code>prefers-reduced-motion</code> postoji (2 bloka); list pravilno koristi <code>inert</code> i vraća fokus.</li>
<li>Prevlačenje između tabova, stepenasto ulaženje i punjenje prstenova — funkcionalna animacija.</li>
<li>Lenjo učitavanje po tabu; nema biblioteka za animaciju/grafikone.</li>
<li>Domen je čist: UI već dobija gotove modele (<code>sessionBreakdown</code>, <code>planPhases</code>, <code>weekChart</code>…).</li></ul></div>
</div>`
};
