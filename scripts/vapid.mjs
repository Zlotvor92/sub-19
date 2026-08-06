/* Pravi VAPID par ključeva za Web Push obaveštenja.

   Pokretanje:   node scripts/vapid.mjs

   Ispisuje tri reda koja se lepe u Vercel → Settings → Environment Variables
   (za sva tri okruženja: Production, Preview, Development).

   VAPID_PUBLIC_KEY   javni je po dizajnu — pregledač ga šalje push servisu
                      pri pretplati. Aplikacija ga čita sa /api/push.
   VAPID_PRIVATE_KEY  TAJNA. Ko ga ima može da šalje obaveštenja korisnicima
                      ove aplikacije. Ne ide u git, ne ide u aplikaciju.
   VAPID_SUBJECT      kontakt (mailto: ili https:) — push servisi ga traže da
                      bi imali kome da se jave ako nešto ne valja.

   AKO ZAMENIŠ KLJUČEVE: sve postojeće pretplate prestaju da rade (potpis se
   više ne poklapa) i svaki uređaj mora ponovo da uključi obaveštenja. Zato
   se menjaju samo ako je privatni ključ procureo. */

import { generateKeyPairSync } from 'node:crypto';

const b64u = b => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });

/* Nekompresovana tačka: 0x04 ‖ X (32) ‖ Y (32) = 65 bajtova. Baš taj oblik
   očekuje `applicationServerKey` u pregledaču i `k=` u VAPID zaglavlju. */
const javni = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, 'base64url'),
  Buffer.from(jwk.y, 'base64url')
]);
const privatni = Buffer.from(jwk.d, 'base64url');

if (javni.length !== 65 || privatni.length !== 32) {
  console.error('Neočekivane dužine ključeva — prekid.');
  process.exit(1);
}

console.log('VAPID_PUBLIC_KEY=' + b64u(javni));
console.log('VAPID_PRIVATE_KEY=' + b64u(privatni));
console.log('VAPID_SUBJECT=mailto:tvoja@adresa');
