'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');
const actor={userId:'admin',role:'admin',companyId:'default'};

test('asset accounting capitalizes, depreciates, moves custody and disposes with balanced journals',()=>{
 let n=0;const rt=createErpRuntime({idFactory:p=>`${p}-${++n}`});
 try{
  assert.ok(rt.assetAccounting);
  for(const a of [
   {id:'CASH',code:'1.1',name:'Caixa',type:'ASSET',normalBalance:'DEBIT'},
   {id:'FA',code:'1.2',name:'Imobilizado',type:'ASSET',normalBalance:'DEBIT'},
   {id:'AD',code:'1.2.1',name:'Depreciacao acumulada',type:'ASSET',normalBalance:'CREDIT'},
   {id:'DE',code:'5.1',name:'Despesa depreciacao',type:'EXPENSE',normalBalance:'DEBIT'},
   {id:'LOSS',code:'5.2',name:'Perda na baixa',type:'EXPENSE',normalBalance:'DEBIT'}
  ])rt.accounting.createAccount(a,actor);
  rt.operations.createAsset({id:'A1',code:'A1',name:'Maquina'},actor);
  const book=rt.assetAccounting.capitalize({assetId:'A1',acquisitionDate:'2026-09-01',acquisitionCostCents:120000,residualValueCents:0,usefulLifeMonths:12,assetAccountId:'FA',accumulatedDepreciationAccountId:'AD',depreciationExpenseAccountId:'DE',counterpartAccountId:'CASH'},actor);
  assert.equal(book.netBookValueCents,120000);
  const dep=rt.assetAccounting.postDepreciation('A1',{date:'2026-10-01'},actor);
  assert.equal(dep.amountCents,10000);
  rt.assetAccounting.moveCustody('A1',{custodian:'tecnico-1',locationId:'filial-1'},actor);
  const disposal=rt.assetAccounting.dispose('A1',{date:'2026-11-01',proceedsCents:90000,proceedsAccountId:'CASH',lossGainAccountId:'LOSS'},actor);
  assert.equal(disposal.netBookValueCents,110000);assert.equal(disposal.lossCents,20000);
  const j=rt.accounting.getJournal(disposal.journalId,actor);
  const debit=j.lines.reduce((s,x)=>s+x.debitCents,0),credit=j.lines.reduce((s,x)=>s+x.creditCents,0);
  assert.equal(debit,credit);
 }finally{rt.close();}
});
