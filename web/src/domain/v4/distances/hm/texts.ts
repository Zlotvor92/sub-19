/* POLUMARATON — TEKSTOVI ZA TRKAČA (latinica, ekavica). Zamene motora: {n} broj komada, {rep} komad, {rec} oporavak,
   {dose} rad, {len} dužina dana, {pace} mesto tempa zone rada (motor ga upisuje samo u ispis). Brojevi sa imenicom ne idu u tekst (množinu radi motor); tempo ne ide u tekst
   (čita se iz zaglavlja). Bez internih izraza. */
import type { NoteRule } from '../../engine/types';

export const TEXTS: Record<string, string> = {
  /* lagano i dugi */
  lagano: 'lagano {len}',
  dugi: 'dugi {len} lagano',
  'dugi-rp': 'dugi {len}, završni deo {dose} u tempu trke{pace}',
  'dugi-progresivno': 'dugi {len}, završni deo {dose} progresivno do tempa trke{pace}',
  ubrzanja: 'lagano {len}, na kraju {n} × {rep} ubrzanja, oporavak {rec}',
  'usponi-kratki': 'lagano {len}, usred trčanja {n} × {rep} jako uzbrdo, nazad {rec}',

  /* kvalitet */
  'r-200': 'brze deonice {n} × {rep}{pace}, oporavak {rec}',
  'r-300': 'brze deonice {n} × {rep}{pace}, oporavak {rec}',
  'r-400': 'brze deonice {n} × {rep}{pace}, oporavak {rec}',
  'brda-60': 'usponi {n} × {rep} snažno uzbrdo, nazad {rec}',
  'prag-komad': 'prag {rep} u komadu{pace}',
  'prag-deonice': 'prag {n} × {rep}{pace}, oporavak {rec}',
  intervali: 'intervali {n} × {rep}{pace}, oporavak {rec}',
  'intervali-lestvica': 'intervali lestvica {rep}{pace}, oporavak {rec}',
  'rp-deonice': 'tempo trke {n} × {rep}{pace}, oporavak {rec}',
  'rp-komad': 'tempo trke {rep} u komadu{pace}',
  ostrenje: 'oštrenje: tempo trke {n} × {rep}{pace}, oporavak {rec}',
  'kontrola-10k': 'provera forme: trka ili test na 10 km punim naporom',
  'kontrola-5k': 'provera forme: trka ili test na 5 km punim naporom',
  'kontrola-3k': 'provera forme: test na 3 km punim naporom',

  /* napomene */
  'napomena.kontrola':
    'Rezultat ove provere postaje nova polazna forma: tempa i prognoza za trku se računaju iz njega od sledeće nedelje.',
  'napomena.dugi':
    'Ponesi vodu; posle 60 min unesi gel ili sportski napitak na svakih 30–40 min, isto kao na trci.',
  'napomena.dugi-blok':
    'Završni deo trči ravnomerno u tempu trke; ako ne možeš da ga držiš, skrati ga — ne ubrzavaj.',

  /* trka i faze */
  race: 'trka — polumaraton',
  'faza.osnova': 'osnova',
  'faza.razvoj': 'razvoj',
  'faza.posebna': 'specifična priprema',
  'faza.zavrsna': 'završnica',

  /* napor po zoni kad tempa još nisu pouzdana */
  'napor.E': 'možeš da pričaš u celim rečenicama (napor 3–4 od 10)',
  'napor.M': 'ravnomerno, kratke rečenice (napor 5 od 10)',
  'napor.T': 'ugodno teško, samo par reči (napor 7 od 10)',
  'napor.I': 'teško, ali isto do poslednje deonice (napor 8 od 10)',
  'napor.R': 'brzo i opušteno, uz pun oporavak (napor 8–9 od 10)',
  'napor.RP': 'napor koji možeš da držiš sat i po do dva (napor 6 od 10)'
};

/** Napomene po vrsti i trajanju treninga. */
export const NOTE_RULES: NoteRule[] = [
  { kinds: ['long'], minDurationSec: 4500, text: 'napomena.dugi' }
];
