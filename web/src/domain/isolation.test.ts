import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { domainRules } from '../../eslint.domain-rules.js';

/* Dokaz da je izolacija domena STVARNA, ne samo napisana: svaki zabranjeni
   obrazac mora da padne, a čist domenski kod mora da prođe. */
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tseslint.parser },
      rules: domainRules
    }
  ]
});

async function violations(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: 'src/domain/probe.ts' });
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'parse'}: ${m.message}`);
}

describe('izolacija domena (ESLint sloj)', () => {
  it.each([
    ['window', 'export const a = window.innerWidth;'],
    ['document', 'export const a = document.title;'],
    ['localStorage', "export const a = localStorage.getItem('x');"],
    ['sessionStorage', "export const a = sessionStorage.getItem('x');"],
    ['fetch', "export const a = fetch('/api/x');"],
    ['navigator', 'export const a = navigator.userAgent;'],
    ['setTimeout', 'export const a = setTimeout(() => 1, 5);'],
    ['console', "console.log('x'); export const a = 1;"],
    ['react', "import { useState } from 'react'; export const a = useState;"],
    ['zustand', "import { create } from 'zustand'; export const a = create;"],
    ['servisi', "import { x } from '@/services/api/http'; export const a = x;"],
    ['store', "import { x } from '@/stores/useAuthStore'; export const a = x;"],
    ['node', "import { readFileSync } from 'node:fs'; export const a = readFileSync;"],
    ['Date.now()', 'export const a = Date.now();'],
    ['new Date()', 'export const a = new Date();'],
    ['Math.random()', 'export const a = Math.random();'],
    ['Date.parse', "export const a = Date.parse('2026-01-01');"]
  ])('hvata %s', async (_ime, code) => {
    expect((await violations(code)).length).toBeGreaterThan(0);
  });

  it('propušta čist domenski kod (sat kao argument, Date sa argumentom)', async () => {
    const code = `
      export function weekday(today: string): number {
        return new Date(Date.UTC(2026, 0, 5)).getUTCDay() + today.length;
      }
    `;
    expect(await violations(code)).toEqual([]);
  });
});
