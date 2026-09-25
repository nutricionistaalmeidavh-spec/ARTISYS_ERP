'use strict';
const {json}=require('../http-utils');const {pathMatch,requireActor,body,asHttpError}=require('../router-utils');
function createProcurementRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){return async function(req,res,url){if(!url.pathname.startsWith('/api/v1/procurement/'))return false;try{const actor=requireActor(req,sessions);const mutate=()=>requireActor(req,sessions,['admin','manager']);let m;
  if(url.pathname==='/api/v1/procurement/requisitions'){
    if(req.method==='GET'){json(res,200,runtime.procurementRequisitions.listRequisitions({status:url.searchParams.get('status')}));return true;}
    if(req.method==='POST'){mutate();json(res,201,runtime.procurementRequisitions.createRequisition(await body(req,bodyLimitBytes),actor));return true;}
  }
  if((m=pathMatch(url.pathname,'/api/v1/procurement/requisitions/:id'))){
    if(req.method==='GET'){const row=runtime.procurementRequisitions.getRequisition(m.id);if(!row)throw new Error('Solicitacao de compra nao encontrada.');json(res,200,row);return true;}
    if(req.method==='PATCH'){mutate();json(res,200,runtime.procurementRequisitions.updateRequisition(m.id,await body(req,bodyLimitBytes),actor));return true;}
  }
  if((m=pathMatch(url.pathname,'/api/v1/procurement/requisitions/:id/quote'))&&req.method==='POST'){mutate();json(res,200,runtime.procurementRequisitions.submitForQuotation(m.id,actor));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/requisitions/:id/cancel'))&&req.method==='POST'){mutate();json(res,200,runtime.procurementRequisitions.cancelRequisition(m.id,await body(req,bodyLimitBytes),actor));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/requisitions/:id/suggestion'))&&req.method==='GET'){json(res,200,runtime.procurementScoring.suggest(m.id));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/requisitions/:id/award'))&&req.method==='POST'){mutate();json(res,201,runtime.procurementAwards.createAwardFromSuggestion(m.id,actor));return true;}

  if(url.pathname==='/api/v1/procurement/quotations'){
    if(req.method==='GET'){json(res,200,runtime.procurementQuotations.listQuotations({requisitionId:url.searchParams.get('requisitionId'),supplierId:url.searchParams.get('supplierId'),status:url.searchParams.get('status')}));return true;}
    if(req.method==='POST'){mutate();json(res,201,runtime.procurementQuotations.createQuotation(await body(req,bodyLimitBytes),actor));return true;}
  }
  if((m=pathMatch(url.pathname,'/api/v1/procurement/quotations/:id'))){
    if(req.method==='GET'){const row=runtime.procurementQuotations.getQuotation(m.id);if(!row)throw new Error('Cotacao nao encontrada.');json(res,200,row);return true;}
    if(req.method==='PATCH'){mutate();json(res,200,runtime.procurementQuotations.updateQuotation(m.id,await body(req,bodyLimitBytes),actor));return true;}
  }
  if((m=pathMatch(url.pathname,'/api/v1/procurement/quotations/:id/submit'))&&req.method==='POST'){mutate();json(res,200,runtime.procurementQuotations.submitQuotation(m.id,actor));return true;}
  if(url.pathname==='/api/v1/procurement/price-history'&&req.method==='GET'){json(res,200,runtime.procurementPricing.listPriceHistory({productId:url.searchParams.get('productId'),supplierId:url.searchParams.get('supplierId'),quotationId:url.searchParams.get('quotationId')}));return true;}

  if(url.pathname==='/api/v1/procurement/awards'&&req.method==='GET'){json(res,200,runtime.procurementAwards.listAwards({requisitionId:url.searchParams.get('requisitionId'),status:url.searchParams.get('status')}));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/awards/:id'))){
    if(req.method==='GET'){const row=runtime.procurementAwards.getAward(m.id);if(!row)throw new Error('Adjudicacao nao encontrada.');json(res,200,row);return true;}
    if(req.method==='PATCH'){mutate();json(res,200,runtime.procurementAwards.updateAward(m.id,await body(req,bodyLimitBytes),actor));return true;}
  }
  if((m=pathMatch(url.pathname,'/api/v1/procurement/awards/:id/submit-approval'))&&req.method==='POST'){mutate();json(res,201,runtime.procurementApprovals.submitAwardForApproval(m.id,actor));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/awards/:id/generate-orders'))&&req.method==='POST'){mutate();json(res,201,runtime.procurementAwards.generateOrders(m.id,actor));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/approvals/:id'))&&req.method==='GET'){const row=runtime.procurementApprovals.getApproval(m.id);if(!row)throw new Error('Aprovacao nao encontrada.');json(res,200,row);return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/approvals/:id/approve'))&&req.method==='POST'){const input=await body(req,bodyLimitBytes);json(res,200,runtime.procurementApprovals.approveLevel(m.id,input,actor));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/approvals/:id/reject'))&&req.method==='POST'){const input=await body(req,bodyLimitBytes);json(res,200,runtime.procurementApprovals.rejectApproval(m.id,input,actor));return true;}

  if(url.pathname==='/api/v1/procurement/orders'){
    if(req.method==='GET'){json(res,200,runtime.procurement.listPurchaseOrders({status:url.searchParams.get('status'),supplierId:url.searchParams.get('supplierId'),locationId:url.searchParams.get('locationId')}));return true;}
    if(req.method==='POST'){mutate();json(res,201,runtime.procurement.createPurchaseOrder(await body(req,bodyLimitBytes),actor));return true;}
  }
  if(url.pathname==='/api/v1/procurement/receipts'&&req.method==='GET'){json(res,200,runtime.procurement.listReceipts({purchaseOrderId:url.searchParams.get('purchaseOrderId')}));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/orders/:id'))&&req.method==='GET'){const row=runtime.procurement.getPurchaseOrder(m.id);if(!row)throw new Error('Pedido de compra nao encontrado.');json(res,200,row);return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/orders/:id/submit'))&&req.method==='POST'){mutate();json(res,200,runtime.procurement.submitPurchaseOrder(m.id,actor));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/orders/:id/receive'))&&req.method==='POST'){mutate();json(res,201,runtime.procurement.receivePurchaseOrder(m.id,await body(req,bodyLimitBytes),actor));return true;}
  if((m=pathMatch(url.pathname,'/api/v1/procurement/receipts/:id/return'))&&req.method==='POST'){mutate();json(res,201,runtime.procurementReturns.createReturn(m.id,await body(req,bodyLimitBytes),actor));return true;}
  if(url.pathname==='/api/v1/procurement/returns'&&req.method==='GET'){json(res,200,runtime.procurementReturns.listReturns({receiptId:url.searchParams.get('receiptId'),supplierId:url.searchParams.get('supplierId')}));return true;}
  if(url.pathname==='/api/v1/procurement/supplier-credits'&&req.method==='GET'){json(res,200,runtime.supplierCredits.listSupplierCredits({supplierId:url.searchParams.get('supplierId'),status:url.searchParams.get('status')}));return true;}
  return false;
}catch(error){throw asHttpError(error);}};}
module.exports={createProcurementRouter};
