'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');

const admin={userId:'admin',role:'admin'};
function fixture(){let n=0;const rt=createErpRuntime({dbPath:':memory:',now:()=> '2026-09-25T12:00:00.000Z',idFactory:p=>`${p}-${++n}`});rt.finance.createAccount({id:'BANK-1',name:'Banco Principal',type:'BANK'},admin);rt.financeDimensions.saveCategory({id:'UTILITIES',name:'Contas e utilidades',kind:'EXPENSE'},admin);rt.financeDimensions.saveCategory({id:'SALES',name:'Vendas',kind:'INCOME'},admin);rt.financeDimensions.saveCategory({id:'RENT',name:'Aluguel',kind:'EXPENSE'},admin);return rt;}

test('CSV/PDF_TEXT/MANUAL converge to canonical statement rows and renamed CSV content stays idempotent',async()=>{
  const rt=fixture();
  const csv='Data;Descrição;Valor\n25/09/2026;PIX FORNECEDOR;-50,00\n25/09/2026;PIX CLIENTE;100,00';
  const preview=await rt.bankStatements.preview({sourceType:'CSV',accountId:'BANK-1',sourceName:'extrato.csv',content:csv});
  assert.equal(preview.format,'CSV');
  assert.equal(preview.transactions.length,2);
  assert.deepEqual(preview.transactions.map(x=>[x.date,x.direction,x.amountCents]),[['2026-09-25','debit',5000],['2026-09-25','credit',10000]]);
  assert.equal(rt.bankStatements.listTransactions().length,0);
  const first=await rt.bankStatements.commit({sourceType:'CSV',accountId:'BANK-1',sourceName:'extrato.csv',content:csv},admin);
  const renamed=await rt.bankStatements.commit({sourceType:'CSV',accountId:'BANK-1',sourceName:'copia-renomeada.csv',content:csv},admin);
  assert.equal(first.inserted,2);
  assert.equal(renamed.inserted,0);
  assert.equal(renamed.duplicates,2);

  const pdf=await rt.bankStatements.preview({sourceType:'PDF_TEXT',accountId:'BANK-1',sourceName:'extrato.pdf',content:'25/09/2026 POSTO TESTE -125,50\nlinha sem transacao\n26/09/2026 PIX RECEBIDO 80,00'});
  assert.deepEqual(pdf.transactions.map(x=>[x.date,x.direction,x.amountCents]),[['2026-09-25','debit',12550],['2026-09-26','credit',8000]]);

  const manual=await rt.bankStatements.preview({sourceType:'MANUAL',accountId:'BANK-1',sourceName:'manual',rows:[{date:'2026-09-25',description:'Ajuste manual',amountCents:3210,direction:'debit'}]});
  assert.equal(manual.transactions.length,1);
  assert.equal(manual.transactions[0].description,'Ajuste manual');
  await assert.rejects(()=>rt.bankStatements.preview({sourceType:'MANUAL',accountId:'BANK-1',sourceName:'manual',rows:[{date:'25/09/2026',description:'Inválido',amountCents:100,direction:'debit'}]}),/data/i);
  rt.close();
});

test('settlement receipt is structured and reversed settlements cannot produce a valid receipt',()=>{
  const rt=fixture();
  const entry=rt.finance.createEntry({kind:'PAYABLE',description:'Fornecedor Água',amountCents:12345,dueAt:'2026-09-25T12:00:00.000Z',accountId:'BANK-1',categoryId:'UTILITIES'},admin);
  const paid=rt.finance.settleEntry(entry.id,{id:'SET-1',amountCents:12345,method:'PIX',note:'Pago no vencimento'},admin);
  const receipt=rt.financeDocuments.settlementReceipt(paid.settlement.id);
  assert.equal(receipt.kind,'SETTLEMENT_RECEIPT');
  assert.equal(receipt.title,'Comprovante de pagamento');
  assert.equal(receipt.settlement.amountCents,12345);
  assert.equal(receipt.account.name,'Banco Principal');
  assert.equal(receipt.category.name,'Contas e utilidades');
  assert.match(rt.financeDocuments.toPrintableHtml(receipt),/Comprovante de pagamento/);
  rt.finance.reverseSettlement('SET-1',{reason:'Teste de estorno',actor:admin});
  assert.throws(()=>rt.financeDocuments.settlementReceipt('SET-1'),/estorn/i);
  rt.close();
});

test('financial report exports UTF-8 CSV, real XLSX container and escaped printable HTML',()=>{
  const rt=fixture();
  rt.finance.createEntry({kind:'RECEIVABLE',description:'=SUM(A1:A2)',amountCents:15000,dueAt:'2026-09-25T12:00:00.000Z',accountId:'BANK-1',categoryId:'SALES'},admin);
  rt.finance.createEntry({kind:'PAYABLE',description:'Aluguel',amountCents:5000,dueAt:'2026-09-26T12:00:00.000Z',accountId:'BANK-1',categoryId:'RENT'},admin);
  const report=rt.financeDocuments.financialReport({from:'2026-09-01',to:'2026-09-30'});
  assert.equal(report.rows.length,2);
  assert.equal(report.totals.amountCents,20000);
  const csv=rt.financeDocuments.toCsv(report);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/"'=SUM\(A1:A2\)"/);
  const xlsx=rt.financeDocuments.toXlsxBuffer(report);
  assert.ok(Buffer.isBuffer(xlsx));
  assert.equal(xlsx.subarray(0,2).toString('ascii'),'PK');
  const html=rt.financeDocuments.toPrintableHtml(report);
  assert.match(html,/Relatório financeiro/);
  assert.doesNotMatch(html,/<script/i);
  assert.match(html,/=SUM\(A1:A2\)/);
  rt.close();
});
