'use strict';
const {json}=require('../http-utils');const {pathMatch,requireActor,body,asHttpError}=require('../router-utils');
function createRetailRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){return async function(req,res,url){const p=url.pathname;if(!p.startsWith('/api/v1/retail/')&&!p.startsWith('/api/v1/imports/'))return false;try{const actor=requireActor(req,sessions),data=()=>body(req,bodyLimitBytes);let m;
 if(p==='/api/v1/retail/products/find'&&req.method==='GET'){json(res,200,runtime.retail.findProduct(url.searchParams.get('code')));return true;}
 if((m=pathMatch(p,'/api/v1/retail/products/:id'))&&req.method==='PATCH'){json(res,200,runtime.retail.setProductRetail(m.id,await data(),actor));return true;}
 if((m=pathMatch(p,'/api/v1/retail/products/:id/boms'))&&req.method==='POST'){json(res,201,runtime.retail.createBom(m.id,await data(),actor));return true;}
 if((m=pathMatch(p,'/api/v1/retail/products/:id/bom'))&&req.method==='GET'){json(res,200,runtime.retail.activeBom(m.id));return true;}
 if(p==='/api/v1/retail/cash-sessions'&&req.method==='POST'){json(res,201,runtime.retail.openCash(await data(),actor));return true;}
 if((m=pathMatch(p,'/api/v1/retail/cash-sessions/:id'))&&req.method==='GET'){json(res,200,runtime.retail.getCash(m.id));return true;}
 if((m=pathMatch(p,'/api/v1/retail/cash-sessions/:id/movements'))&&req.method==='POST'){json(res,201,runtime.retail.cashMovement(m.id,await data(),actor));return true;}
 if((m=pathMatch(p,'/api/v1/retail/cash-sessions/:id/close'))&&req.method==='POST'){json(res,200,runtime.retail.closeCash(m.id,await data(),actor));return true;}
 if(p==='/api/v1/retail/sales'&&req.method==='POST'){json(res,201,runtime.retail.createSale(await data(),actor));return true;}
 if((m=pathMatch(p,'/api/v1/retail/sales/:id'))&&req.method==='GET'){json(res,200,runtime.retail.getSale(m.id));return true;}
 if((m=pathMatch(p,'/api/v1/retail/sales/:id/returns'))&&req.method==='POST'){json(res,201,runtime.retail.returnSale(m.id,await data(),actor));return true;}
 if((m=pathMatch(p,'/api/v1/retail/admin-invoices/:id/returns'))&&req.method==='POST'){json(res,201,runtime.retail.returnAdminInvoice(m.id,await data(),actor));return true;}
 if(p==='/api/v1/retail/transfers'){if(req.method==='GET'){json(res,200,runtime.retail.listTransfers({status:url.searchParams.get('status')}));return true;}if(req.method==='POST'){json(res,201,runtime.retail.requestTransfer(await data(),actor));return true;}}
 if((m=pathMatch(p,'/api/v1/retail/transfers/:id/:action'))&&req.method==='POST'){json(res,200,runtime.retail.transitionTransfer(m.id,m.action,actor));return true;}
 if(p==='/api/v1/imports/preview'&&req.method==='POST'){json(res,200,runtime.retail.previewImport(await data()));return true;}
 if(p==='/api/v1/imports/run'&&req.method==='POST'){json(res,201,runtime.retail.runImport(await data(),actor));return true;}
 return false;}catch(error){throw asHttpError(error);}};}
module.exports={createRetailRouter};