'use strict';
const {withTransaction:defaultWithTransaction}=require('../../core/database/sqlite-database');

function allocateNetRevenue(items,totalCents){
 const rows=(Array.isArray(items)?items:[]).map(x=>({...x,grossCents:Number(x.grossCents||0)}));
 const total=Number(totalCents||0),gross=rows.reduce((s,x)=>s+x.grossCents,0);
 if(!rows.length)return[];
 if(gross<=0){const out=rows.map(x=>({...x,revenueCents:0}));out[out.length-1].revenueCents=total;return out;}
 let assigned=0;
 return rows.map((row,index)=>{const revenue=index===rows.length-1?total-assigned:Math.round(total*row.grossCents/gross);assigned+=revenue;return{...row,revenueCents:revenue};});
}

function extendRetailWithTraceability({db,retail,catalog,costLedger,commercialFacts,withTransaction=defaultWithTransaction}={}){
 if(!retail)return retail;
 function createSale(input={},actor=null){
  return withTransaction(db,()=>{
   const sale=retail.createSale(input,actor),cash=retail.getCash?.(sale.sessionId),locationId=cash?.locationId||input.locationId||'MAIN';
   const revenueRows=allocateNetRevenue(sale.items.map(item=>({id:item.id,grossCents:Number(item.totalCents)})),Number(sale.totalCents));
   for(let i=0;i<sale.items.length;i++){
    const item=sale.items[i],product=catalog?.getProduct?.(item.productId)||{},tracked=Boolean(product.trackStock),allocation=tracked&&costLedger?costLedger.allocateOutflow({productId:item.productId,locationId,quantity:item.quantity,destinationType:'POS_SALE',destinationId:sale.id,destinationItemId:item.id,idempotencyKey:`pos-sale:${sale.id}:${item.id}`},actor):null,realizedCostCents=allocation?allocation.totalCostCents:0;
    if(commercialFacts)commercialFacts.recordSaleFact({sourceType:'POS_SALE',sourceId:sale.id,sourceItemId:item.id,productId:item.productId,customerId:sale.customerId||null,quantity:item.quantity,revenueCents:revenueRows[i].revenueCents,realizedCostCents,financialEntryId:sale.receivableEntryId||null,occurredAt:sale.createdAt,idempotencyKey:`commercial:pos:${sale.id}:${item.id}`},actor);
   }
   return sale;
  });
 }
 return{...retail,createSale};
}
module.exports={allocateNetRevenue,extendRetailWithTraceability};
