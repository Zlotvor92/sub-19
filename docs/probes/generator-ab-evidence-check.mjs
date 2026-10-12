// Check reviewer coverage and preservation of the previously frozen score bytes.
// This validates the evidence package, not training effectiveness.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = new URL('../qa/generator-ab/', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, base), 'utf8'));
const hash = p => createHash('sha256').update(readFileSync(new URL(p, base))).digest('hex');
const ids = read('inputs.json').map(p => p.id);
const initial = read('summary.json');
const reviewerFiles = ['5k', '10k', 'hm', 'marathon-primary'];
const initialReviewHashes = {
  '5k': 'fd4975b89fbbf17e01ff32a4d5d11c9b7869ce4047f01de0cf1c612c892faf4b',
  '10k': 'dd7b1bf558d8f217103943c8af8d5c07261ddfb051c45bc5cb1be010130dd4cb',
  hm: 'e810ed45c0491bba3dda8e9e7a821054a56d9c1e0e90e2ac9ab74bf466027770',
  'marathon-primary': '04ca94dca4c9a56185960c32711f9dbe91b56d08d982c2e852afed4c114082c9'
};
for (const id of ids) for (const suffix of ['.md', '-findings.json', '-probe.mjs', '-event.json']) {
  if (!existsSync(new URL(`users/${id}${suffix}`, base))) throw Error(`Missing user evidence ${id}${suffix}`);
}
for (const file of initial.scoreFiles) {
  if (hash(file.path) !== file.sha256) throw Error(`Initial scores changed: ${file.path}`);
}
const rows = reviewerFiles.map(name => {
  if (hash(`coaches/${name}-review.md`) !== initialReviewHashes[name]) throw Error(`Initial review changed: ${name}`);
  const json = `coaches/${name}-events.json`;
  const md = `coaches/${name}-events.md`;
  if (!existsSync(new URL(md, base))) throw Error(`Missing event report ${md}`);
  const document = read(json);
  const records = Array.isArray(document) ? document : document.records ?? document.reviews;
  if (!Array.isArray(records) || records.length !== 10) throw Error(`${json}: ten records required`);
  if (new Set(records.map(r => r.id)).size !== 10 || ids.some(id => !records.some(r => r.id === id))) throw Error(`${json}: invalid profile coverage`);
  for (const r of records) {
    if (!r.verdict || !r.actualOutcome || !r.preservation) throw Error(`${json}/${r.id}: incomplete review`);
  }
  return { reviewer: name, json, markdown: md, sha256: hash(json), reviewedProfiles: records.map(r => r.id), verdicts: records.map(r => ({ id: r.id, actualOutcome: r.actualOutcome, verdict: r.verdict })) };
});
const evidence = {
  scope: 'Coverage and frozen-byte verification; independent AI review of synthetic domain payloads, not human performance validation.',
  userAgents: 10, userEvidenceFiles: 40, primaryCoachAgents: 4,
  initialScoredPlans: initial.initialReviewCount, initialReviewedPlanWeeks: initial.reviewedWeekCount,
  eventReviewCount: rows.reduce((n,r)=>n+r.reviewedProfiles.length,0),
  initialScoreHashesUnchanged: true, initialReviewHashesUnchanged: true,
  initialScoreFiles: initial.scoreFiles, initialReviewHashes, reviewers: rows
};
writeFileSync(new URL('event-review-summary.json', base), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({userAgents:10,primaryCoaches:4,initialReviews:80,eventReviews:40,initialScoresUnchanged:true}));
