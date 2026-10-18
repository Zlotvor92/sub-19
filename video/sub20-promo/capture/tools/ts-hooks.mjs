/* Resolver za uvoz TS izvora aplikacije bez build-a: dopunjava ekstenziju (.ts / /index.ts). Samo za alate videa. */
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL?.endsWith('.ts')) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    for (const c of [base, base + '.ts', base + '/index.ts']) {
      if (existsSync(c) && statSync(c).isFile()) return next(pathToFileURL(c).href, context);
    }
  }
  return next(specifier, context);
}
