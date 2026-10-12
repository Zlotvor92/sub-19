// Validate evidence, not physiological outcomes. Never overwrite frozen scores or old QA.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
const root = fileURLToPath(new URL('../../',import.meta.url));
const dir = new URL('../qa/generator-final/',import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path,dir),'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const manifest=read('manifest.json'),profiles=read('inputs.json'),lock=read('score-lock.json');
const weights={fit:20,quality:20,progression:15,recovery:15,specificity:10,taper:10,coherence:10};
const coaches=['5k','10k','hm','marathon'];
const eventLock=read('event-review-summary.json');
let scores=0,weekReviews=0,events=0;
const generatedRows=[];
for(const coach of coaches) {
  const frozen=lock.reviewers[coach];
  assert.equal(hash(readFileSync(new URL(`coaches/${frozen.scoreFile}`,dir))),frozen.scoreSha256);
  assert.equal(hash(readFileSync(new URL(`coaches/${frozen.reportFile}`,dir))),frozen.reportSha256);
  const doc=read(`coaches/${coach}-scores.json`),seen=new Set();
  assert.equal(doc.blinded,true);assert.deepEqual(doc.criteriaWeights,weights);assert.equal(doc.plans.length,20);
  for(const row of doc.plans) {
    const key=`${row.profileId}:${row.side}`;assert(!seen.has(key));seen.add(key);
    const blind=read(`blind/${row.profileId}.json`).plans[row.side].plan;
    assert.equal(row.weeksReviewed,blind.weeks.length);
    assert.deepEqual(row.weekNotes.map(x=>x.week).sort((a,b)=>a-b),blind.weeks.map(w=>w.w));
    assert.deepEqual(Object.keys(row.criteria).sort(),Object.keys(weights).sort());
    for(const rating of Object.values(row.criteria)) assert(rating>=0&&rating<=10);
    const total=Object.entries(weights).reduce((n,[k,w])=>n+row.criteria[k]*w/10,0);
    assert(Math.abs(total-row.total)<1e-6,`${coach}/${key}: wrong total`);
    weekReviews+=row.weeksReviewed;scores++;
    generatedRows.push({coach,profileId:row.profileId,version:manifest.blindOrder[row.profileId][['X','Y'].indexOf(row.side)],total:row.total});
  }
  const e=read(`coaches/${coach}-events.json`);
  assert.equal(hash(readFileSync(new URL(`coaches/${coach}-events.json`,dir))),eventLock.reviewers[coach].eventSha256);
  assert.equal(hash(readFileSync(new URL(`coaches/${coach}-events.md`,dir))),eventLock.reviewers[coach].reportSha256);
  assert.equal(e.events.length,10);assert.equal(e.initialScoreSha256,frozen.scoreSha256);
  assert.deepEqual(e.events.map(x=>x.profileId).sort(),profiles.map(p=>p.id).sort());
  events+=e.events.length;
}
assert.equal(scores,80);assert.equal(weekReviews,1296);assert.equal(events,40);
const packets=read('coach-inputs/index.json');
assert.equal(packets.files.length,12);
for(const packet of packets.files) {
  const zipped=readFileSync(new URL(`coach-inputs/${packet.artifact}`,dir));
  assert.equal(hash(zipped),packet.gzipSha256);
  assert.equal(hash(gunzipSync(zipped)),packet.uncompressedSha256);
}
const summary=read('summary.json');
for(const p of profiles) {
  const row=summary.profiles.find(x=>x.profileId===p.id);
  for(const version of ['old','new']) {
    for(const coach of coaches) assert.equal(row.versions[version].scores[coach],generatedRows.find(x=>x.profileId===p.id&&x.version===version&&x.coach===coach).total);
    assert.equal(row.versions[version].primary,row.versions[version].scores[row.distanceExpert]);
  }
  assert(readFileSync(new URL(`users/${p.id}.md`,dir)).length>0);
  const raw=read(`raw/${p.id}.json`),historical=JSON.parse(readFileSync(new URL(`../generator-ab/raw/${p.id}.json`,dir),'utf8'));
  assert.equal(raw.versions.old.sha256,historical.versions.new.sha256);
  for(const v of Object.values(raw.versions)) assert.equal(hash(JSON.stringify(v.plan)),v.sha256);
}
for(const [path,expected] of Object.entries(manifest.candidateProductionFilesSha256))
  assert.equal(hash(readFileSync(new URL(path,new URL('../../',import.meta.url)))),expected,`Production source changed: ${path}`);
assert.equal(hash(readFileSync(new URL('inputs.json',dir))),manifest.inputFileSha256);
const frozenPaths=execFileSync('git',['ls-tree','-r','--name-only',manifest.frozenQACommit,'docs/qa/generator-ab','docs/GENERATOR_10_USERS_4_COACHES_REPORT.md'],{cwd:root,encoding:'utf8'}).trim().split('\n');
for(const path of frozenPaths) {
  const original=execFileSync('git',['show',`${manifest.frozenQACommit}:${path}`],{cwd:root});
  assert.equal(hash(readFileSync(new URL(path,new URL('../../',import.meta.url)))),hash(original),`Historical evidence changed: ${path}`);
}
for(const segment of manifest.segments) execFileSync('git',['merge-base','--is-ancestor',segment.commit,'HEAD'],{cwd:root});
const probeResults=read('validation/user-probes.json');assert.equal(probeResults.results.length,10);
for(const result of probeResults.results) {
  assert.equal(result.exitCode,0);
  assert.equal(hash(readFileSync(new URL(result.output,new URL('../../',import.meta.url)))),result.outputSha256);
}
const ci=read('validation/ci.json');
assert.equal(ci.web.tests,1519);assert.equal(ci.web.e2e.passed,77);assert.equal(ci.web.e2e.failed,0);
assert.equal(ci.artifact.downloadedShaVerified,true);
const browser=read('browser/index.json');
assert.equal(browser.tests.length,11);assert.equal(browser.stats.expected,77);assert.equal(browser.stats.unexpected,0);
for(const selected of browser.visualSelections) {
  assert.equal(selected.visuallyReviewed,true);
  assert.equal(hash(readFileSync(new URL(`browser/${selected.localArtifact}`,dir))),selected.sha256);
}
const output={atUtc:new Date().toISOString(),scores,planWeeksReviewed:weekReviews,eventReviews:events,userAgents:10,profiles:profiles.map(p=>p.id),frozenFilesVerified:frozenPaths.length,productionFilesVerified:Object.keys(manifest.candidateProductionFilesSha256).length,archivedCoachPacketsVerified:packets.files.length,integratedSegments:7,allUserProbeExitCodesZero:true,initialScoresUnchanged:true,technicalMeaning:'Evidence integrity and enumerated test invariants; not coaching or physiological certification.',newEvidenceFiles:readdirSync(dir)};
writeFileSync(new URL('evidence-check.json',dir),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
