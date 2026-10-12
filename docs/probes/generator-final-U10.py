"""Independent U10 frozen snapshot checks; reads originals, writes own findings only."""
import json, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
qa=root/'docs/qa/generator-final'
raw=json.loads((qa/'raw/U10.json').read_text())
event=json.loads((qa/'users/U10-event.json').read_text())
source=root/'docs/qa/generator-ab/users/U10-event.json'
assert hashlib.sha256(source.read_bytes()).hexdigest()==event['sourceEvidenceSha256']
findings={'initial':{},'cases':{}}
for v,x in raw['versions'].items():
 weeks=x['plan']['weeks']; assert len(weeks)==20
 assert all(len(w['days'])==7 for w in weeks)
 for w in weeks:
  assert abs(sum(d.get('km') or 0 for d in w['days'])-w['vol'])<.051
 findings['initial'][v]={'weeks':len(weeks),'days':sum(len(w['days'])for w in weeks),'storedFailures':x['summary']['failures']}
for name,c in event['cases'].items():
 context=c['input']['context']; done=[l for l in context['log'].values()if l['status']=='done']
 assert len(done)==13 and all('km'in l and 'sec'in l and 'runDate'in l and 'ts'in l for l in done)
 inp={d['id']:d for w in c['input']['current']['weeks']for d in w['days']}
 audits={}
 for v,x in c['versions'].items():
  a=x['audit']; out=x['adjustment']['result']; days={d['id']:d for w in out['weeks']for d in w['days']}
  assert len(a['weeks'])==20 and len(days)==140 and days.keys()==inp.keys()
  for id in a['protectedIds']:
   assert days[id]==inp[id]
   assert out.get('qs',{}).get(id)==c['input']['current'].get('qs',{}).get(id)
  for row in c['input']['current']['pred']:
   if row['id']in context['pred'] or context['predLock'].get(row['id']):
    assert row==next(r for r in out['pred']if r['id']==row['id'])
  for w in a['weeks']:assert abs(sum(d.get('km')or 0 for d in w['days'])-w['km'])<.0011
  returndays=[d for w in a['weeks']for d in w['days']if '2026-11-26'<=d['date']<'2026-12-21']
  work=[d['id']for d in returndays if d.get('session')or d.get('strides')or d.get('finish')]
  if v=='new':
   assert work==([]if name=='primary'else['g8d2','g9d5'])
   assert a['athlete']['consistentWeeks']==32 and a['athlete']['currentReadiness']=='returning'
   assert a['finalization']['initialEasyWeeks']==(4 if name=='primary'else 1)
   assert not any(a[k]for k in ['changedDates','staleDescriptions','staleFocus','arithmeticFailures','descriptionFailures','predictionFailures'])
  audits[v]={'weeks':20,'days':140,'returnWindowDays':len(returndays),'returnWindowQualityIds':work,'protectedDays':len(a['protectedIds']),'initialEasyWeeks':a.get('finalization',{}).get('initialEasyWeeks')}
 findings['cases'][name]={'doneEntriesWithKmAndSec':13,'skipEntries':len(context['log'])-13,'actualKm':round(sum(d['km']for d in done),3),'actualSec':sum(d['sec']for d in done),'manualAlternatives':len(context['alts']),'moves':len(context['moves']),'measuredPredValues':context['pred'],'predLocks':context['predLock'],'versions':audits}
(qa/'users/U10-findings.json').write_text(json.dumps(findings,indent=2)+'\n')
print(json.dumps(findings))
