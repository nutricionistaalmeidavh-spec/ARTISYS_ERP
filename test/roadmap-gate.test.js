'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateManifest}=require('../scripts/check-erpnext-depth-roadmap');

const ids=['accounting-core','projects-2','crm','manufacturing-shop-floor','stock-logistics','asset-accounting'];
const names=['Accounting Core','Projects 2.0','CRM','Manufacturing Shop Floor','Stock Logistics','Asset Accounting'];
function manifest(){return{roadmapId:'erpnext-depth-6-phases',schemaVersion:1,nextStage:{status:'locked',name:null},phases:ids.map((id,i)=>({id,name:names[i],status:'pending',evidence:{implementation:[],tests:[],verification:[]}}))};}
function completed(){const m=manifest();for(const p of m.phases){p.status='completed';p.evidence={implementation:['commit:example'],tests:['test:example'],verification:['ci:example']};}return m;}

test('accepts the initial six-phase manifest during normal development',()=>{
  assert.deepEqual(validateManifest(manifest()),[]);
});

test('rejects completed phase without all evidence categories populated',()=>{
  const m=manifest();m.phases[0].status='completed';m.phases[0].evidence.implementation.push('commit:x');
  const errors=validateManifest(m);
  assert.ok(errors.some(x=>x.includes('accounting-core')&&x.includes('tests')));
  assert.ok(errors.some(x=>x.includes('accounting-core')&&x.includes('verification')));
});

test('rejects an early next-stage unlock during normal validation',()=>{
  const m=manifest();m.nextStage.status='unlocked';
  const errors=validateManifest(m);
  assert.ok(errors.some(x=>x.includes('requires all 6 phases')));
});

test('require-complete rejects an incomplete roadmap',()=>{
  const errors=validateManifest(manifest(),{requireComplete:true});
  assert.ok(errors.some(x=>x.includes('6/6')));
});

test('require-complete accepts six completed phases with evidence',()=>{
  assert.deepEqual(validateManifest(completed(),{requireComplete:true}),[]);
});

test('rejects duplicate or unknown phase identifiers',()=>{
  const m=manifest();m.phases[5].id='crm';
  const errors=validateManifest(m);
  assert.ok(errors.some(x=>x.includes('duplicate')));
  assert.ok(errors.some(x=>x.includes('asset-accounting')));
});
