/* 5 KM — TEKSTOVI ZA TRKAČA (latinica, ekavica). Zamene motora: {n} broj komada, {rep} komad, {rec} oporavak,
   {dose} rad, {len} dužina dana, {pace} mesto tempa zone rada (motor ga upisuje samo u ispis). Brojevi sa imenicom ne
   idu u tekst (množinu radi motor); tempo ne ide u tekst (čita se iz zaglavlja). Bez internih izraza. Dan trke 5 km
   nema priče o ishrani tokom trke: trka traje do ≈ 40 min. Brzi treninzi nose napomenu o dužem zagrevanju sa
   ubrzanjima (rad 5 km je najbrži u nedelji). */
import type { NoteRule } from '../../engine/types';

export const TEXTS: Record<string, string> = {
  /* lagano i dugi */
  lagano: 'lagano {len}',
  dugi: 'dugi {len} lagano',
  'dugi-hod': 'dugi {len} hod-trk: 5 min lagano trčanje + 1 min brz hod, ponavljaj do kraja',
  'dugi-prag': 'dugi {len}, završnih {dose} u pragu{pace}',
  'dugi-progresivno': 'dugi {len}, poslednjih {dose} progresivno od laganog do praga{pace}',
  ubrzanja: 'lagano {len}, na kraju {n} × {rep} ubrzanja, oporavak {rec}',
  'usponi-kratki': 'lagano {len}, usred trčanja {n} × {rep} jako uzbrdo, nazad {rec}',

  /* kvalitet */
  'r-200': 'brze deonice {n} × {rep}{pace}, oporavak {rec}',
  'r-300': 'brze deonice {n} × {rep}{pace}, oporavak {rec}',
  'r-400': 'brze deonice {n} × {rep}{pace}, oporavak {rec}',
  'brda-45': 'usponi {n} × {rep} snažno uzbrdo, nazad {rec}',
  fartlek: 'fartlek {n} × {rep} živo, između {rec} lagano',
  'prag-komad': 'prag {rep} u komadu{pace}',
  'prag-deonice': 'prag {n} × {rep}{pace}, oporavak {rec}',
  intervali: 'intervali {n} × {rep}{pace}, oporavak {rec}',
  'rp-deonice': 'tempo trke {n} × {rep}{pace}, oporavak {rec}',
  ostrenje: 'oštrenje: tempo trke {n} × {rep}{pace}, oporavak {rec}',
  'kontrola-3k': 'provera forme: test na 3 km punim naporom, ravnomerno (ili parkrun 5 km)',
  'kontrola-1500': 'provera forme: 1,5 km jako i ravnomerno — napor koji jedva držiš do kraja',
  'kontrola-rana-3k': 'provera forme: test na 3 km punim naporom, ravnomerno',
  'kontrola-rana-1500': 'provera forme: 1,5 km jako i ravnomerno',

  /* napomene */
  'napomena.kontrola':
    'Rezultat ove provere postaje nova polazna forma: tempa i prognoza za trku se računaju iz njega od sledeće nedelje. Prvi kvalitet posle provere je najranije 4 dana kasnije.',
  'napomena.zagrevanje':
    'Zagrevanje je deo treninga: lagano, pa 4–6 ubrzanja po 20 s pre prve deonice. Hladno telo ne može brzo.',
  'napomena.dugi':
    'Dugi je lagan: tempo u kome možeš da pričaš u celim rečenicama. Za 5 km dugi gradi osnovu, ne brzinu.',
  'napomena.dugi-blok':
    'Završni deo trči ravnomerno; ako ne možeš da ga držiš, skrati ga — ne ubrzavaj.',

  'napomena.trka':
    'Zagrevanje 15 min lagano + 4 ubrzanja, završi 5–10 min pre starta. 1. km {paceFrom}–{paceTo} (ne brže od {pace}), 2.–4. km ravnomerno {pace}, poslednji km sve što imaš. Ne kreći u guži brže od plana: prvih 400 m odlučuje trku.',
  'napomena.trka.po-osecaju':
    'Zagrevanje 10–15 min lagano + 4 ubrzanja, završi 5–10 min pre starta. 1. km malo lakše nego što ti se čini da možeš, 2.–4. km ravnomerno, napor koji možeš da držiš do kraja, poslednji km sve što imaš.',

  /* trka i faze */
  race: 'trka — 5 km',
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
  'napor.RP': 'napor koji možeš da držiš {duration}, napor 8 od 10'
};

/** Napomene po vrsti i trajanju treninga. */
export const NOTE_RULES: NoteRule[] = [
  {
    kinds: ['race'],
    minDurationSec: 0,
    text: 'napomena.trka',
    byFeelText: 'napomena.trka.po-osecaju'
  },
  { kinds: ['long'], minDurationSec: 4200, text: 'napomena.dugi' }
];
