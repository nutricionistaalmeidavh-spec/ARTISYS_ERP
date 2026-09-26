'use strict';
const {withTransaction}=require('../../core/database/sqlite-database');

function extendRetailFiscalRouting({db,retail}={}){
 if(!db||!retail)throw new TypeError('retail fiscal routing dependencies are required.');
 const company=actor=>String(actor?.companyId||'default');
 function row(id){return db.prepare('SELECT company_id,fiscal_required,from_branch_id,to_branch_id FROM inventory_transfer_orders WHERE id=?').get(String(id));}
 function decorate(transfer){
  if(!transfer)return null;
  const r=row(transfer.id);if(!r)return transfer;
  return{...transfer,companyId:r.company_id,fiscalRequired:Boolean(r.fiscal_required),fromBranchId:r.from_branch_id||null,toBranchId:r.to_branch_id||null};
 }
 function requireBranch(id,actor,label){
  const branch=db.prepare('SELECT id,company_id,code,name,active FROM company_branches WHERE id=?').get(String(id||''));
  if(!branch||!branch.active)throw new Error(`${label} fiscal invalida ou inativa.`);
  if(String(branch.company_id)!==company(actor))throw new Error(`${label} fiscal pertence a outra empresa.`);
  return branch;
 }
 function getTransfer(id,actor=null){
  const r=row(id);if(!r)return null;
  if(actor&&String(r.company_id)!==company(actor))return null;
  return decorate(retail.getTransfer(id));
 }
 function requestTransfer(input={},actor=null){
  const key=String(input.idempotencyKey||'').trim();
  if(key){
   const existing=db.prepare('SELECT id,company_id FROM inventory_transfer_orders WHERE idempotency_key=?').get(key);
   if(existing){if(String(existing.company_id)!==company(actor))throw new Error('Transferencia pertence a outra empresa.');return getTransfer(existing.id,actor);}
  }
  const fiscalRequired=Boolean(input.fiscalRequired);let fromBranchId=null,toBranchId=null;
  if(fiscalRequired){
   fromBranchId=String(input.fromBranchId||'').trim();toBranchId=String(input.toBranchId||'').trim();
   if(!fromBranchId||!toBranchId)throw new Error('Filiais de origem e destino sao obrigatorias na transferencia fiscal.');
   requireBranch(fromBranchId,actor,'Filial de origem');requireBranch(toBranchId,actor,'Filial de destino');
   if(fromBranchId===toBranchId)throw new Error('Filiais de origem e destino devem ser diferentes na transferencia fiscal.');
  }
  return withTransaction(db,()=>{
   const created=retail.requestTransfer(input,actor);
   db.prepare('UPDATE inventory_transfer_orders SET fiscal_required=?,from_branch_id=?,to_branch_id=? WHERE id=? AND company_id=?').run(fiscalRequired?1:0,fromBranchId,toBranchId,created.id,company(actor));
   return getTransfer(created.id,actor);
  });
 }
 function transitionTransfer(id,action,actor=null){if(!getTransfer(id,actor))throw new Error('Transferencia nao encontrada na empresa.');return decorate(retail.transitionTransfer(id,action,actor));}
 function listTransfers(filters={},actor=null){return retail.listTransfers(filters).map(decorate).filter(x=>!actor||x.companyId===company(actor));}
 return{...retail,requestTransfer,getTransfer,transitionTransfer,listTransfers};
}
module.exports={extendRetailFiscalRouting};
