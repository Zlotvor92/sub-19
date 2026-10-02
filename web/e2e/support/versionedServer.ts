import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/* PROXY ISPRED `vite preview` KOJI MOŽE DA „IZDA NOVU VERZIJU". Pregledač prepoznaje novi service worker ISKLJUČIVO po promeni bajtova `sw.js`, a `page.route` ne
   presreće proveru ažuriranja koju radi sam pregledač. Zato test pogađa `/__bump` i proxy od tog trenutka vraća `sw.js` sa drugačijim imenom keša — to je
   tačno ono što novi deploy radi (`CACHE` sadrži heš spiska fajlova). Sve ostalo prosleđuje netaknuto. */

export interface VersionedServer {
  url: string;
  /** Od sada `sw.js` ima nova bajta (kao posle novog deploya); vraća ime novog keša. */
  bump(): string;
  close(): Promise<void>;
}

export async function startVersionedServer(
  target = 'http://localhost:4173'
): Promise<VersionedServer> {
  let suffix = '';
  const server: Server = createServer((req, res) => {
    void (async () => {
      const path = req.url ?? '/';
      try {
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
    bump() {
      suffix = `e2e${Date.now().toString(36)}`;
      return suffix;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}
