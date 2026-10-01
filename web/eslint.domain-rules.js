/* IZOLACIJA DOMENA — pravila su ovde (a ne u eslint.config.js) da ih može da
   uveze i test `src/domain/isolation.test.ts`, koji dokazuje da prekršaj
   stvarno pada. Pravila bez testa su samo želja. */
const domainGlobals = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'fetch',
  'navigator',
  'location',
  'history',
  'indexedDB',
  'XMLHttpRequest',
  'WebSocket',
  'self',
  'globalThis',
  'process',
  'requestAnimationFrame',
  'setTimeout',
  'setInterval'
].map((name) => ({
  name,
  message: `Domen ne sme da koristi "${name}" — v. docs/REWRITE_PLAN.md §3.`
}));

const domainRestrictedImports = {
  patterns: [
    { group: ['react', 'react-dom', 'react/*', 'react-dom/*'], message: 'Domen ne zna za React.' },
    { group: ['zustand', 'zustand/*'], message: 'Domen ne zna za Zustand.' },
    { group: ['@supabase/*'], message: 'Domen ne zna za Supabase.' },
    {
      group: ['@/services/*', '@/stores/*', '@/features/*', '@/components/*', '@/lib/*'],
      message: 'Domen zavisi samo od domena.'
    },
    {
      group: ['../services/*', '../stores/*', '../features/*', '../components/*'],
      message: 'Domen zavisi samo od domena.'
    },
    { group: ['node:*'], message: 'Domen ne sme da zavisi od Node-a.' }
  ]
};

const domainRestrictedSyntax = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'new Date() bez argumenta čita sat. Sat se prosleđuje kao argument (today: string).'
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Date.now() čita sat. Sat se prosleđuje kao argument.'
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: 'Math.random() je nedeterminizam; generator mora biti deterministički.'
  },
  {
    selector:
      "CallExpression[callee.name='parseFloat'], CallExpression[callee.object.name='Date'][callee.property.name='parse']",
    message: 'Date.parse/parseFloat su zavisni od okruženja/TZ-a; koristi domain/date.'
  }
];

export const domainRules = {
  'no-restricted-globals': ['error', ...domainGlobals],
  'no-restricted-imports': ['error', domainRestrictedImports],
  'no-restricted-syntax': ['error', ...domainRestrictedSyntax],
  'no-console': 'error'
};
