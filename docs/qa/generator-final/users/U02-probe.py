"""Independent U02 arithmetic/provenance/preservation audit; no source mutations."""
import hashlib
import json
import math
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).parent
read = lambda p: json.loads((ROOT / p).read_text())
original_path = ROOT / 'docs/qa/generator-ab/users/U02-event.json'
original = json.loads(original_path.read_text())
raw = read('docs/qa/generator-final/raw/U02.json')
replay = read('docs/qa/generator-final/users/U02-event.json')
round1 = lambda x: math.floor(x * 10 + 0.5) / 10

def qkm(s):
    if s['type'] == 'int': return round1(s['reps'] * s['repM'] / 1000)
    if s['type'] == 'pyramid': return round1(sum(s['reps']) / 1000)
    if s['type'] == 'fartlek': return round1(s['reps'] * s['repSec'] / s['paceSec'])
    if s['type'] == 'prog': return round1(s['qKm'] / 3)
    return s['qKm']

def km(s):
    total = s['wuKm'] + s['cdKm']
    if s['type'] == 'int':
        n = max(0, s['reps'] - 1)
        recovery = n * s['restSec'] / (s['paceSec'] * 1.35) if s['kind'] in ['Tempo isprekidan', 'Tempo trke', 'Kontrolna trka'] else n * .15
        total += s['reps'] * s['repM'] / 1000 + recovery
    elif s['type'] == 'pyramid': total += sum(s['reps']) / 1000 + max(0, len(s['reps']) - 1) * .15
    elif s['type'] == 'fartlek': total += s['reps'] * (s['repSec'] / s['paceSec'] + s['restSec'] / s['easyPaceSec'])
    else: total += s['qKm']
    return round1(total)

def spec(s):
    if s['type'] == 'int': return [s['repM']]
    if s['type'] == 'pyramid': return s['reps']
    if s['type'] == 'tempo': return [math.floor(s['qKm'] * 1000 + .5)]
    return None

def effective_date(w, d, context):
    return context.get('moves', {}).get(d['id'], (date.fromisoformat(w['start']) + timedelta(days=d['dow'])).isoformat())

def row_for(w, d, plan):
    if not d.get('session'): return None
    rows = [r for r in plan['pred'] if r['w'] == w['w'] and r['l'] == f"N{w['w']} · {d['session']['kind']}"]
    assert len(rows) == 1, (d, rows)
    return rows[0]

def audit_plan(plan, stored=False):
    failures = []
    days = [d for w in plan['weeks'] for d in w['days']]
    if stored:
        assert len({d['id'] for d in days}) == len(days)
        assert len({r['id'] for r in plan['pred']}) == len(plan['pred'])
    for w in plan['weeks']:
        for d in w['days']:
            s = d.get('session')
            if not s: continue
            if abs(km(s) - d['km']) > .051: failures.append({'w': w['w'], 'dow': d['dow'], 'kind': 'arithmetic'})
            key = d['id'] if stored else f"n{w['w']}d{d['dow']}"
            if plan['qs'].get(key) != spec(s): failures.append({'day': key, 'kind': 'QS'})
            r = row_for(w, d, plan)
            if (r['q'], r['pt'], r.get('zone')) != (qkm(s), s['paceSec'], s.get('zone')):
                failures.append({'day': key, 'kind': 'PRED'})
    return {'daysReviewed': len(days), 'sessionsReviewed': sum(bool(d.get('session')) for d in days), 'failures': failures,
            'projectedReferences': sorted({r['p5k'] for r in plan['pred']})}

output = {'id': 'U02', 'scope': 'Independent full-day arithmetic, provenance, effective-date, protected body/QS/PRED and literal-input audit. Coaching judgement is in U02.md.',
          'originalSha256': hashlib.sha256(original_path.read_bytes()).hexdigest(), 'raw': {}, 'cases': {}}
assert output['originalSha256'] == replay['sourceEvidenceSha256']
for version in ['old', 'new']:
    output['raw'][version] = audit_plan(raw['versions'][version]['plan'])
    assert not output['raw'][version]['failures']
    for w, summary in zip(raw['versions'][version]['plan']['weeks'], raw['versions'][version]['summary']['weeks']):
        assert abs(sum(d.get('km') or 0 for d in w['days']) - summary['km']) < .001

for case, record in replay['cases'].items():
    source = original if case == 'primary' else original['protection']
    frozen = source['input']
    expected = {'current': frozen.get('current', frozen.get('plan')), 'context': frozen.get('context', {'log': frozen.get('log', {})}),
                'options': frozen.get('options', {}), 'analysis': source.get('analysis', frozen.get('analysis')), 'today': source.get('today', frozen.get('today', replay['profile']['eventToday']))}
    assert expected == record['input']
    current, context, today = expected['current'], expected['context'], expected['today']
    prior_days = {d['id']: (w, d) for w in current['weeks'] for d in w['days']}
    protected = []
    for id_, (w, d) in prior_days.items():
        row = row_for(w, d, current)
        alt = context.get('alts', {}).get(id_)
        manual_alt = alt and (not alt.get('paceAuto') or alt.get('tag') != ('odmor' if d.get('rest') else d.get('tag')) or alt.get('km') != d.get('km') or alt.get('desc') != d.get('desc') or alt.get('rw') is not None or alt.get('snaga'))
        if effective_date(w, d, context) <= today or context.get('log', {}).get(id_, {}).get('status') == 'done' or (row and (context.get('pred', {}).get(row['id']) is not None or context.get('predLock', {}).get(row['id']))) or any(d.get('session', {}).get('overrides', {}).values()) or manual_alt:
            protected.append(id_)
    item = {'literalFrozenInputMatches': True, 'protectedCount': len(protected), 'versions': {}}
    for version, result in record['versions'].items():
        plan = result['adjustment']['result']
        audit = audit_plan(plan, True)
        new_days = {d['id']: (w, d) for w in plan['weeks'] for d in w['days']}
        dates_changed, bodies_changed, qs_changed, rows_changed = [], [], [], []
        for id_, (w, d) in prior_days.items():
            nw, nd = new_days[id_]
            if effective_date(w, d, context) != effective_date(nw, nd, context): dates_changed.append(id_)
            if id_ not in protected: continue
            if d != nd: bodies_changed.append(id_)
            if current['qs'].get(id_) != plan['qs'].get(id_): qs_changed.append(id_)
            row = row_for(w, d, current)
            if row and row != next((r for r in plan['pred'] if r['id'] == row['id']), None): rows_changed.append(row['id'])
        audit.update({'dateChanges': dates_changed, 'protectedBodyChanges': bodies_changed, 'protectedQsChanges': qs_changed, 'protectedRowChanges': rows_changed,
                      'inputPure': result['inputPure'], 'recomputedAnalysisMatches': result['analysisMatchesFrozen'],
                      'actualLogsMatchOriginal': context['log'] == expected['context']['log'],
                      'missingActivationNemeri': [r['id'] for r in plan['pred'] if 'Aktivacija' in r['l'] and not r.get('nemeri')]})
        assert not (audit['failures'] or dates_changed or bodies_changed or qs_changed or rows_changed)
        assert audit['projectedReferences'] == [1425]
        item['versions'][version] = audit
    output['cases'][case] = item

output['findings'] = [{'severity': 'low', 'scope': 'event primary and supplemental', 'issue': 'Rebuilt Aktivacija PRED loses nemeri:true compared with raw new generated row. RP zone remains and prevents use as measured fitness evidence.'},
                      {'severity': 'evidence-limit', 'scope': 'supplemental protection only', 'issue': 'Frozen protection analysis is the primary analysis; moves and added future-completed log intentionally change recomputed coverage/actual volume. This is a preservation injection, not a new realistic execution scenario.'}]
(OUT / 'U02-findings.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(output, ensure_ascii=False, indent=2))
