'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');
const actor={userId:'admin',role:'admin',companyId:'default'};
const other={userId:'other',role:'admin',companyId:'other'};

test('projects 2.0 reconciles time, costs, revenue and profitability per company',()=>{
 let n=0;const rt=createErpRuntime({idFactory:p=>`${p}-${++n}`});
 try{
  assert.ok(rt.projects2);
  rt.operations.createProject({id:'P1',code:'P1',name:'Projeto Alfa'},actor);
  rt.projects2.setBudget('P1',100000,actor);
  rt.projects2.addTime('P1',{userId:'u1',hours:2,hourlyCostCents:5000,billableRateCents:8000,workedAt:'2026-09-10'},actor);
  rt.projects2.addExpense('P1',{description:'Deslocamento',amountCents:10000,occurredAt:'2026-09-11'},actor);
  rt.projects2.addMaterialCost('P1',{description:'Material',amountCents:5000,occurredAt:'2026-09-11'},actor);
  rt.projects2.addRevenue('P1',{description:'Marco 1',amountCents:40000,occurredAt:'2026-09-12'},actor);
  const p=rt.projects2.profitability('P1',actor);
  assert.equal(p.budgetCents,100000);assert.equal(p.costCents,25000);assert.equal(p.revenueCents,40000);assert.equal(p.profitCents,15000);
  assert.throws(()=>rt.projects2.profitability('P1',other),/projeto|encontrado/i);
 }finally{rt.close();}
});
