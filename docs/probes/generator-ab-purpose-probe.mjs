// Reproduces a semantic zone mismatch without changing the generator.
import './generator-ab-qa.mjs';
import { writeFileSync } from 'node:fs';
const { sessInt } = await import('../../web/src/domain/training/sessions/build.ts');
const { applyQualityDose } = await import('../../web/src/domain/training/distances/qualityDose.ts');
const { constrainSession } = await import('../../web/src/domain/training/sessions/constraints.ts');
const request={qualW:10,qualWeeks:13,slotRole:'q1',effQ:2,vol:60,pI:250,pT:280,pE:360,pR:240,isTaper1:false,dow:2,racePace:270,readiness:'experienced',qualityIntensity:'std'};
const builder=sessInt(2,3,6,1200,270,60,2,'Trkački ritam');
const clone=x=>JSON.parse(JSON.stringify(x));
const ambiguous=applyQualityDose(clone(builder),request);
const explicit=clone(builder);explicit.session.zone='RP';explicit.session.paceSource='race-specific';
const correctPurpose=applyQualityDose(explicit,request);
const validAmbiguous=constrainSession(ambiguous.session,60,1800);
const validExplicit=constrainSession(correctPurpose.session,60,1800);
const output={scope:'Isolated production builder→dose→constraint reproduction, not proposed coaching prescription or implementation change',request,builder,ambiguous,correctPurpose,checks:{bothRemainRaceSpecific:ambiguous.session.zone==='RP'&&correctPurpose.session.zone==='RP',restChangedWhenPurposeAbsent:ambiguous.session.restSec===240,explicitPurposePreservesBuilderRest:correctPurpose.session.restSec===60,bothValid:validAmbiguous&&validExplicit},rootCause:'applyQualityDose falls back to legacy ZONE_FOR_KIND[Trkački ritam]=I before constrainSession later assigns RP via KIND_FROM_GOAL; the RP builder recovery is overwritten as I recovery.'};
writeFileSync(new URL('../qa/generator-ab/purpose-reproduction.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({checks:output.checks,builderRest:builder.session.restSec,ambiguousRest:ambiguous.session.restSec,explicitRest:correctPurpose.session.restSec,workReps:ambiguous.session.reps,zone:ambiguous.session.zone}));
if(Object.values(output.checks).some(x=>!x))process.exitCode=1;
