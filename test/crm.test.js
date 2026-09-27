'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');
const actor={userId:'admin',role:'admin',companyId:'default'};

test('CRM converts lead once, tracks opportunity/activity and summarizes pipeline',()=>{
 let n=0;const rt=createErpRuntime({idFactory:p=>`${p}-${++n}`});
 try{
  assert.ok(rt.crm);
  const lead=rt.crm.createLead({id:'L1',name:'Cliente Potencial',email:'lead@example.com',source:'site'},actor);
  assert.equal(lead.status,'OPEN');
  const customer=rt.crm.convertLeadToCustomer('L1',{},actor);
  const same=rt.crm.convertLeadToCustomer('L1',{},actor);
  assert.equal(same.id,customer.id);
  const opp=rt.crm.createOpportunity({id:'O1',leadId:'L1',customerId:customer.id,name:'Projeto ERP',expectedRevenueCents:500000},actor);
  rt.crm.moveOpportunity('O1','proposal',actor);
  rt.crm.addActivity({opportunityId:'O1',kind:'CALL',subject:'Retorno',dueAt:'2026-09-30'},actor);
  const summary=rt.crm.pipelineSummary(actor);
  assert.equal(summary.totalOpportunities,1);
  assert.equal(summary.expectedRevenueCents,500000);
  assert.equal(summary.byStage.proposal.count,1);
  assert.equal(rt.crm.listActivities({opportunityId:'O1'},actor).length,1);
 }finally{rt.close();}
});
