import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/* A5: ugovor generatora ne zavisi ni od jednog generatora.
   1. `select.ts` iz foldera distance uvozi SAMO generator objekte za izbor: `import * as <x> from './<distanca>'`
      (izvršni uvoz indeksa), nijedan tip, nijedan dublji modul, i ne čita tip kroz taj imenski prostor
      (`typeof halfMarathon.X`, `halfMarathon.Tip`).
   2. `contract.ts` (neutralni tipovi razmene) ne uvozi ništa iz foldera distance. */

const DISTANCES = ['fiveK', 'tenK', 'halfMarathon', 'marathon'] as const;
const read = (name: string) => {
  const path = fileURLToPath(new URL(`./${name}`, import.meta.url));
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
};
const distanceOf = (spec: string): string | null => {
  const m = /^\.\/([^/]+)/.exec(spec);
  return m && (DISTANCES as readonly string[]).includes(m[1] as string) ? (m[1] as string) : null;
};

function violations(sf: ts.SourceFile, allowGeneratorObjects: boolean): string[] {
  const out: string[] = [];
  const namespaces = new Set<string>();
  for (const st of sf.statements) {
    const spec =
      (ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) &&
      st.moduleSpecifier &&
      ts.isStringLiteral(st.moduleSpecifier)
        ? st.moduleSpecifier.text
        : null;
    if (!spec || !distanceOf(spec)) continue;
    const clause = ts.isImportDeclaration(st) ? st.importClause : undefined;
    const bindings = clause?.namedBindings;
    const ok =
      allowGeneratorObjects &&
      ts.isImportDeclaration(st) &&
      spec === `./${distanceOf(spec)}` &&
      clause &&
      !clause.isTypeOnly &&
      !clause.name &&
      bindings &&
      ts.isNamespaceImport(bindings);
    if (ok) namespaces.add(bindings.name.text);
    else out.push(`uvoz iz ${spec}: ${st.getText(sf).replace(/\s+/g, ' ').slice(0, 120)}`);
  }
  const visit = (n: ts.Node): void => {
    const left = ts.isTypeReferenceNode(n)
      ? n.typeName
      : ts.isTypeQueryNode(n)
        ? n.exprName
        : ts.isImportTypeNode(n)
          ? null
          : undefined;
    if (ts.isImportTypeNode(n)) out.push(`import() tip: ${n.getText(sf)}`);
    if (left && ts.isQualifiedName(left)) {
      let root: ts.EntityName = left;
      while (ts.isQualifiedName(root)) root = root.left;
      if (namespaces.has(root.text)) out.push(`tip kroz generator: ${n.getText(sf)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe('ugovor generatora je neutralan (A5)', () => {
  it('select.ts iz foldera distance uvozi samo generator objekte', () => {
    expect(violations(read('select.ts'), true)).toEqual([]);
  });

  it('contract.ts ne uvozi ništa iz foldera distance', () => {
    expect(violations(read('contract.ts'), false)).toEqual([]);
  });

  it('provera obara tip iz generatora (kontrola samog testa)', () => {
    const bad = ts.createSourceFile(
      'bad.ts',
      [
        "import type * as Hm from './halfMarathon';",
        "import type { ExecutionAnalysis } from './halfMarathon/training/execution';",
        "import * as tenK from './tenK';",
        'type P = typeof tenK.TEN_K_PRODUCT;'
      ].join('\n'),
      ts.ScriptTarget.Latest,
      true
    );
    expect(violations(bad, true)).toHaveLength(3);
  });
});
