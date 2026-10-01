/* Kratko uputstvo za izvođenje po tipu sesije. Ključ je izlaz `sessKind` (isti za sve planove). Fokus je na kvalitetnim
   tipovima gde tehnika/pristup stvarno menja efekat. Tekst je PROIZVODNA ODLUKA (savet, ne merenje). */

const GUIDE: Readonly<Record<string, string>> = {
  Intervali:
    'Isti tempo na svakom ponavljanju — nemoj da kreneš brže na prvom. Ostani opušten i kontrolisan i kad postane teško.',
  Repeticije:
    'Odmaraj se do kraja između ponavljanja — ovo je trening brzine i ekonomije trčanja, ne izdržljivosti na pragu. Trči opušteno, ne na silu.',
  Tempo:
    '„Udobno teško" — kratku rečenicu možeš da izgovoriš, ali razgovor ne. Drži isti napor od početka do kraja i nemoj da kreneš prebrzo.',
  'Tempo isprekidan':
    'Isti tempo i napor kao kod neprekidnog tempa — kratka pauza je samo predah, ne novi početak. Cilj je da ceo trening deluje kao jedan neprekidan napor.',
  Fartlek:
    'Vodi se po naporu, ne po štoperici — ubrzanja su snažan zalet, ne sprint. U lakim delovima se potpuno opusti.',
  'Progresivno (tempo trke)':
    'Kreni namerno lagano, a poslednju trećinu drži TAČNO na tempu trke — ne brže. Poenta je da naučiš taj tempo na umornim nogama, a ne da testiraš koliko možeš.',
  Progresivno:
    'Kreni namerno lagano — svaki sledeći deo treba da bude brži od prethodnog. Najčešća greška je prebrz početak.',
  'Trkački ritam':
    'Tačno tvoj ciljani tempo trke — ni sekundu brže. Ovde se vežba osećaj za ritam i disciplina, ne koliko možeš.',
  Piramida:
    'Drži isti NAPOR na svakoj deonici, ne isti tempo — kraće deonice prirodno idu brže. Nemoj da kreneš prejako na najkraćoj, da ne „pukneš" na vrhu piramide.',
  'Maratonski tempo':
    'Tačno tvoj ciljani tempo trke — ovo je proba, a ne prilika da guraš jače. Ako je trčanje dovoljno dugo, iskoristi ga i za vežbanje ishrane i hidratacije.',
  '10K tempo (ciljni ritam)':
    'Tačno tvoj ciljani tempo trke — ovde se vežba disciplina tempa, ne guranje preko njega.',
  'HM tempo (ciljni ritam)':
    'Tačno tvoj ciljani tempo trke — ovde se vežba disciplina tempa, ne guranje preko njega.',
  'Tempo trke':
    'Tačno tvoj ciljani tempo polumaratona — ni sekundu brže. Ovde se vežba disciplina tempa i osećaj za njega; pauza je lagano trčanje, ne stajanje.',
  'Kontrolna trka':
    'Generalna proba: isprobaj opremu, doručak i gorivo tačno kako planiraš na dan trke. Ako trčiš pravu 10K trku, trči je punom snagom; ako je istrčavaš sam, drži tempo polumaratona.',
  'Dugo (LR)':
    'Ravnomeran, lagan tempo — trebalo bi da možeš da razgovaraš bez zadihanosti. Ako ti poslednji kilometar bude teži od prvog, sledeći put kreni sporije.',
  Lako: 'Zaista lako — ovo je dan za oporavak, ne za „malo brže jer se osećam dobro". Ako ne možeš da pričaš u punim rečenicama, usporavaj.',
  'Trčanje/hod':
    'Pauzu za hod uzmi PRE nego što se umoriš, ne kad moraš — u tome je cela poenta. Deo za trčanje drži lagan, hod neka bude živ.',
  TRKA: 'Prvi kilometar drži ciljani tempo i kad ti deluje prelako — najčešća greška je prebrz start. Poslednju trećinu odlučuje ono što si sačuvao na početku.',
  Test: 'Trči kao pravu trku, ali bez pritiska — cilj je tačna procena forme, ne rekord. Isti uslovi (staza, doba dana) daju uporediv rezultat.'
};

/** Uputstvo za vrstu sesije; `null` kad za nju nema (vlastita svojstva — „constructor" nije uputstvo). */
export function sessionGuide(kind: string): string | null {
  return Object.prototype.hasOwnProperty.call(GUIDE, kind) ? (GUIDE[kind] as string) : null;
}
