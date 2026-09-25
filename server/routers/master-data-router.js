'use strict';
const {json,HttpError}=require('../http-utils');
const {pathMatch,requireActor,queryBool,pagination,paginate,body,asHttpError}=require('../router-utils');
function createMasterDataRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){
 return async function(req,res,url){
  const p=url.pathname;
  if(!['/api/v1/customers','/api/v1/suppliers','/api/v1/product-categories','/api/v1/products'].some(base=>p===base||p.startsWith(`${base}/`)))return false;
  try{
   const actor=requireActor(req,sessions),page=pagination(url),query=url.searchParams.get('query');
   if(p==='/api/v1/customers'){
    if(req.method==='GET'){json(res,200,paginate(runtime.contacts.list({kind:'CUSTOMER',includeInactive:queryBool(url,'includeInactive'),query}),page));return true;}
    if(req.method==='POST'){requireActor(req,sessions,['admin','manager']);json(res,201,runtime.contacts.createCustomer(await body(req,bodyLimitBytes),actor));return true;}
   }
   if(p==='/api/v1/suppliers'){
    if(req.method==='GET'){json(res,200,paginate(runtime.contacts.list({kind:'SUPPLIER',includeInactive:queryBool(url,'includeInactive'),query}),page));return true;}
    if(req.method==='POST'){requireActor(req,sessions,['admin','manager']);json(res,201,runtime.contacts.createSupplier(await body(req,bodyLimitBytes),actor));return true;}
   }
   if(p==='/api/v1/product-categories'){
    if(req.method==='GET'){json(res,200,paginate(runtime.catalog.listCategories({includeInactive:queryBool(url,'includeInactive'),query}),page));return true;}
    if(req.method==='POST'){requireActor(req,sessions,['admin','manager']);json(res,201,runtime.catalog.createCategory(await body(req,bodyLimitBytes),actor));return true;}
   }
   if(p==='/api/v1/products'){
    if(req.method==='GET'){json(res,200,paginate(runtime.catalog.listProducts({includeInactive:queryBool(url,'includeInactive'),query}),page));return true;}
    if(req.method==='POST'){requireActor(req,sessions,['admin','manager']);json(res,201,runtime.catalog.createProduct(await body(req,bodyLimitBytes),actor));return true;}
   }
   let m;
   const contactItem=(base,kind,label)=>{
    const match=pathMatch(p,`${base}/:id`);if(!match)return null;const record=runtime.contacts.getContact(match.id);if(!record||![kind,'BOTH'].includes(record.kind))throw new HttpError(404,`${label} nao encontrado.`);return{match,record};
   };
   let item=contactItem('/api/v1/customers','CUSTOMER','Cliente');
   if(item){if(req.method==='GET'){json(res,200,item.record);return true;}if(req.method==='PATCH'){requireActor(req,sessions,['admin','manager']);json(res,200,runtime.contacts.updateContact(item.match.id,await body(req,bodyLimitBytes),actor));return true;}}
   item=contactItem('/api/v1/suppliers','SUPPLIER','Fornecedor');
   if(item){if(req.method==='GET'){json(res,200,item.record);return true;}if(req.method==='PATCH'){requireActor(req,sessions,['admin','manager']);json(res,200,runtime.contacts.updateContact(item.match.id,await body(req,bodyLimitBytes),actor));return true;}}
   for(const cfg of [
    ['/api/v1/customers','CUSTOMER','Cliente'],['/api/v1/suppliers','SUPPLIER','Fornecedor']
   ])for(const [action,active] of [['deactivate',false],['reactivate',true]])if((m=pathMatch(p,`${cfg[0]}/:id/${action}`))&&req.method==='POST'){requireActor(req,sessions,['admin','manager']);const record=runtime.contacts.getContact(m.id);if(!record||![cfg[1],'BOTH'].includes(record.kind))throw new HttpError(404,`${cfg[2]} nao encontrado.`);json(res,200,runtime.contacts.setActive(m.id,active,actor));return true;}
   if((m=pathMatch(p,'/api/v1/product-categories/:id'))){const record=runtime.catalog.getCategory(m.id);if(!record)throw new HttpError(404,'Categoria de produto nao encontrada.');if(req.method==='GET'){json(res,200,record);return true;}if(req.method==='PATCH'){requireActor(req,sessions,['admin','manager']);json(res,200,runtime.catalog.updateCategory(m.id,await body(req,bodyLimitBytes),actor));return true;}}
   for(const [action,active] of [['deactivate',false],['reactivate',true]])if((m=pathMatch(p,`/api/v1/product-categories/:id/${action}`))&&req.method==='POST'){requireActor(req,sessions,['admin','manager']);if(!runtime.catalog.getCategory(m.id))throw new HttpError(404,'Categoria de produto nao encontrada.');json(res,200,runtime.catalog.setCategoryActive(m.id,active,actor));return true;}
   if((m=pathMatch(p,'/api/v1/products/:id'))){const record=runtime.catalog.getProduct(m.id);if(!record)throw new HttpError(404,'Produto nao encontrado.');if(req.method==='GET'){json(res,200,record);return true;}if(req.method==='PATCH'){requireActor(req,sessions,['admin','manager']);json(res,200,runtime.catalog.updateProduct(m.id,await body(req,bodyLimitBytes),actor));return true;}}
   for(const [action,active] of [['deactivate',false],['reactivate',true]])if((m=pathMatch(p,`/api/v1/products/:id/${action}`))&&req.method==='POST'){requireActor(req,sessions,['admin','manager']);if(!runtime.catalog.getProduct(m.id))throw new HttpError(404,'Produto nao encontrado.');json(res,200,runtime.catalog.setProductActive(m.id,active,actor));return true;}
   return false;
  }catch(error){throw asHttpError(error);}
 };
}
module.exports={createMasterDataRouter};
