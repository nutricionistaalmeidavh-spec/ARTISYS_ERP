'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('retail UI uses source-oriented fiscal actions and explicit fiscal transfer routing',()=>{const s=read('frontend/src/pages/RetailPage.tsx');assert.match(s,/tax\/sources/);assert.match(s,/POS_RETURN/);assert.match(s,/ADMIN_RETURN/);assert.match(s,/INVENTORY_TRANSFER/);assert.match(s,/fiscalRequired/);assert.match(s,/fromBranchId/);assert.match(s,/toBranchId/);});
test('service order UI exposes contextual fiscal preparation and separate service/parts trails',()=>{const s=read('frontend/src/pages/ServiceOrdersPage.tsx');assert.match(s,/service-order-fiscal-prepare/);assert.match(s,/SERVICE_ORDER/);assert.match(s,/NFS-e serviço/);assert.match(s,/NF-e peças/);});
test('procurement UI exposes inbound NF-e linking and supplier-return fiscal action',()=>{const s=read('desktop/renderer/views/compras.js');assert.match(s,/tax\/inbound\/purchase-receipts/);assert.match(s,/PURCHASE_RETURN/);assert.match(s,/Vincular NF-e/);});
test('administrative sales UI exposes fiscal status by invoice source',()=>{const s=read('desktop/renderer/views/vendas.js');assert.match(s,/ADMIN_INVOICE/);assert.match(s,/tax\/sources/);assert.match(s,/Fiscal/);});
