'use strict';

function companyId(actor){return String(actor?.companyId||'default');}
function ownerRow(db,table,id){return db.prepare(`SELECT company_id FROM ${table} WHERE id=?`).get(String(id));}
function assertOwner(db,table,id,actor,label){const row=ownerRow(db,table,id);if(!row)throw new Error(`${label} nao encontrado.`);if(actor?.companyId&&String(row.company_id)!==companyId(actor))throw new Error(`${label} pertence a outra empresa.`);return row;}
function decorate(db,table,value){if(!value)return null;const row=ownerRow(db,table,value.id);return row?{...value,companyId:String(row.company_id)}:value;}

function extendSalesAdminCompanyOwnership({db,salesAdmin}={}){
 if(!db||!salesAdmin)throw new TypeError('sales admin ownership dependencies are required.');
 function getOrder(id,actor=null){const row=ownerRow(db,'sales_admin_orders',id);if(!row||(actor?.companyId&&String(row.company_id)!==companyId(actor)))return null;return decorate(db,'sales_admin_orders',salesAdmin.getOrder(id));}
 function getInvoice(id,actor=null){const row=ownerRow(db,'sales_admin_invoices',id);if(!row||(actor?.companyId&&String(row.company_id)!==companyId(actor)))return null;return decorate(db,'sales_admin_invoices',salesAdmin.getInvoice(id));}
 function createQuote(input={},actor=null){const value=salesAdmin.createQuote(input,actor);db.prepare('UPDATE sales_admin_orders SET company_id=? WHERE id=?').run(companyId(actor),value.id);return getOrder(value.id,actor);}
 function updateQuote(id,input={},actor=null){assertOwner(db,'sales_admin_orders',id,actor,'Pedido administrativo');return decorate(db,'sales_admin_orders',salesAdmin.updateQuote(id,input,actor));}
 function confirmOrder(id,actor=null){assertOwner(db,'sales_admin_orders',id,actor,'Pedido administrativo');return decorate(db,'sales_admin_orders',salesAdmin.confirmOrder(id,actor));}
 function cancelOrder(id,input={},actor=null){assertOwner(db,'sales_admin_orders',id,actor,'Pedido administrativo');return decorate(db,'sales_admin_orders',salesAdmin.cancelOrder(id,input,actor));}
 function invoiceOrder(id,input={},actor=null){const owner=assertOwner(db,'sales_admin_orders',id,actor,'Pedido administrativo');const existing=input.idempotencyKey?db.prepare('SELECT id,company_id FROM sales_admin_invoices WHERE idempotency_key=?').get(String(input.idempotencyKey)):null;if(existing&&String(existing.company_id)!==String(owner.company_id))throw new Error('Chave de faturamento pertence a outra empresa.');const value=salesAdmin.invoiceOrder(id,input,actor);db.prepare('UPDATE sales_admin_invoices SET company_id=? WHERE id=?').run(String(owner.company_id),value.id);return getInvoice(value.id,actor);}
 function getOrderHistory(id,actor=null){assertOwner(db,'sales_admin_orders',id,actor,'Pedido administrativo');return salesAdmin.getOrderHistory(id);}
 function listOrders(filters={},actor=null){return salesAdmin.listOrders(filters).map(x=>decorate(db,'sales_admin_orders',x)).filter(x=>!actor?.companyId||x.companyId===companyId(actor));}
 function listInvoices(filters={},actor=null){return salesAdmin.listInvoices(filters).map(x=>decorate(db,'sales_admin_invoices',x)).filter(x=>!actor?.companyId||x.companyId===companyId(actor));}
 return{...salesAdmin,createQuote,updateQuote,confirmOrder,cancelOrder,invoiceOrder,getOrder,getInvoice,getOrderHistory,listOrders,listInvoices};
}

function extendProcurementCompanyOwnership({db,procurement}={}){
 if(!db||!procurement)throw new TypeError('procurement ownership dependencies are required.');
 function getPurchaseOrder(id,actor=null){const row=ownerRow(db,'purchase_orders',id);if(!row||(actor?.companyId&&String(row.company_id)!==companyId(actor)))return null;return decorate(db,'purchase_orders',procurement.getPurchaseOrder(id));}
 function createPurchaseOrder(input={},actor=null){const value=procurement.createPurchaseOrder(input,actor);db.prepare('UPDATE purchase_orders SET company_id=? WHERE id=?').run(companyId(actor),value.id);return getPurchaseOrder(value.id,actor);}
 function submitPurchaseOrder(id,actor=null){assertOwner(db,'purchase_orders',id,actor,'Pedido de compra');return decorate(db,'purchase_orders',procurement.submitPurchaseOrder(id,actor));}
 function receivePurchaseOrder(id,input={},actor=null){const owner=assertOwner(db,'purchase_orders',id,actor,'Pedido de compra');const existing=input.idempotencyKey?db.prepare('SELECT id,company_id FROM purchase_receipts WHERE idempotency_key=?').get(String(input.idempotencyKey)):null;if(existing&&String(existing.company_id)!==String(owner.company_id))throw new Error('Chave de recebimento pertence a outra empresa.');const value=procurement.receivePurchaseOrder(id,input,actor);db.prepare('UPDATE purchase_receipts SET company_id=? WHERE id=?').run(String(owner.company_id),value.id);const row=ownerRow(db,'purchase_receipts',value.id);return{...value,companyId:String(row?.company_id||owner.company_id)};}
 function listPurchaseOrders(filters={},actor=null){return procurement.listPurchaseOrders(filters).map(x=>decorate(db,'purchase_orders',x)).filter(x=>!actor?.companyId||x.companyId===companyId(actor));}
 function listReceipts(filters={},actor=null){return procurement.listReceipts(filters).map(x=>decorate(db,'purchase_receipts',x)).filter(x=>!actor?.companyId||x.companyId===companyId(actor));}
 return{...procurement,createPurchaseOrder,submitPurchaseOrder,receivePurchaseOrder,getPurchaseOrder,listPurchaseOrders,listReceipts};
}

module.exports={extendSalesAdminCompanyOwnership,extendProcurementCompanyOwnership};
