// Uslov 7: svi uvozi v2 fajlova (i testova) koji izlaze iz v2/ — sopstveni parser (TypeScript AST), ne regex testa izolacije.
// Pokretanje iz web/: node ../docs/generators-v2/audit/owner/imports.mjs
import { createRequire } from 'node:module';
const ts = createRequire(resolve('package.json'))('typescript');
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
const ROOT = resolve('src/domain/generators');
const walk = (d, o = []) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p, o) : /\.(m?[jt]sx?)$/.test(n) && o.push(p); } return o; };
for (const dist of ['fiveK', 'tenK', 'halfMarathon', 'marathon']) {
  const V2 = join(ROOT, dist, 'v2');
  const res = { prod: [], test: [] };
  for (const f of walk(V2)) {
    const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (n) => {
      let spec = null, typeOnly = false;
      if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) {
        spec = n.moduleSpecifier.text;
        if (ts.isImportDeclaration(n)) { const c = n.importClause; typeOnly = !!c && (c.isTypeOnly || (!c.name && c.namedBindings && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly))); }
        else typeOnly = n.isTypeOnly;
      } else if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require')) && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) spec = n.arguments[0].text + ' (dinamički)';
      else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) { spec = n.argument.literal.text; typeOnly = true; }
      if (spec) {
        const s = spec.replace(' (dinamički)', '');
        const t = s.startsWith('.') ? resolve(dirname(f), s) : null;
        const inside = t && (t === V2 || t.startsWith(V2 + '/'));
        if (!inside) res[/\.test\.tsx?$/.test(f) ? 'test' : 'prod'].push(`${relative(V2, f)} → ${spec}${typeOnly ? ' [type]' : ''}`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  console.log(`== ${dist}: produkcioni fajlovi van v2/: ${res.prod.length}`); res.prod.forEach((x) => console.log('  ' + x));
  const tv = res.test.filter((x) => !/→ (vitest|node:)/.test(x));
  console.log(`   testovi van v2/ (bez vitest/node:): ${tv.length}`); tv.forEach((x) => console.log('  ' + x));
}
