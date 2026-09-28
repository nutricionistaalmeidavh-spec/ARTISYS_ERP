'use strict';
const {withTransaction}=require('../../core/database/sqlite-database');

function extendProcurementReturnsWithTraceability({db,procurementReturns,costAdjustments}={}){
 if(!db||!procurementReturns||!costAdjustments)throw new TypeError('procurement return traceability dependencies are required.');
 const baseCreate=procurementReturns.createReturn.bind(procurementReturns);
 function createReturn(receiptId,input={},actor=null){return withTransaction(db,()=>{const result=baseCreate(receiptId,input,actor),receipt=db.prepare('SELECT order_id FROM purchase_receipts WHERE id=?').get(String(result.receiptId)),order=receipt&&db.prepare('SELECT location_id FROM purchase_orders WHERE id=?').get(receipt.order_id);if(!order)throw new Error('Pedido de compra da devolucao nao encontrado.');for(const item of result.items)costAdjustments.allocateAttributedOutflow({productId:item.productId,locationId:order.location_id,quantity:item.quantity,purchaseReceiptId:result.receiptId,sourceItemId:item.receiptItemId,destinationType:'PURCHASE_RETURN',destinationId:result.id,destinationItemId:item.id,idempotencyKey:`purchase-return:${result.id}:${item.id}:cost`},actor);return result;});}
 return{...procurementReturns,createReturn};
}
module.exports={extendProcurementReturnsWithTraceability};
