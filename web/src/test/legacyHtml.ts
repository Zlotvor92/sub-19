/* Pomoć za oracle testove: stari kod vraća HTML, novi model; poredi se STRUKTURA (delovi reda sa bojom), ne bajtovi. */
import type { CardRow, RichPart } from '@/domain/day';

export const unesc = (t: string): string =>
  t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const TONES: Record<string, string> = {
  'var(--green)': 'green',
  'var(--amber)': 'amber',
  'var(--red)': 'red',
  'var(--txt2)': 'neutral',
  'var(--pink)': 'pink',
  'var(--txt3)': 'muted'
};

/** `<b style="color:var(--red)">x</b> spm <small>y</small>` → delovi; susedni goli tekstovi se spajaju. */
export function parseValue(html: string): RichPart[] {
  const out: RichPart[] = [];
  const push = (p: RichPart): void => {
    const last = out[out.length - 1];
    if (p.tag === 'text' && last?.tag === 'text') last.text += p.text;
    else out.push(p);
  };
  let rest = html;
  const sec = /^<span class="sec">(.*?)<\/span>/;
  const re = /^<(b|small)(?: style="color:([^"]+)")?>(.*?)<\/\1>/;
  while (rest) {
    const s = sec.exec(rest);
    if (s) {
      const inner = s[1] as string;
      const lead = inner.indexOf('<');
      push({
        tag: 'sec',
        text: unesc(inner.slice(0, lead)),
        children: parseValue(inner.slice(lead))
      });
      rest = rest.slice(s[0].length);
      continue;
    }
    const m = re.exec(rest);
    if (m) {
      const tone = m[2] ? TONES[m[2]] : undefined;
      push({
        tag: m[1] as 'b' | 'small',
        text: unesc(m[3] as string),
        ...(tone ? { tone: tone as never } : {})
      });
      rest = rest.slice(m[0].length);
    } else {
      const next = rest.indexOf('<');
      const chunk = next === -1 ? rest : rest.slice(0, next === 0 ? 1 : next);
      push({ tag: 'text', text: unesc(chunk) });
      rest = rest.slice(chunk.length);
    }
  }
  return out;
}

export const normalize = (rows: CardRow[]): CardRow[] =>
  rows.map((r) => ({
    label: r.label,
    parts: r.parts.reduce<RichPart[]>((acc, p) => {
      const last = acc[acc.length - 1];
      if (p.tag === 'text' && last?.tag === 'text') last.text += p.text;
      else acc.push({ ...p });
      return acc;
    }, [])
  }));
