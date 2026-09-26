'use strict';

function extendCostLedgerWithLegacyCompatibility({db,costLedger,catalog}={}){
 if(!db||!costLedger)throw new TypeError('legacy cost ledger compatibility dependencies are required.');
 const company=(input={},actor=null)=>String(input.companyId||actor?.companyId||'default');
 function ensureLegacyBalance(input={},actor=null){
  const companyId=company(input,actor),productId=String(input.productId||''),locationId=String(input.locationId||''),required=Number(input.quantity||0);
  if(!productId||!locationId||!Number.isFinite(required)||required<=0)return null;
  const traceable=Number(db.prepare(`SELECT COALESCE(SUM(b.available_quantity),0) q FROM inventory_cost_layer_balances b JOIN inventory_cost_layers l ON l.id=b.layer_id AND l.company_id=b.company_id WHERE b.company_id=? AND l.product_id=? AND b.location_id=?`).get(companyId,productId,locationId)?.q||0);
  const missing=required-traceable;if(missing<=1e-9)return null;
  const product=catalog?.getProduct?.(productId)||db.prepare('SELECT cost_cents FROM products WHERE id=?').get(productId)||{},unitCostCents=Math.max(0,Number(product.costCents??product.cost_cents??0)||0),sourceId=`${productId}:${locationId}`;
  const sequence=Number(db.prepare("SELECT COUNT(*) n FROM inventory_cost_layers WHERE company_id=? AND source_type='legacy-unattributed' AND source_id=?").get(companyId,sourceId)?.n||0)+1;
  return costLedger.createLayer({companyId,productId,locationId,quantity:missing,unitCostCents:Math.round(unitCostCents),sourceType:'legacy-unattributed',sourceId,idempotencyKey:`legacy-unattributed:${sourceId}:${sequence}`},actor);
 }
 function allocateOutflow(input={},actor=null){if(input.allowLegacyFallback)ensureLegacyBalance(input,actor);const clean={...input};delete clean.allowLegacyFallback;return costLedger.allocateOutflow(clean,actor);}
 function transferLayerBalance(input={},actor=null){if(input.allowLegacyFallback)ensureLegacyBalance({companyId:input.companyId,productId:input.productId,locationId:input.fromLocationId,quantity:input.quantity},actor);const clean={...input};delete clean.allowLegacyFallback;return costLedger.transferLayerBalance(clean,actor);}
 return{...costLedger,ensureLegacyBalance,allocateOutflow,transferLayerBalance};
}
module.exports={extendCostLedgerWithLegacyCompatibility};
