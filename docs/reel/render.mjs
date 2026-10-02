/* RENDER REELA: kadar po kadar kroz Chromium (window.render(t) je čista funkcija vremena), kadrovi idu pravo u ffmpeg.
   Pokretanje:
     node docs/reel/render.mjs --preview 1.2,4.6,9,14,19,23.5,27     → docs/reel/preview/*.png (provera rasporeda)
     node docs/reel/render.mjs --full                                → docs/reel/out/sub20-reel.mp4 (+ -bez-zvuka.mp4, cover.png, cover-4x5.png)
     node docs/reel/render.mjs --mux                                 → samo zvuk: nova muzika u postojeći video
     node docs/reel/render.mjs --cover                               → samo naslovnice
   Zvuk: docs/reel/out/muzika.wav (node docs/reel/audio.mjs); bez njega izlazi samo video bez zvuka. */
import { chromium } from '../../web/node_modules/@playwright/test/index.mjs';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const OUT = join(HERE, 'out');
const PREVIEW = join(HERE, 'preview');
const MIME = { '.html': 'text/html', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const server = createServer((req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')));
  if (!p.startsWith(ROOT) || !existsSync(p) || !statSync(p).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const args = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.SUB20_CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${port}/docs/reel/reel.html`);
await page.evaluate(() => window.boot());
const { DURATION, FPS } = await page.evaluate(() => ({ DURATION: window.DURATION, FPS: window.FPS }));
const frame = async (t, opts) => { await page.evaluate((x) => window.render(x), t); return page.screenshot(opts); };

try {
  if (args[0] === '--preview') {
    mkdirSync(PREVIEW, { recursive: true });
    if (args[1] === 'cover') {
      await page.evaluate(() => window.renderCover());
      await page.screenshot({ path: join(PREVIEW, 'cover.png'), type: 'png' });
      console.log('✓ cover');
    } else for (const t of (args[1] ?? '1,5,9,14,19,23,27').split(',').map(Number)) {
      await frame(t, { path: join(PREVIEW, `t${String(t).replace('.', '_')}.png`), type: 'png' });
      console.log('✓ preview', t);
    }
  } else if (args[0] === '--cover') {
    mkdirSync(OUT, { recursive: true });
    await page.evaluate(() => window.renderCover());
    await page.screenshot({ path: join(OUT, 'cover.png'), type: 'png' });
    await page.screenshot({ path: join(OUT, 'cover-4x5.png'), type: 'png', clip: { x: 0, y: 262, width: 1080, height: 1350 } });
    console.log('✓ naslovnica');
  } else if (args[0] === '--mux') {
    /* samo zvuk: video se ne renderuje ponovo, nova muzika se ugrađuje u postojeći video bez zvuka */
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(OUT, 'sub20-reel-bez-zvuka.mp4'), '-i', join(OUT, 'muzika.wav'), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', join(OUT, 'sub20-reel.mp4')], { stdio: 'inherit' });
      ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg ' + c))));
    });
    console.log('✓ sub20-reel.mp4 (nov zvuk)');
  } else if (args[0] === '--full') {
    mkdirSync(OUT, { recursive: true });
    const wav = join(OUT, 'muzika.wav');
    const withAudio = existsSync(wav);
    const run = (outFile, audio) => new Promise((resolve, reject) => {
      const a = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
      if (audio) a.push('-i', wav);
      a.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart');
      if (audio) a.push('-c:a', 'aac', '-b:a', '192k', '-shortest'); else a.push('-an');
      a.push(outFile);
      const ff = spawn('ffmpeg', a, { stdio: ['pipe', 'inherit', 'inherit'] });
      ff.on('error', reject);
      ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg ' + c))));
      (async () => {
        const n = Math.round(DURATION * FPS);
        for (let i = 0; i < n; i++) {
          const buf = await frame(i / FPS, { type: 'jpeg', quality: 95 });
          if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
          if (i % 120 === 0) console.log(`  kadar ${i}/${n}`);
        }
        ff.stdin.end();
      })().catch(reject);
    });
    if (withAudio) await run(join(OUT, 'sub20-reel.mp4'), true);
    else console.log('(nema muzika.wav — izlazi samo video bez zvuka)');
    await run(join(OUT, 'sub20-reel-bez-zvuka.mp4'), false);
    await page.evaluate(() => window.renderCover());
    await page.screenshot({ path: join(OUT, 'cover.png'), type: 'png' });
    await page.screenshot({ path: join(OUT, 'cover-4x5.png'), type: 'png', clip: { x: 0, y: 262, width: 1080, height: 1350 } });
    console.log('✓ gotovo');
  }
} finally {
  await browser.close();
  server.close();
}
