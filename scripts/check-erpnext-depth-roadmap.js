'use strict';
const fs=require('node:fs');
const path=require('node:path');

const ROADMAP_ID='erpnext-depth-6-phases';
const EXPECTED_PHASES=[
  ['accounting-core','Accounting Core'],
  ['projects-2','Projects 2.0'],
  ['crm','CRM'],
  ['manufacturing-shop-floor','Manufacturing Shop Floor'],
  ['stock-logistics','Stock Logistics'],
  ['asset-accounting','Asset Accounting']
];
const PHASE_STATES=new Set(['pending','in_progress','blocked','completed']);
const NEXT_STAGE_STATES=new Set(['locked','unlocked','started']);
const EVIDENCE_KEYS=['implementation','tests','verification'];

function validateManifest(manifest,{requireComplete=false}={}){
  const errors=[];
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))return['manifest must be an object'];
  if(manifest.roadmapId!==ROADMAP_ID)errors.push(`roadmapId must be ${ROADMAP_ID}`);
  if(manifest.schemaVersion!==1)errors.push('schemaVersion must be 1');

  const phases=Array.isArray(manifest.phases)?manifest.phases:[];
  if(phases.length!==EXPECTED_PHASES.length)errors.push(`roadmap must contain exactly ${EXPECTED_PHASES.length} phases`);
  const seen=new Set();
  for(const phase of phases){
    const id=String(phase?.id||'');
    if(seen.has(id))errors.push(`duplicate phase id: ${id}`);
    seen.add(id);
    if(!EXPECTED_PHASES.some(([expected])=>expected===id))errors.push(`unknown phase id: ${id}`);
    if(!PHASE_STATES.has(phase?.status))errors.push(`phase ${id||'<missing>'} has invalid status`);
    const evidence=phase?.evidence;
    if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)){
      errors.push(`phase ${id||'<missing>'} evidence must be an object`);
      continue;
    }
    for(const key of EVIDENCE_KEYS){
      if(!Array.isArray(evidence[key]))errors.push(`phase ${id||'<missing>'} evidence.${key} must be an array`);
      else if(phase.status==='completed'&&evidence[key].length===0)errors.push(`phase ${id||'<missing>'} completed without ${key} evidence`);
    }
  }
  for(const [id] of EXPECTED_PHASES)if(!seen.has(id))errors.push(`missing required phase: ${id}`);

  const next=manifest.nextStage;
  if(!next||typeof next!=='object'||Array.isArray(next))errors.push('nextStage must be an object');
  else if(!NEXT_STAGE_STATES.has(next.status))errors.push('nextStage.status must be locked, unlocked or started');

  const completeCount=phases.filter(p=>p?.status==='completed'&&EVIDENCE_KEYS.every(k=>Array.isArray(p?.evidence?.[k])&&p.evidence[k].length>0)).length;
  const fullCompletion=completeCount===EXPECTED_PHASES.length&&phases.length===EXPECTED_PHASES.length&&EXPECTED_PHASES.every(([id])=>seen.has(id));
  const nextStageAdvancing=next&&next.status!=='locked';
  if((requireComplete||nextStageAdvancing)&&!fullCompletion){
    const reason=nextStageAdvancing?'next stage requires all 6 phases completed with evidence':'roadmap:require-complete requires 6/6 phases completed with evidence';
    errors.push(`${reason}; current valid completion: ${completeCount}/6`);
  }
  return errors;
}

function loadManifest(filePath){return JSON.parse(fs.readFileSync(filePath,'utf8'));}
function runCli(){
  const requireComplete=process.argv.includes('--require-complete');
  const filePath=path.resolve(process.cwd(),'roadmap','erpnext-depth-6-phases.json');
  let manifest;
  try{manifest=loadManifest(filePath);}catch(error){console.error(`Roadmap gate: cannot read ${filePath}: ${error.message}`);process.exitCode=1;return;}
  const errors=validateManifest(manifest,{requireComplete});
  if(errors.length){console.error('Roadmap gate failed:');for(const error of errors)console.error(`- ${error}`);process.exitCode=1;return;}
  const complete=manifest.phases.filter(p=>p.status==='completed').length;
  console.log(`Roadmap gate OK: ${complete}/6 phases completed; nextStage=${manifest.nextStage.status}${requireComplete?' (6/6 required)':''}.`);
}

if(require.main===module)runCli();
module.exports={ROADMAP_ID,EXPECTED_PHASES,PHASE_STATES,NEXT_STAGE_STATES,EVIDENCE_KEYS,validateManifest,loadManifest};
