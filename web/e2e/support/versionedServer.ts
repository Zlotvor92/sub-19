import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';

/* PROXY ISPRED `vite preview` KOJI MOŽE DA „IZDA NOVU VERZIJU". Pregledač prepoznaje novi service worker ISKLJUČIVO po promeni bajtova `sw.js`, a `page.route` ne
   presreće proveru ažuriranja koju radi sam pregledač. Zato test pogađa `/__bump` i proxy od tog trenutka vraća `sw.js` sa drugačijim imenom keša — to je
   tačno ono što novi deploy radi (`CACHE` sadrži heš spiska fajlova). Sve ostalo prosleđuje netaknuto. */

export interface VersionedServer {
  url: string;
  /** Šta se servira: novi izgrađeni frontend (`vite preview`) ili STARI frontend iz korena repozitorija (prelaz sa v282 na novi je upravo taj preklop). */
  mode: 'new' | 'legacy';
  /** Od sada `sw.js` ima nova bajta (kao posle novog deploya); vraća ime novog keša. */
  bump(): string;
  close(): Promise<void>;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp'
};
/** Samo ono što stari frontend zaista servira (nema `web/`, `test/`, `docs/`…). */
const LEGACY_FILES =
  /^\/(index\.html|app\.js|sw\.js|sw-reg\.js|manifest\.json|[\w.-]+\.(png|webp))$/;

export async function startVersionedServer(
  target = 'http://localhost:4173',
  legacyRoot = join(process.cwd(), '..')
): Promise<VersionedServer> {
  let suffix = '';
  let mode: 'new' | 'legacy' = 'new';
  const server: Server = createServer((req, res) => {
    void (async () => {
      const path = req.url ?? '/';
      try {
        if (mode === 'legacy') {
          const file = path.split('?')[0] === '/' ? '/index.html' : (path.split('?')[0] ?? '');
          if (!LEGACY_FILES.test(file)) {
            res.writeHead(404);
            res.end('nema');
            return;
          }
          const body = await readFile(normalize(join(legacyRoot, file)));
          res.writeHead(200, {
            'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
            'cache-control': 'no-cache'
          });
          res.end(body);
          return;
        }
        const up = await fetch(target + path, { method: req.method, redirect: 'manual' });
        let body = Buffer.from(await up.arrayBuffer());
        if (path.split('?')[0] === '/sw.js' && suffix)
          body = Buffer.from(
            body.toString('utf8').replace(/const CACHE = '([^']+)'/, `const CACHE = '$1-${suffix}'`)
          );
        const headers: Record<string, string> = {};
        up.headers.forEach((v, k) => {
          if (
            !['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(k)
          )
            headers[k] = v;
        });
        /* `sw.js` se ne sme keširati u HTTP kešu, inače pregledač ne vidi promenu. */
        if (path.split('?')[0] === '/sw.js') headers['cache-control'] = 'no-cache';
        res.writeHead(up.status, headers);
        res.end(body);
      } catch (e) {
        res.writeHead(502);
        res.end(String(e));
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://localhost:${port}`,
    get mode() {
      return mode;
    },
    set mode(m) {
      mode = m;
    },
    bump() {
      suffix = `e2e${Date.now().toString(36)}`;
      return suffix;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}
