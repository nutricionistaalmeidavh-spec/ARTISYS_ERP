'use strict';
function createPricingHistoryService({db}={}){
 if(!db)throw new TypeError('Database is required.');
 function listPriceHistory({productId=null,supplierId=null,quotationId=null}={}){const c=[],p=[];if(productId){c.push('product_id=?');p.push(String(productId));}if(supplierId){c.push('supplier_id=?');p.push(String(supplierId));}if(quotationId){c.push('quotation_id=?');p.push(String(quotationId));}return db.prepare(`SELECT * FROM supplier_price_history${c.length?` WHERE ${c.join(' AND ')}`:''} ORDER BY quoted_at DESC,id DESC`).all(...p).map(r=>({id:r.id,productId:r.product_id,supplierId:r.supplier_id,quotationId:r.quotation_id,unitCostCents:Number(r.unit_cost_cents),freightCents:Number(r.freight_cents),paymentDays:Number(r.payment_days),deliveryDays:Number(r.delivery_days),quotedAt:r.quoted_at}));}
 return{listPriceHistory};
}
module.exports={createPricingHistoryService};
