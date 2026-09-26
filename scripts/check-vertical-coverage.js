'use strict';
const fs=require('node:fs');const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const routerDir=path.join(ROOT,'server','routers');
const e2eDir=path.join(ROOT,'qa','e2e');
const apiTests=fs.readdirSync(path.join(ROOT,'test')).filter(x=>x.endsWith('.test.js')).map(x=>fs.readFileSync(path.join(ROOT,'test',x),'utf8')).join('\n');
const e2e=fs.readdirSync(e2eDir).filter(x=>x.endsWith('.test.js')).map(x=>fs.readFileSync(path.join(e2eDir,x),'utf8')).join('\n');
const groups=[
 {name:'master-data',router:'master-data-router.js',api:['customers','suppliers','product-categories','products'],ui:['customer','supplier','category','product']},
 {name:'inventory',router:'inventory-router.js',api:['inventory/locations','inventory/balance','inventory/movements','inventory/adjustments','inventory/transfers','inventory/reservations'],ui:['inventory-location','inventory-adjust','inventory-transfer','inventory-balance']},
 {name:'procurement',router:'procurement-router.js',api:['procurement/requisitions','procurement/quotations','procurement/awards','procurement/approvals','procurement/orders','procurement/receipts','procurement/returns'],ui:['procurement-requisition','procurement-quotation','data-award-id','data-order-id','data-receipt-id']},
 {name:'sales',router:'sales-admin-router.js',api:['sales/quotes','sales/orders','sales/invoices'],ui:['sales-quote','data-sales-order','sales-invoice']},
 {name:'finance',router:'finance-router.js',api:['finance/accounts','finance/entries','finance/summary','finance/categories','finance/cost-centers','finance/dashboard','finance/dre','finance/cashflow','finance/statements','finance/reconciliation','finance/recurrences'],ui:['finance-account','finance-entry','finance-settle','finance-recurrence','finance-ofx']},
 {name:'reports',router:'reporting-router.js',api:['reports/sales','reports/purchases','reports/inventory'],ui:['report-grid']}
];
let failures=[];let rows=[];
for(const g of groups){const router=fs.readFileSync(path.join(routerDir,g.router),'utf8');for(const token of g.api){const route=token.includes('/')?'/api/v1/'+token:token;const backend=router.includes(route);const api=apiTests.includes(route)||apiTests.includes(token);const frontend=e2e.includes(g.ui[0])||g.ui.some(x=>e2e.includes(x));const user=g.ui.some(x=>e2e.includes(x));rows.push({feature:token,backend,api,frontend,user});if(!backend||!api||!frontend||!user)failures.push(token);}}
const out=['# ERP vertical coverage','', '| Feature | Backend | API test | Frontend/E2E | User path |','|---|---:|---:|---:|---:|',...rows.map(r=>`| ${r.feature} | ${r.backend?'yes':'NO'} | ${r.api?'yes':'NO'} | ${r.frontend?'yes':'NO'} | ${r.user?'yes':'NO'} |`),'',`Covered checks: ${rows.length-failures.length}/${rows.length}`].join('\n');
fs.mkdirSync(path.join(ROOT,'qa','reports'),{recursive:true});fs.writeFileSync(path.join(ROOT,'qa','reports','vertical-coverage.md'),out);
if(failures.length){console.error(out);console.error('\nMissing vertical coverage:',failures.join(', '));process.exit(1);}console.log(out);
