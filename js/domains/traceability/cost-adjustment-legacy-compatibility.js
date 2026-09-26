'use strict';

function extendCostAdjustmentsWithLegacyCompatibility({costAdjustments,costLedger}={}){
 if(!costAdjustments||!costLedger)throw new TypeError('cost adjustment compatibility dependencies are required.');
 const baseMove=costAdjustments.moveBalance.bind(costAdjustments);
 function moveBalance(input={},actor=null){
  if(input.allowLegacyFallback)costLedger.ensureLegacyBalance({companyId:input.companyId,productId:input.productId,locationId:input.fromLocationId,quantity:input.quantity},actor);
  const clean={...input};delete clean.allowLegacyFallback;
  return baseMove(clean,actor);
 }
 return{...costAdjustments,moveBalance};
}
module.exports={extendCostAdjustmentsWithLegacyCompatibility};
