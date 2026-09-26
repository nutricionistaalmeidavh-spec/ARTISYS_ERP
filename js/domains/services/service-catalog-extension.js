'use strict';
const {writeAudit}=require('../../core/audit/audit-log');
const {assertRole}=require('../../core/auth/rbac');

function extendRetailWithServiceProducts({db,catalog,retail,now=()=>new Date().toISOString()}={}){
 if(!db||!catalog||!retail)throw new TypeError('service catalog extension dependencies are required.');
 const baseSet=retail.setProductRetail.bind(retail);
 function setProductRetail(id,input={},actor=null){
  const requested=String(input.productType||'').toUpperCase();
  if(requested!=='SERVICE')return baseSet(id,input,actor);
  assertRole(actor,['admin','manager']);
  const current=catalog.requireActiveProduct(id);
  if(current.trackStock)throw new Error('Servico nao pode controlar estoque.');
  const old=retail.getProduct(id),barcode=input.barcode===undefined?old?.barcode:(String(input.barcode||'').trim()||null),attributes=input.attributes===undefined?(old?.attributes||{}):input.attributes;
  if(input.parentProductId)throw new Error('Servico nao pode possuir produto pai.');
  db.prepare("UPDATE products SET barcode=?,parent_product_id=NULL,attributes_json=?,product_type='SERVICE',updated_at=? WHERE id=?").run(barcode,JSON.stringify(attributes||{}),String(now()),current.id);
  writeAudit(db,{action:'catalog.product.retail.update',entity:'product',entityId:current.id,actor,context:{barcode,parent:null,type:'SERVICE'}},now);
  return retail.getProduct(id);
 }
 return{...retail,setProductRetail};
}
module.exports={extendRetailWithServiceProducts};
