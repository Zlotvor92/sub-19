import json
import re
from pathlib import Path
base=Path('docs/qa/generator-ab/users')
e=json.loads((base/'U02-event.json').read_text());raw=json.loads(Path('docs/qa/generator-ab/raw/U02.json').read_text())
issues=[
 {'id':'U02-OLD-01','version':'old','severity':'medium','type':'unsupported-forecast','status':'resolved-in-new','location':'meta.vdotGoal / meta.predictedSec / meta.dayWarnings','expected':'Report entered 23:45 result as current reference, without treating plan completion as confirmed fitness improvement.','actual':'vdot0=40.7 but vdotGoal=44.2 and predictedSec=1329 (22:09), an unverified 96-second improvement; warning describes what the plan realistically delivers. New uses vdotGoal=vdot0=40.7 and predictedSec=1425 (23:45), and explicitly says this is not a race-day progress estimate.','evidence':'raw/U02.json versions.old.plan.meta and versions.new.plan.meta','impact':'Athlete may interpret generated forecast as a demonstrated route toward sub-20.','confidence':'high'},
 {'id':'U02-NEW-01','version':'new-adjustment','severity':'medium','type':'session-purpose-mismatch','status':'open','location':'2026-12-09 / g9d3 / adjusted week9','expected':'Preserve aerobic-I session purpose after dose reduction: the implementation documents a >=60-second minimum for I repetitions; shorter legs need a different stated purpose or format.','actual':'I pyramid100-200-300-200-100m at272sec/km, with61sec walking between legs. Leg times27.2,54.4,81.6,54.4,27.2sec; four of five below60sec. Working dose0.9km/244.8sec. Label remains Piramida, zoneI; copy only states dose adapted.','evidence':'U02-event.json audit.details week9 g9d3; web/src/domain/training/sessions/constraints.ts I minimumRepM comment and interval branch, absent from pyramid branch','impact':'Data are internally coherent, but trimming changes an aerobic interval workout toward brief surges while retaining its I label. This is a policy/purpose mismatch, not a medical safety diagnosis.','confidence':'high'},
 {'id':'U02-NEW-02','version':'new-adjustment','severity':'low','type':'misleading-copy','status':'open','location':'2026-11-30 / g8d1,g8d5,g8d7','expected':'Underexecution reduction without confirmed break should explain reduced load without asserting a pause.','actual':'All26 past eligible runs are explicitly done; daysSinceLastRun=0, recommendation=reduce, options={}, executionAdjustment.breakDays=0. Three future day descriptions nevertheless say Postepen povratak posle pauze.','evidence':'U02-event.json input.log, analysis, adjustment.result.meta.executionAdjustment and week8 descriptions; web/src/domain/plan/returnGrowth.ts','impact':'User can wrongly infer that the application detected a break, even though the recommendation correctly avoided it.','confidence':'high'}]
findings={'id':'U02','reviewerRole':'Independent synthetic-user QA: recreational 5K runner, sub-20 aspiration','profile':raw['profile'],'frozenCommits':{'old':'aea8dc66e5e6a9940ce48d63a94daace76be1297','new':'f7bcbe99d135cd4c1e7b837d0369e8066c1b3baa'},'fixtureSha256':e['fixtureSha256'],'reproduction':{'commands':['node docs/probes/generator-ab-qa.mjs U02','node docs/qa/generator-ab/users/U02-probe.mjs'],'fixtureChecks':e['fixtureChecks'],'result':'Both regenerated hashes match; both original summaries and all three session/prediction/QS audits have zero arithmetic/coherence failures.'},'fullWeeksReviewed':{'old':16,'new':16,'adjustedNew':16},'mainChecks':e['checks'],'protectionChecks':e['protection']['checks'],'issues':issues,'browser':{'status':'not-executed-by-this-agent','owner':'U06 centralized browser harness','scope':'Await centralized evidence; no browser/export/watch/real-user claim in this report.'},'verdict':'Prefer new for evidence honesty, reported-base long-run fit, introductory quality and true deloads; residual adjustment purpose/copy defects need correction. No severe or high issue observed in U02 domain execution.'}
(base/'U02-findings.json').write_text(json.dumps(findings,ensure_ascii=False,indent=2)+'\n')
lines=['# U02 — recreational 5K runner aiming below 20 minutes','',
'Independent synthetic-user review. This is an executable domain QA report, not a real athlete outcome or browser result. All 16 weeks of both frozen generators and all 16 weeks of the adjusted plan were inspected. No implementation or shared-fixture edits were made.','',
'**Verdict:** prefer the new generator. It uses the entered result honestly, starts long runs at the reported 10 km, introduces quality before longer sessions, and supplies genuine quality-free deloads. The reduction event passes all 25 preservation/data checks. Two residual adjustment findings remain: very short I-pyramid legs and pause wording when no pause occurred.','',
'## Frozen profile and reproduction','',
'- Start 2026-10-12; 5K race 2027-01-31; PB 23:45 from 2026-09-20; desired 19:59.',
'- Actual base 30 km/week, repeatable long run 10 km, 12 consistent weeks, no break, some quality experience, four running days, requested two quality days, Sunday long run, standard volume/intensity.',
'- Old commit `aea8dc66e5e6a9940ce48d63a94daace76be1297`; new commit `f7bcbe99d135cd4c1e7b837d0369e8066c1b3baa`.',
'- Reproduced with `node docs/probes/generator-ab-qa.mjs U02` and `node docs/qa/generator-ab/users/U02-probe.mjs`.',
'- Old SHA256 `'+e['fixtureSha256']['old']+'`; new SHA256 `'+e['fixtureSha256']['new']+'`. Both reproduce exactly.',
'- Complete profile, raw prescriptions, resolved dates, every logged run, production analysis/recommendation/adjustment output, protected challenge inputs/output, checks and source hashes are in `U02-event.json`. The probe reproduces that file from frozen roots.','',
'## Every original week','',
'T = threshold, I = aerobic intervals, R = relaxed fast repetitions with full recovery, RP = current supported race rhythm. Session doses below are working kilometres; WU/CD and recovery modes are separately reviewed below. R/I/RP paces stay tied to current confirmed form (4:21/4:32/4:45 per km respectively); T is 5:01/km. None prescribes the desired 4:00/km as proven fitness. All weeks retain four running days.','',
'| Week | Old km / LR / work min | Old purpose and dose | New km / LR / work min | New purpose and dose |','|---|---:|---|---:|---|']
def sessions(w):
 out=[]
 for s in w['sessions']:
  typ=s['type']
  dose=(f"{s['reps']}×{s['repM']}m" if typ=='int' else '-'.join(map(str,s['reps']))+'m' if typ=='pyramid' else f"{s['reps']}×{s['repSec']}s" if typ=='fartlek' else f"{s['qKm']}km")
  out.append(f"{s['zone']} {s['kind']} {dose} ({s['qKm']}km work)")
 if not out:out=['Easy-only deload' if w['deload'] else 'Easy']
 if w['taper']:out.append('taper')
 if w['w']==16:out.append('race 5km')
 return '; '.join(out)
for old,new in zip(raw['versions']['old']['summary']['weeks'],raw['versions']['new']['summary']['weeks']):
 lines.append(f"| {old['w']} | {old['km']} / {old['lrKm']} / {old['workMinutes']} | {sessions(old)} | {new['km']} / {new['lrKm']} / {new['workMinutes']} | {sessions(new)} |")
lines += ['', '## Purpose, dose, recovery, progression and taper judgments','',
'**300 m repetitions.** Old repeats 4×300 m in weeks 1–3 (1.2 km, 5.22 minutes R work). New has two low-dose T fartlek introductions (2.5 and 2.25 minutes), then 3×300 m in week 3 (0.9 km, 3.92 minutes R work) alongside 2×1100 m T. Each 300 m rep takes 78.3 seconds at 4:21/km with 196 seconds walking. That is explicitly full-recovery R work, a plausible speed/form session rather than a claimed VO2max session. The new introduction is a better fit to some quality experience; its low early dose is an introduction, not enough alone to substantiate sub-20 readiness.','',
'**Pyramids.** Original old week 9 is 400-600-800-600-400 m, 2.8 km I work with 163 seconds walking. New week 9 is 300-500-700-500-300 m, 2.3 km I work with 143 seconds walking. New leg times are 81.6/136/190.4/136/81.6 seconds; every original leg clears the documented 60-second I minimum and remains under the 300-second ceiling. Both are symmetric actual pyramids with internally consistent totals. The adjusted tiny pyramid fails the same purpose review; see U02-NEW-01.','',
'**Threshold and aerobic dose.** Main new build weeks carry about 19.55–24.56 minutes total quality, versus old main build weeks about 22.05–29.30 minutes. T blocks use 90-second jogging recovery; I reps use walking at about 75% of repetition duration. Continuous T is 2.7–3.5 km (13.54–17.56 minutes) in later new build weeks. The paces are conservative relative to the aspiration and appropriate to the entered PB. New generally trims quality dose while retaining weekly volume; that is coherent, but is not proof that sub-20 is achievable on the deadline.','',
'**Warm-up/cool-down and arithmetic.** Original new build sessions mostly have 2.7–3.0 km WU and 2.2–2.7 km CD. Old W11 I has a disproportionately long 4.0 km CD after only 2.2 km work; new lowers this to 2.7 km. Recovery distance is intentionally included by production `sessKm`: walking adds 150 m per between-rep recovery, T recovery jogging follows the model, and fartlek includes its easy segments. Consequently displayed day distance need not equal WU+work+CD alone. Audits found zero session-km, matched prediction pace/dose, QS or description discrepancies in old, new and adjusted prescriptions. No CSV/watch-export arithmetic was tested here.','',
'**Long runs and volume.** Old starts below reported capacity (8.6 km), rises to 14 km by week 14 and peaks at 41.2 km/week. New starts at the reported 10 km, climbs 10/10.8/11.6, deloads to 8.4, then 12.5/13.5/14.5; caps at 14.5 thereafter and peaks at 43.3 km/week. New long runs form roughly one third of each build week, reaching 35.45% in week 7. This is a relatively large but explainable long-run share for four runs/week; it needs normal athlete tolerance feedback, not an automatic failure. Comparing rebound weeks with the last non-deload week is essential: W4→5 is +49.19% but W3→5 is +8.82%; W8→9 +43.81% but W7→9 +5.13%. Ordinary build rises are modest; the isolated +8.82% is recorded, not misrepresented as compliance with an 8% original-generator ceiling.','',
'**Recovery and deloads.** Quality sits Wednesday/Friday with Thursday off and Saturday off before Sunday LR; no adjacent session/finish quality days in either original output. Monday strides are short form work and Tuesday strength is optional, so the requested two quality sessions is a maximum rather than a universal weekly count. Old deloads W4/W8/W12 retain 4×200 m R; new removes sessions entirely while lowering weekly km to 24.8/29.9/31.1 and LR to 8.4/10.6/10.0. New build peak remains capped rather than climbing automatically through every late week.','',
'**Taper/race.** New W14→15 falls 42.7→23.9 km (-44.03%) and LR 14.5→8.7, retaining short RP and T touches. W16 is 15.5 km including the race, hence only 10.5 km training before race; it has 3×200 m on Friday at 4:41/km and rest Saturday. The last week has no `taper` flag in both versions but functions as race week with reduced load. New race copy clearly distinguishes desired 19:59 from supported 4:45/km (about23:45); old merely juxtaposes a goal and slower rhythm.','',
'## Actual underexecution event — 2026-11-25','',
'The probe resolves the actual adapted production plan, logs all 26 eligible runs from start through today as done with actual dates/distances and RPE4, and sets exactly the two recent full weeks Nov9–15 and Nov16–22 to 55% of every prescribed running distance. Earlier weeks and the current partial week remain fully prescribed/done. It then executes the real `analyzeExecution`, `recommendExecution` and `buildExecutionAdjustment` without a break override or manual base. This separates shorter completed runs from missed runs and from a pause.','',
'| Full week | Planned km | Actual km | Volume/status coverage |','|---|---:|---:|---:|']
for w in e['analysis']['completeWeeks']:lines.append(f"| {w['start']}–{w['end']} | {w['plannedKm']} | {w['actualKm']} | {w['volumeCoverage']*100:.0f}% / {w['statusCoverage']*100:.0f}% |")
lines += ['',
'Analysis returns exactly two low full weeks, no unknown/missed runs, no recent high easy RPE, last run today, and no days of inferred inactivity. The 28-day window is 2026-10-29–2026-11-25: actual103.6km versus planned137.6km; recent repeatable base is23km (median of20.4/21.2/24.8/34), repeatable long run10.8km (second-largest actual recent run). Recommendation is `reduce`, actionable with confirmation; it is not `return`.','',
'The proposal preserves the race, the goal, four running days, and current-fitness reference; sets weekly base23km and conservative intensities; changes only eligible future days. All45 days through today retain their entire day objects, and past prediction rows retain identities/content. The partial week remains32.5km because18.2km is already completed; only14.3km remains after today, rather than trying to undo history or compensate missed distance.','',
'| Adjusted week / start | km / future km | LR | Purpose/dose |','|---|---:|---:|---|']
for w,detail in zip(e['audit']['weeks'],e['audit']['details']):
 ss=[]
 for s in detail['sessions']:ss.append(f"{s['zone']} {s['kind']} {s['workKm']}km @{s['paceSec']}s/km")
 if not ss:ss=['Easy only']
 if w['deload']:ss.append('deload')
 if w['taper']:ss.append('taper')
 if w['w']==16:ss.append('race')
 lines.append(f"| {w['w']} / {w['start']} | {w['km']} / {w['futureKm']} | {w['lrKm']} | {'; '.join(ss)} |")
lines += ['',
'First full adjusted week is24.6km (+6.96% from23km); later full build weeks25.5/26.7/28.6/30.5/30.2 use the established non-deload volume and stay within8% increases. Deload shifts to Dec14 (18.6km), and the short remaining cycle peaks at30.5km with12km LR. The initial full week is all easy; thereafter the reduced I/T doses are noticeably small (e.g.2×500 m I and2×600 m T), with coherent WU/CD/prediction data. That is conservative reduction behavior, though the Dec9 short I pyramid needs its purpose corrected. No catch-up distance or goal-derived acceleration appears.','',
'## Protected-day challenge','',
'This is a separate second call using the same clean analysis, with protection context deliberately added. It preserves the exact input/context JSON hashes, not merely kilometre totals.','',
'| Protected evidence | Actual outcome |','|---|---|',
'| Every past/today day and past prediction row | Exact equality; passes |',
'| Future g7d5 marked done, logged on Nov24 | Entire day retained; passes |',
'| g9d3 manual WU3.7km with override flag and refreshed distance/description | Entire session/day retained and dated warning emitted; passes |',
'| g8d1 manual alternative4.2km easy | Underlying day retained; effective resolved overlay remains4.2km and warning emitted; passes |',
'| g10d3 measured prediction row value273, lock true | Day and exact original prediction row ID/body retained; passes |',
'| g7d7 moved into Nov24, g7d2 moved to Nov29 to free date | Moved day resolves to Nov24 before/after and is preserved; passes |',
'| Race/date/run-day count/fitness-reference preservation | All pass; unique day and prediction IDs pass |',
'| Inputs/context mutation | None observed in either call |',
'',f"All {len(e['checks'])} main checks and {len(e['protection']['checks'])} protection checks pass. Zero coherence failures in old/new/adjusted audits. Checks apply to production domain execution and preservation; they do not establish application state persistence or device export behavior.",'',
'## Exact findings','']
for i in issues:
 lines += [f"### {i['id']} — {i['severity']} — {i['status']}",'',f"Location: {i['location']}",'',f"Expected: {i['expected']}",'',f"Actual: {i['actual']}",'',f"Impact: {i['impact']}",'',f"Evidence: {i['evidence']}",'']
lines += ['## Browser evidence boundary','',
'No browser task was executed by this U02 agent. U06 owns the centralized real-UI harness with isolated Playwright contexts/fake backend; its observed U02 outcomes must be attached by the parent before claiming browser coverage. This report does not claim reload persistence, calendar move controls, exports, actual watch integration or real-user acceptance. All requested domain event work is executed, not planned.']
report='\n'.join(lines)+'\n'
report=re.sub(r'(\d)(km|sec)(?=\W|$)',r'\1 \2',report)
for word in ['actual','planned','base','from','of','All','within','about','at','is','WU','alternative','value','week','weeks']:
 report=re.sub(r'\b'+word+r'(?=\d)',word+' ',report)
report=report.replace('I pyramid100','I pyramid 100').replace('below60sec','below 60 sec')
(base/'U02.md').write_text(report)
