# Sabotaže: dokaz da testovi hvataju grešku

`web/scripts/sabotage.mjs` namerno unese grešku u produkcioni kod (find/replace), pokrene test fajlove koji treba da je
uhvate, UVEK vrati original i proveri da je stanje `web/src` bajt-isto kao pre. Sabotaža koju nijedan test ne obori je
neuspeh (izlaz ≠ 0). Podrazumevano radi u BRZOM nivou (bez `TEST_FULL`) sa `--bail=1`: prvi pali test je dokaz.

Čist Node ≥ 22 bez zavisnosti; poziva `git` i lokalni `vitest`. Radi i nad necommitovanim izmenama segmenta (normalan
slučaj) — ne dira ih.

## Pokretanje (iz `web/`)

```sh
node scripts/sabotage.mjs ../docs/testing/sabotage-06c.json              # sve, redom, u ovom direktorijumu
node scripts/sabotage.mjs ../docs/testing/sabotage-06c.json --only 06c-d # jedna (indeks od 1, ime ili početak imena)
node scripts/sabotage.mjs ../docs/testing/sabotage-06c.json --dry-run    # samo provera ulaza (find tačno 1×), bez testova
node scripts/sabotage.mjs <ulaz.json> --json ../sabotaze.json            # i rezultat kao JSON
node scripts/sabotage.mjs <ulaz.json> -- --maxWorkers=1                  # posle `--`: dodatni argumenti za vitest
node scripts/sabotage.mjs --help
```

| opcija           | značenje                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `--only <x>`     | samo sabotaža `x`: indeks (od 1), tačno ime ili jedinstven početak imena; može više puta     |
| `--full`         | PUN nivo (`TEST_FULL=1`); bez nje se `TEST_FULL` uklanja iz okruženja                        |
| `--all-failures` | bez `--bail`: pun spisak palih testova (sporo — samo kad se izričito traži)                  |
| `--parallel <N>` | N sabotaža istovremeno, svaka u privremenom `git worktree`-u; glavni direktorijum se ne dira |
| `--json <fajl>`  | rezultat: ime, pao, prvi pali, (svi pali), trajanje, heš pre / sabotirano / posle            |
| `--quiet`, `-q`  | bez izlaza vitest-a (uz `--parallel` uvek; kraj izlaza se prikaže samo kod greške)           |
| `--dry-run`      | proveri ulaz i jedinstvenost `find`, ništa ne menja i ne pokreće                             |
| `--restore`      | posle pada procesa (SIGKILL, nestanak struje): vrati fajlove iz rezervne kopije              |

Izlazni kod: **0** svaka sabotaža je oborila bar jedan test i stanje je vraćeno; **1** bar jedna NIJE PALA ili
greška (ulaz, vitest, worktree); **2** pogrešna upotreba, drugo pokretanje u toku ili zaostala rezervna kopija;
**3** stanje `src` posle vraćanja nije isto kao pre (najteže — pogledaj `git status`; ispis kaže koji fajl).

## Ulaz

JSON niz. Putanje su relativne na `web/`.

```json
[
  {
    "name": "06c-e reduced se ne čita",
    "file": "src/domain/generators/tenK/v2/steps.ts",
    "find": "const reduced = s.reduced ?? (s.startKm !== null && s.levelKm !== null);",
    "replace": "const reduced = s.startKm !== null && s.levelKm !== null;",
    "tests": ["src/domain/generators/tenK/v2/reliefGrid.node.test.ts"]
  },
  {
    "name": "06c-d koraci sa novim startom ulaze u A17",
    "edits": [
      {
        "file": "src/domain/generators/tenK/v2/steps.ts",
        "find": "  if (s.restart) return null;\n",
        "replace": ""
      },
      {
        "file": "src/domain/generators/tenK/v2/steps.ts",
        "find": "  if (s.restart) return [];\n",
        "replace": ""
      }
    ],
    "tests": ["src/domain/generators/tenK/v2/reliefGrid.node.test.ts"]
  }
]
```

- `find` mora postojati **tačno jednom** u fajlu (broje se i preklopljena pojavljivanja). Više izmena istog fajla se
  primenjuje redom; `find` se broji u sadržaju posle prethodnih izmena. Ako bilo koja izmena ne prođe, sabotaža se ne
  primenjuje uopšte (GREŠKA), alat ide dalje, izlaz je ≠ 0.
- Poklapanje je bajt-tačno (razmaci, `\n`); fajl mora biti ispravan UTF-8. Izmena koja ne menja fajl je greška.
- `tests`: postojeći fajlovi; `*.full.node.test.ts` samo uz `--full` (u brzom nivou nisu u projektu `node`). Alat
  postavlja `TEST_V1=1`, pa i testovi projekta `v1` (poređenje v1 sa referencama, u brzom nivou inače isključen) mogu
  da budu cilj sabotaže.
- Dodatni ključevi (npr. `"opis"`) se ignorišu; imena moraju biti jedinstvena.
- Novu sabotažu prvo proveri sa `--dry-run --only <ime>`.

## Šta alat radi i garantuje

1. Jednom, pre početka: **heš stanja** = sha256 od `git diff --binary HEAD -- src` (+ sabotirani fajlovi van `src`,
   ako ih ima) i spiska i sadržaja neverzionisanih fajlova (`git ls-files --others --exclude-standard -- src`).
2. Za svaku izmenu proveri `find` (tačno 1×). Sve se računa u memoriji pre ikakvog upisa.
3. Original ostaje u memoriji I u rezervnoj kopiji `web/node_modules/.cache/sabotage/` (sa `lock.json`) pre upisa
   sabotaže. `lock.json` ujedno sprečava dva istovremena pokretanja u istom direktorijumu.
4. `vitest run <tests> --reporter=dot --reporter=json --outputFile.json=<tmp> --bail=1` (lokalni
   `node_modules/.bin/vitest`; bez `--bail` uz `--all-failures`; `TEST_FULL=1` samo uz `--full`).
5. Original se vraća u `finally`, na SIGINT/SIGTERM/SIGHUP i na izlazu procesa; zatim se heš stanja ponovo računa i
   mora biti isti kao u koraku 1 (inače glasna greška sa imenom fajla, izlaz 3, ostale sabotaže se ne pokreću).
6. Ishod po sabotaži: **PAO** (bar jedan pali test; prvi pali kao `fajl > describe > it`, broj palih, prva linija
   poruke), **NIJE PAO** (svi zadati fajlovi su se izvršili i svi testovi prošli — neuspeh), **GREŠKA** (ulaz ne važi,
   vitest bez izveštaja, izlaz ≠ 0 bez palog testa, zadati fajl se nije izvršio). Na kraju zbirna tabela i ukupno
   trajanje; „stanje src isto kao pre pokretanja (heš …)".

### Pad procesa

Ako proces bude ubijen tako da ne stigne da vrati original (SIGKILL, OOM, nestanak struje), sledeće pokretanje odbija
rad („zaostala rezervna kopija"). Tada:

```sh
node scripts/sabotage.mjs --restore
```

vraća svaki fajl čiji je sadržaj i dalje sabotiran (fajl izmenjen posle sabotaže ne dira — kaže gde je original),
briše zaostale worktree-je i proverava heš stanja prema onom zapisanom na početku.

## `--parallel N`

Svaki od N „slotova" dobija privremeni worktree (`$TMPDIR/sabotage-wt-*`): `git worktree add --detach` od HEAD +
necommitovane izmene celog repozitorijuma (`git diff --binary HEAD` primenjen sa `git apply --index`) + neverzionisani
fajlovi (kopija) + `web/node_modules` kao simlinkovi STAVKI (bez `.vite`, `.tmp`, `.cache` — keševi ostaju lokalni).
Pre prve sabotaže alat proverava da worktree ima isti heš stanja kao glavni direktorijum. Slot redom uzima sabotaže,
svaku primeni / pokrene / vrati / proveri u svom worktree-ju. Worktree se uvek briše (i na signal; posle SIGKILL-a
`--restore`). Glavni direktorijum se ne dira; njegov heš se ipak proverava na kraju.

Podrazumevano je 1 (redom). Izmereno na 4 jezgra (gore): `--parallel 2` je ~40 % brži od rada redom, `--parallel 3` ne
donosi više. Svaki worktree ima prazan vite keš, pa je prvo pokretanje u njemu sporije.

## Merenje (serijski, 4 jezgra, ništa drugo ne radi; docs/testing/TEST-SPEED.md § 6)

| ulaz | način | rezultat | trajanje |
|---|---|---|---|
| `sabotage-06c.json` (a)–(e) | stari: ceo tenK/v2 skup, bez bail, b09ae49 | 14 / 2 / 27 / 1 / 1 palih (ista imena kao `docs/10k-v2/artifacts/segment-06c/sabotage.json`) | 297 / 209 / 190 / 209 / 210 s = **1114 s** |
| `sabotage-06c.json` (a)–(e) | alat, redom (brz nivo, `--bail=1`) | 5/5 PAO | 16,4 / 15,8 / 7,5 / 15,7 / 16,3 s = **72 s** |
| `sabotage-06c.json` (a)–(e) | alat, `--parallel 2` | 5/5 PAO | **43 s** |
| `sabotage-06c.json` (a)–(e) | alat, `--parallel 3` | 5/5 PAO | 46 s (bez dobitka prema 2) |
| `sabotage-proof.json` (a)–(e) | alat, redom | 6/6 PAO | 21 / 19 / 9 / 10 / 11 / 10 s = 81 s |

Preporuka: `--parallel 2` kad ima ≥ 3 sabotaže (izmeren dobitak ~40 %); za jednu ili dve — redom.

## Ograničenja

- „Prvi pali" je približan redosled: JSON izveštaj vitest-a nema početak svakog testa, pa se trenutak pada procenjuje kao
  početak fajla + trajanja testova pre njega. Uz `--bail=1` i više fajlova paralelno može pasti više od jednog testa
  pre zaustavljanja (broj palih tada > 1); ostali fajlovi se otkazuju.
- Sabotaža koja kvari sintaksu ili uvoz obara fajl pre testova („fajl pao van pojedinačnog testa") — to je slab
  dokaz; biraj izmenu ponašanja.
- Heš pokriva `src` i sabotirane fajlove. Testovi čitaju i `docs/` (fixture-i); alat ih ne dira, ali ih ni ne hešira.
- Vitest filter je podniz putanje: zadati fajl koji je podniz druge putanje pokrenuće i nju (alat to ne smatra greškom).
- `--parallel`: ignorisani fajlovi (npr. `.env.local`) i ugnežđeni repozitorijumi se ne prenose u worktree; u
  `web/src` danas nema ignorisanih fajlova.
- Trajanje je zid-sat vitest procesa (sa pokretanjem i fazom collect), ne zbir testova.
- Posle prekida (SIGINT/SIGTERM) vitest koji je ubijen usred rada može ostaviti svoje privremene direktorijume (vite
  SSR keš, nasumično ime) u `$TMPDIR`; alat briše samo svoje (`sabotage-out-*`, `sabotage-wt-*`).
