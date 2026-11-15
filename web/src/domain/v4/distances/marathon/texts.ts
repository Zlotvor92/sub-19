/* MARATON — TEKSTOVI ZA TRKAČA (latinica, ekavica). Zamene motora: {n} broj komada, {rep} komad, {rec} oporavak,
   {dose} rad, {len} dužina dana, {pace} mesto tempa zone rada (motor ga upisuje samo u ispis). Brojevi sa imenicom ne idu u tekst (množinu radi motor); tempo ne ide u tekst
   (čita se iz zaglavlja). Bez internih izraza. */
import type { NoteRule } from '../../engine/types';

export const TEXTS: Record<string, string> = {
  /* lagano i dugi */
  lagano: 'lagano {len}',
  dugi: 'dugi {len} lagano',
  'dugi-hod': 'dugi {len} hod-trk: 10 min lagano trčanje + 1 min brz hod, ponavljaj do kraja',
  'dugi-rp': 'dugi {len}, poslednjih {dose} u tempu maratona{pace}',
  'dugi-progresivno':
    'dugi {len}, poslednjih {dose} progresivno od laganog do tempa maratona{pace}',
  ubrzanja: 'lagano {len}, na kraju {n} × {rep} ubrzanja, oporavak {rec}',
  'usponi-kratki': 'lagano {len}, usred trčanja {n} × {rep} jako uzbrdo, nazad {rec}',
  'lagano-rp': 'lagano {len}, usred trčanja {n} × {rep} u tempu maratona, oporavak {rec}',

  /* kvalitet */
  'r-200': 'brze deonice {n} × {rep}{pace}, oporavak {rec}',
  'r-300': 'brze deonice {n} × {rep}{pace}, oporavak {rec}',
  'r-400': 'brze deonice {n} × {rep}{pace}, oporavak {rec}',
  'r-30s': 'brze deonice {n} × {rep} brzo i opušteno{pace}, oporavak {rec}',
  'brda-60': 'usponi {n} × {rep} snažno uzbrdo, nazad {rec}',
  'prag-komad': 'prag {rep} u komadu{pace}',
  'prag-deonice': 'prag {n} × {rep}{pace}, oporavak {rec}',
  intervali: 'intervali {n} × {rep}{pace}, oporavak {rec}',
  'intervali-lestvica': 'intervali lestvica {rep}{pace}, oporavak {rec}',
  'rp-deonice': 'tempo maratona {n} × {rep}{pace}, oporavak {rec}',
  'rp-komad': 'tempo maratona {rep} u komadu{pace}',
  ostrenje: 'oštrenje: tempo maratona {n} × {rep}{pace}, oporavak {rec}',
  'kontrola-10k': 'provera forme: pripremna trka ili test na 10 km punim naporom',
  'kontrola-hm': 'pripremna trka: polumaraton punim naporom, ravnomerno',
  'kontrola-5k': 'provera forme: trka ili test na 5 km punim naporom',
  'kontrola-rana': 'provera forme: test na 3 km punim naporom, ravnomerno',
  'kontrola-rana-5k': 'provera forme: test na 5 km punim naporom, ravnomerno',
  'kontrola-3k': 'provera forme: test na 3 km punim naporom',

  /* napomene */
  'napomena.kontrola':
    'Rezultat ove provere postaje nova polazna forma: tempa i prognoza za trku se računaju iz njega od sledeće nedelje.',
  /* ishrana i tečnost su sadržaj plana (README): unos na 35–40 min, voda uz svaki unos, proba na dugim */
  /* R17 (sudija 2): trka duža od 4 h 30 — ista hod-trk strategija kao na dugim; R20: 10 + 1 kao u dugom hod-trk */
  'napomena.trka-hod':
    'Hod-trk od starta: 10 min trčanja + 1 min brzog hoda, isti ritam kao hod-trk na dugim (ako ti dugi nisu bili hod-trk, probaj ga na poslednja dva duga), i na svakoj okrepi hod dok piješ. Tako stižeš do cilja bez zida — ne preskači hod ni kad se osećaš sveže.',
  'napomena.dugi':
    'Ishrana na dugom: gel ili sportski napitak na svakih 35–40 min, od 35. min, uz par gutljaja vode svaki put. Probaj tačno ono što ćeš koristiti na trci (vrsta gela, raspored) — na trci ništa novo.',
  'napomena.dugi-obuca':
    'Najduže dugo trči u patikama i odeći za trku: tada se vidi da li žulja ili trlja. Patike za trku neka imaju 50–150 km pre starta, ne nove.',
  'napomena.kontrola-hm':
    'Trči ga kao trku: prva 3 km mirno, zatim ravnomerno najjače što možeš do kraja. To je i proba maratona — doručak, oprema i gelovi tačno kao na maratonu. Rezultat postaje nova forma (tempo maratona i prognoza); sledeća nedelja je bez brzih treninga.',
  'napomena.dugi-blok':
    'Blok trči ravnomerno u tempu maratona, ne brže; unos gela vežbaj i tokom bloka, kao na trci. Ako tempo ne možeš da držiš bez naprezanja, skrati blok — ne ubrzavaj.',
  'napomena.trka':
    'Prvih 5–10 km trči {paceFrom}–{paceTo}, mirno, iako ti se čini lako; od 10. do 32. km {pace}; poslednjih 10 km po osećaju. Zid (≈ 30.–35. km): ne staj — skrati korak, uzmi gel i vodu, drži ritam. Zagrevanje 5–10 min lagano hodanje i džog; doručak 3 h pre starta, isti kao pred najduži dugi.',
  'napomena.trka.po-osecaju':
    'Prvih 10 km trči lakše nego što ti se čini da možeš (pričaš u celim rečenicama), do 32. km ravnomerno, napor koji možeš da držiš do kraja; poslednjih 10 km po osećaju. Hod 1 min na okrepama je dozvoljen. Zid (≈ 30.–35. km): ne staj — skrati korak, uzmi gel i vodu. Doručak 3 h pre starta, isti kao pred najduži dugi.',
  'napomena.trka-unos':
    'Ishrana na trci: gel svakih 35–40 min od 35. minuta, kao na dugim, piće na svakoj okrepi. Poslednja 2–3 dana pred trku više ugljenih hidrata (testenina, pirinač, hleb); na dan trke ništa novo — ni hrana, ni patike, ni odeća.',

  /* trka i faze */
  race: 'trka — maraton',
  'faza.osnova': 'osnova',
  'faza.razvoj': 'razvoj',
  'faza.posebna': 'specifična priprema',
  'faza.zavrsna': 'završnica',

  /* napor po zoni kad tempa još nisu pouzdana */
  'napor.E': 'možeš da pričaš u celim rečenicama, napor 3–4 od 10',
  'napor.M': 'ravnomerno, kratke rečenice, napor 5 od 10',
  'napor.T': 'ugodno teško, samo par reči, napor 7 od 10',
  'napor.I': 'teško, ali isto do poslednje deonice, napor 8 od 10',
  'napor.R': 'brzo i opušteno, uz pun oporavak, napor 8–9 od 10',
  /* T5 (krug 6): trajanje iz očekivanog vremena trkača (p10, p12: ne „sat i po do dva" za 2:01–2:10) */
  'napor.RP': 'napor koji možeš da držiš {duration}, napor 6 od 10'
};

/** Napomene po vrsti i trajanju treninga. */
export const NOTE_RULES: NoteRule[] = [
  {
    kinds: ['race'],
    minDurationSec: 0,
    text: 'napomena.trka',
    byFeelText: 'napomena.trka.po-osecaju'
  },
  { kinds: ['race'], minDurationSec: 0, text: 'napomena.trka-unos' },
  { kinds: ['race'], minDurationSec: 16200, text: 'napomena.trka-hod' },
  /* svaki dugi ≥ 90 min nosi unos (README) */
  { kinds: ['long'], minDurationSec: 5400, text: 'napomena.dugi' },
  /* najduži dugi (≥ 2 h 50; sudija 2: ne na svakom dugom od 2 h 30): oprema za trku */
  { kinds: ['long'], minDurationSec: 10200, text: 'napomena.dugi-obuca', onlyLongest: true }
];
