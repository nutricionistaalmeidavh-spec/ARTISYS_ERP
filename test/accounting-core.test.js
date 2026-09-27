'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');
const actor={userId:'admin',role:'admin',companyId:'default'};
const other={userId:'admin-2',role:'admin',companyId:'other'};

test('accounting core posts balanced journals, locks periods and reverses without mutation',()=>{
 let n=0;const rt=createErpRuntime({idFactory:p=>`${p}-${++n}`});
 try{
  assert.ok(rt.accounting);
  rt.accounting.createAccount({id:'CASH',code:'1.1',name:'Caixa',type:'ASSET',normalBalance:'DEBIT'},actor);
  rt.accounting.createAccount({id:'SALES',code:'4.1',name:'Receita',type:'REVENUE',normalBalance:'CREDIT'},actor);
  assert.throws(()=>rt.accounting.postJournal({date:'2026-09-10',description:'invalido',lines:[{accountId:'CASH',debitCents:1000},{accountId:'SALES',creditCents:900}]},actor),/balanceado|debitos|cr[eé]ditos/i);
  const posted=rt.accounting.postJournal({id:'J1',date:'2026-09-10',description:'Venda',lines:[{accountId:'CASH',debitCents:1000},{accountId:'SALES',creditCents:1000}]},actor);
  assert.equal(posted.status,'POSTED');
  const tb=rt.accounting.trialBalance({from:'2026-09-01',to:'2026-09-30'},actor);
  assert.equal(tb.totalDebitCents,1000);assert.equal(tb.totalCreditCents,1000);assert.equal(tb.balanced,true);
  assert.equal(rt.accounting.listAccounts(other).length,0);
  const period=rt.accounting.createPeriod({id:'SEP26',name:'Setembro 2026',startDate:'2026-09-01',endDate:'2026-09-30'},actor);
  rt.accounting.closePeriod(period.id,actor);
  assert.throws(()=>rt.accounting.postJournal({date:'2026-09-20',description:'bloqueado',lines:[{accountId:'CASH',debitCents:100},{accountId:'SALES',creditCents:100}]},actor),/fechad|bloquead/i);
  const reversal=rt.accounting.reverseJournal('J1',{date:'2026-10-01',reason:'Estorno'},actor);
  assert.equal(reversal.reversalOf,'J1');
  assert.equal(rt.accounting.getJournal('J1',actor).status,'POSTED');
 }finally{rt.close();}
});
