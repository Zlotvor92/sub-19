import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { domainRules } from './eslint.domain-rules.js';

/* ============================================================
   IZOLACIJA DOMENA (zahtev §7 zadatka)
   `src/domain/**` je čist TypeScript: nema DOM-a, nema `localStorage`,
   `fetch`, `window`, `document`, nema Reacta, Zustanda, Supabase-a, i nema
   nedeterminizma (`Date.now()`, `new Date()` bez argumenta, `Math.random()`).
   Sat se UBRIZGAVA kao argument.
   Ovo je drugi sloj: prvi je `tsconfig.domain.json` (lib bez DOM-a, `types: []`),
   pa ta imena ni ne postoje. Test `src/domain/isolation.test.ts` drži da oba
   sloja stvarno hvataju prekršaj.
   ============================================================ */
export default tseslint.config(
  {
    /* `public/` i `sw/` su običan JavaScript bez modula koji se izvršava u pregledaču/service workeru (ponašanje starog koda, dokazano testovima
       `src/pwa/sw.*.test.ts`); `scripts/*.mjs` ima `.d.mts` opis. Ništa od toga nije deo TS projekta. */
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'node_modules',
      'public',
      'sw',
      'scripts/*.mjs',
      'src/test/fixtures/legacy-generator.mjs'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }]
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      /* XSS: React ne treba `dangerouslySetInnerHTML`. Stari kod je imao dva sloja
         odbrane (validacija + esc); u Reactu je drugi sloj ugrađen, ali samo ako
         se ovo ne zaobiđe. Izuzetak traži komentar i izričito odobrenje. */
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML je zabranjen (XSS). Renderuj tekst kao tekst.'
        }
      ]
    }
  },
  {
    files: ['src/domain/**/*.ts'],
    ignores: ['src/domain/**/*.test.ts'],
    languageOptions: { globals: {} },
    rules: domainRules
  },
  /* Konfiguracioni JS fajlovi nisu deo TS projekta — bez tipiziranih pravila. */
  {
    files: ['**/*.js', '**/*.d.ts'],
    ...tseslint.configs.disableTypeChecked
  },
  {
    files: ['**/*.config.{ts,js}', 'e2e/**/*.ts', 'scripts/**'],
    languageOptions: { globals: { ...globals.node } }
  }
);
