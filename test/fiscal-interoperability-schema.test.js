'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');

test('fiscal schema supports company scope, nfse, snapshots and source relations',()=>{
 const r=createErpRuntime();
 try{
  const cols=Object.fromEntries(r.db.prepare("PRAGMA table_info('fiscal_documents')").all().map(x=>[x.name,x]));
  for(const name of ['direction','operation_kind','snapshot_json','parent_document_id'])assert.ok(cols[name],`missing ${name}`);
  const profileCols=Object.fromEntries(r.db.prepare("PRAGMA table_info('fiscal_profiles')").all().map(x=>[x.name,x]));
  assert.ok(profileCols.company_id);
  const productCols=Object.fromEntries(r.db.prepare("PRAGMA table_info('product_fiscal_data')").all().map(x=>[x.name,x]));
  assert.ok(productCols.company_id);
  const sequenceCols=Object.fromEntries(r.db.prepare("PRAGMA table_info('fiscal_sequences')").all().map(x=>[x.name,x]));
  assert.ok(sequenceCols.company_id);
  const settingsIndexes=r.db.prepare("PRAGMA index_list('fiscal_company_settings')").all();
  assert.ok(settingsIndexes.some(x=>x.unique===1));
  r.db.prepare("INSERT INTO fiscal_documents(id,company_id,source_type,source_id,document_type,direction,operation_kind,provider,environment,series,number,status,idempotency_key,snapshot_json,created_at,updated_at) VALUES('nfse-test','default','SERVICE_ORDER_SERVICE','os-1','nfse','OUTBOUND','ISSUE','acbr-local','homologation','1',1,'PENDING','k-nfse','{}','2026-09-26','2026-09-26')").run();
  assert.equal(r.db.prepare("SELECT document_type FROM fiscal_documents WHERE id='nfse-test'").get().document_type,'nfse');
 }finally{r.close();}
});
