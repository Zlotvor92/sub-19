# Maraton v2 — MAR-10 (kratko, samo 3 stavke). Folder web/src/domain/generators/marathon/v2/

Korisnik: „što kraće i efikasnije". Pravila iz `00-common.md` važe (samo svoj folder, test pre/posle, bez check:full).
Isti obrazac su već uradili 5K-09 (5k-v2.11.1), 10K-07 (10k-v2.9.0) i HM-09 (hm-v2.7.1, commit 1a838c9 i a3931a0) —
prepiši pristup, ne izmišljaj nov.

1. Z7 (B): manjak izvršenja nije idempotentan — `assess.ts:~475` `tn` = cilj TEKUĆEG (već smanjenog) plana. Vezati za
   zapise kao umor (pouka 36): korak koji već pokriva isti prozor zapisa ne pravi nov (HM `step.underFrom`).
   Cilj: `docs/generators-v2/audit/chains/idemp.ts MAR 20261023 0 2000` → same UNDER_EXECUTION 393/408 → 0.
2. Z6 (B): provera LIMITS (`validate.ts:~1830`) preskače samo dane zaključane u tekućem koraku. Jedna funkcija
   „zaštićen dan" (≤ asOf, zaključan u bilo kom koraku, urađen) u LIMITS (HM „guarded", 5K `protectedDay`).
   Cilj: `chains.ts MAR 20261023 0 2000` odbijeni realni lanci 121 → ~0.
3. Z4 (srednje): vraćanje verzije = spoj (restoreMerge) → validatePlan jezgra (+ sledeća adaptacija bez činjenica, kao
   HM a3931a0); prolazi → primeni, ne prolazi → odbij sa porukom. Ukloni uslov „samo bez prilagođavanja posle".
   Neposredno poništavanje poslednje adaptacije MORA da prođe (test). Merenje: tvoj `mar-restore` (artifacts/segment-09):
   vraćeni koji krše validator 0, sledeća odbijena 0, neposredno poništavanje 100 %.

Verzija marathon-v2.6.1 (KNOWN_VERSIONS ∪ 2.6.0). Testovi: `npm run check`; `npx vitest run --changed 9a2c619`;
`TEST_FULL=1 npx vitest run --project node src/domain/generators/marathon`; E2E `e2e/marathon-v2.spec.ts` (+
`features/plan/marathonV2Adapt.test.tsx` prema stavci 3); sabotaža po stavci (3 ukupno). run-all samo podskup:
`bash docs/generators-v2/final-check/run-all.sh /tmp/ra 4 '(early|two-step|locked-pause|locked-test|locked-result|result-pain)-MAR'`.
byteSame u drugim folderima: samo „MAR v2" redovi ako se menjaju. Push, izveštaj (dopuna docs/marathon-v2/reports/
SEGMENT-09-IMPLEMENTATION.md, § MAR-10), send_message organizatoru: SHA, pre → posle za 3 stavke, testovi. Ništa preko spiska.
