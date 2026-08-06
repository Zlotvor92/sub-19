# `.well-known/assetlinks.json` — veza između sajta i Android aplikacije

Ovaj fajl je JEDINI razlog zbog kog Android aplikacija (TWA) prikazuje SUB-20
preko celog ekrana, bez Chrome trake sa adresom. Bez njega aplikacija radi, ali
na vrhu stoji „sub-19.vercel.app" — što izgleda kao pregledač, a ne kao
aplikacija.

## Stanje

Otisak je **upisan** (paket `rs.sub20.app`, ključ napravljen kroz PWABuilder,
avgust 2026). Ništa ne treba dirati dok se ne promeni ključ ili naziv paketa.

Oblik fajla čuva test — v. „otisak kljuca je STVARAN otisak" u
`test/doslednost.test.mjs`.

## Ako ikad praviš NOV paket

1. Alat za pakovanje izda **SHA-256 otisak** ključa kojim je paket potpisan —
   32 para heksadecimalnih cifara sa dvotačkama, `A1:B2:C3:…:9F`. Kod
   PWABuilder-a se nalazi u `assetlinks.json` unutar preuzetog zip fajla
   (ne u `signing-key-info.txt` — tamo su samo alias i lozinke).
2. Upiši ga u `sha256_cert_fingerprints`. Sme ih biti VIŠE u nizu — tako rade
   i verzija koju sam instaliraš i ona iz prodavnice.
3. Ako si promenio naziv paketa, promeni i `package_name` ovde — mora biti
   ISTI, karakter za karakter.
4. Commit + push. Vercel deploy je gotov za desetak sekundi.
5. Proveri da fajl zaista stoji na mreži:
   `https://sub-19.vercel.app/.well-known/assetlinks.json`
   Mora vratiti ovaj JSON, a ne 404.

**Redosled je bitan:** fajl mora biti ispravan NA MREŽI pre nego što se
aplikacija instalira. Android proveru zapamti pri instalaciji; kasnija
ispravka ne pomaže dok se aplikacija ne deinstalira pa instalira ponovo.

## Zašto otisak, a ne lozinka

Google sa Android uređaja pročita ovaj fajl i uporedi otisak sa potpisom
instalirane aplikacije. Ako se poklope, sistem zna da isti vlasnik stoji iza
sajta i iza aplikacije, pa sme da sakrije adresnu traku. Otisak nije tajna —
javan je po dizajnu. Tajna je ključ (`.keystore` / `.jks`) kojim se potpisuje, i
on NIKAD ne ide u repozitorijum.

## Ako koristiš Play Store

Google Play od 2021. potpisuje aplikacije SVOJIM ključem (Play App Signing).
Tada ovde ide otisak koji piše u Play Console → **Test and release → Setup →
App signing → App signing key certificate → SHA-256**, a ne onaj iz tvog
lokalnog ključa. Možeš navesti i oba otiska u nizu — dozvoljeno je više njih, pa
i verzija koju sam instaliraš i ona iz prodavnice rade bez trake sa adresom.
