'use strict';
const {randomUUID}=require('node:crypto');
const {withTransaction}=require('../../core/database/sqlite-database');
const {writeAudit}=require('../../core/audit/audit-log');
const {assertRole}=require('../../core/auth/rbac');

const req=(v,n)=>{const s=String(v??'').trim();if(!s)throw new Error(n+' obrigatorio.');return s;};
const digits=(v,n,l,opt=false)=>{const s=String(v??'').replace(/\D/g,'');if(!s&&opt)return null;if(s.length!==n)throw new Error(l+' deve possuir '+n+' digitos.');return s;};
const SOURCE_TYPES=new Set(['POS_SALE','ADMIN_INVOICE','SERVICE_ORDER_SERVICE','SERVICE_ORDER_PARTS','POS_RETURN','ADMIN_RETURN','PURCHASE_RECEIPT','PURCHASE_RETURN','INVENTORY_TRANSFER']);
const DOCUMENT_TYPES=new Set(['nfce','nfe','nfse']);
const DIRECTIONS=new Set(['INBOUND','OUTBOUND']);
const OPERATION_KINDS=new Set(['ISSUE','RETURN','TRANSFER','INBOUND_LINK']);

function createFiscalService({db,catalog,retail,salesAdmin,now=()=>new Date().toISOString(),idFactory=p=>p+'-'+randomUUID()}={}){
 if(!db)throw new TypeError('db is required.');
 const manage=a=>assertRole(a,['admin','manager']);
 const companyOf=scope=>typeof scope==='string'?String(scope||'default'):String(scope?.companyId||'default');
 const event=(docId,type,status,meta={})=>db.prepare('INSERT INTO fiscal_document_events(id,fiscal_document_id,event_type,status,metadata_json,created_at) VALUES(?,?,?,?,?,?)').run(idFactory('fev'),docId,type,status,JSON.stringify(meta),String(now()));
 const parseJson=(value,fallback={})=>{try{return JSON.parse(value||JSON.stringify(fallback));}catch{return fallback;}};

 function settings(scope=null){
  const companyId=companyOf(scope),r=db.prepare('SELECT * FROM fiscal_company_settings WHERE company_id=?').get(companyId);
  return r&&{companyId:r.company_id,provider:r.provider,environment:r.environment,cnpj:r.cnpj,stateRegistration:r.state_registration,legalName:r.legal_name,tradeName:r.trade_name,crt:r.crt,seriesNfce:r.series_nfce,seriesNfe:r.series_nfe,seriesNfse:r.series_nfse||'1',operationNature:r.operation_nature,address:parseJson(r.address_json,{})};
 }
 function saveSettings(i={},a=null){
  manage(a);const companyId=companyOf(a),provider=String(i.provider||'acbr-local'),environment=String(i.environment||'homologation');
  if(!['acbr-local','focus'].includes(provider)||!['homologation','production'].includes(environment))throw new Error('Configuracao fiscal invalida.');
  const cnpj=String(i.cnpj||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(cnpj.length!==14)throw new Error('CNPJ deve possuir 14 caracteres.');
  const ts=String(now());
  db.prepare(`INSERT INTO fiscal_company_settings(id,company_id,provider,environment,cnpj,state_registration,legal_name,trade_name,crt,series_nfce,series_nfe,series_nfse,operation_nature,address_json,updated_at)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(company_id) DO UPDATE SET provider=excluded.provider,environment=excluded.environment,cnpj=excluded.cnpj,state_registration=excluded.state_registration,legal_name=excluded.legal_name,trade_name=excluded.trade_name,crt=excluded.crt,series_nfce=excluded.series_nfce,series_nfe=excluded.series_nfe,series_nfse=excluded.series_nfse,operation_nature=excluded.operation_nature,address_json=excluded.address_json,updated_at=excluded.updated_at`)
   .run(companyId,companyId,provider,environment,cnpj,req(i.stateRegistration,'Inscricao estadual'),req(i.legalName,'Razao social'),i.tradeName||null,req(i.crt,'CRT'),req(i.seriesNfce||'1','Serie NFC-e'),req(i.seriesNfe||'1','Serie NF-e'),req(i.seriesNfse||'1','Serie NFS-e'),req(i.operationNature||'VENDA','Natureza'),JSON.stringify(i.address||{}),ts);
  return settings(a);
 }

 function profile(r){return r&&{companyId:r.company_id,id:r.id,name:r.name,ncm:r.ncm,cest:r.cest,cfop:r.cfop,origin:r.origin,csosn:r.csosn,icmsCst:r.icms_cst,pisCst:r.pis_cst,cofinsCst:r.cofins_cst,unit:r.unit,ibsCbsCst:r.ibs_cbs_cst,cClassTrib:r.c_class_trib,active:Boolean(r.active)};}
 function saveProfile(i={},a=null){
  manage(a);const companyId=companyOf(a),cs=i.csosn?digits(i.csosn,3,'CSOSN'):null,ic=i.icmsCst?String(i.icmsCst):null;if(!cs&&!ic)throw new Error('CST/CSOSN obrigatorio.');
  const ib=i.ibsCbsCst?digits(i.ibsCbsCst,3,'CST IBS/CBS'):null,cl=i.cClassTrib?digits(i.cClassTrib,6,'cClassTrib'):null;if(Boolean(ib)!==Boolean(cl)||(ib&&!cl.startsWith(ib)))throw new Error('Identidade IBS/CBS invalida.');
  const id=String(i.id||idFactory('fiscal-profile')),ts=String(now());
  db.prepare(`INSERT INTO fiscal_profiles(company_id,id,name,ncm,cest,cfop,origin,csosn,icms_cst,pis_cst,cofins_cst,unit,ibs_cbs_cst,c_class_trib,active,created_at,updated_at)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(company_id,id) DO UPDATE SET name=excluded.name,ncm=excluded.ncm,cest=excluded.cest,cfop=excluded.cfop,origin=excluded.origin,csosn=excluded.csosn,icms_cst=excluded.icms_cst,pis_cst=excluded.pis_cst,cofins_cst=excluded.cofins_cst,unit=excluded.unit,ibs_cbs_cst=excluded.ibs_cbs_cst,c_class_trib=excluded.c_class_trib,active=excluded.active,updated_at=excluded.updated_at`)
   .run(companyId,id,req(i.name,'Nome'),digits(i.ncm,8,'NCM'),i.cest?digits(i.cest,7,'CEST'):null,digits(i.cfop,4,'CFOP'),req(i.origin,'Origem'),cs,ic,digits(i.pisCst,2,'CST PIS'),digits(i.cofinsCst,2,'CST COFINS'),req(i.unit,'Unidade').toUpperCase(),ib,cl,i.active===false?0:1,ts,ts);
  return profile(db.prepare('SELECT * FROM fiscal_profiles WHERE company_id=? AND id=?').get(companyId,id));
 }
 function listProfiles(scope=null){return db.prepare('SELECT * FROM fiscal_profiles WHERE company_id=? ORDER BY name,id').all(companyOf(scope)).map(profile);}
 function assignProduct(productId,i={},a=null){
  manage(a);const companyId=companyOf(a);catalog.requireActiveProduct(productId);
  if(!db.prepare('SELECT 1 FROM fiscal_profiles WHERE company_id=? AND id=? AND active=1').get(companyId,String(i.profileId)))throw new Error('Perfil fiscal nao encontrado.');
  db.prepare(`INSERT INTO product_fiscal_data(company_id,product_id,fiscal_profile_id,gtin,service_code,service_description,overrides_json,updated_at)
   VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(company_id,product_id) DO UPDATE SET fiscal_profile_id=excluded.fiscal_profile_id,gtin=excluded.gtin,service_code=excluded.service_code,service_description=excluded.service_description,overrides_json=excluded.overrides_json,updated_at=excluded.updated_at`)
   .run(companyId,String(productId),String(i.profileId),i.gtin||null,String(i.serviceCode||'').trim()||null,String(i.serviceDescription||'').trim()||null,JSON.stringify(i.overrides||{}),String(now()));
  return productFiscal(productId,a);
 }
 function productFiscal(id,scope=null){
  const companyId=companyOf(scope),r=db.prepare(`SELECT p.*,d.gtin,d.service_code,d.service_description,d.overrides_json
   FROM product_fiscal_data d JOIN fiscal_profiles p ON p.company_id=d.company_id AND p.id=d.fiscal_profile_id
   WHERE d.company_id=? AND d.product_id=?`).get(companyId,String(id));
  return r?{...profile(r),gtin:r.gtin,serviceCode:r.service_code||null,serviceDescription:r.service_description||null,overrides:parseJson(r.overrides_json,{})}:null;
 }

 function mapDocument(r){
  return r&&{id:r.id,companyId:r.company_id,sourceType:r.source_type,sourceId:r.source_id,documentType:r.document_type,direction:r.direction,operationKind:r.operation_kind,provider:r.provider,environment:r.environment,series:r.series,number:Number(r.number),status:r.status,accessKey:r.access_key,authorizationProtocol:r.authorization_protocol,sefazCode:r.sefaz_code,sefazMessage:r.sefaz_message,attemptCount:Number(r.attempt_count),snapshot:parseJson(r.snapshot_json,{}),parentDocumentId:r.parent_document_id||null,createdAt:r.created_at,updatedAt:r.updated_at};
 }
 function getDocument(id,scope=null){
  const companyId=(typeof scope==='string'||scope?.companyId)?companyOf(scope):null;
  const r=companyId?db.prepare('SELECT * FROM fiscal_documents WHERE id=? AND company_id=?').get(String(id),companyId):db.prepare('SELECT * FROM fiscal_documents WHERE id=?').get(String(id));
  return mapDocument(r);
 }
 function listDocuments(filters={},scope=null){
  if(filters&&('companyId' in filters||'role' in filters||'userId' in filters)&&scope===null){scope=filters;filters={};}
  const clauses=[],params=[],companyId=(typeof scope==='string'||scope?.companyId)?companyOf(scope):null;
  if(companyId){clauses.push('company_id=?');params.push(companyId);}if(filters.status){clauses.push('status=?');params.push(String(filters.status).toUpperCase());}if(filters.documentType){clauses.push('document_type=?');params.push(String(filters.documentType).toLowerCase());}
  return db.prepare(`SELECT * FROM fiscal_documents${clauses.length?' WHERE '+clauses.join(' AND '):''} ORDER BY created_at DESC,id DESC`).all(...params).map(mapDocument);
 }
 function documentsForSource(sourceType,sourceId,scope=null){
  const companyId=companyOf(scope);return db.prepare('SELECT * FROM fiscal_documents WHERE company_id=? AND source_type=? AND source_id=? ORDER BY created_at,id').all(companyId,String(sourceType).toUpperCase(),String(sourceId)).map(mapDocument);
 }
 function allocateNumber(companyId,documentType,environment,series){
  let seq=db.prepare('SELECT next_number FROM fiscal_sequences WHERE company_id=? AND document_type=? AND environment=? AND series=?').get(companyId,documentType,environment,series);
  if(!seq){db.prepare('INSERT INTO fiscal_sequences(company_id,document_type,environment,series,next_number,updated_at) VALUES(?,?,?,?,1,?)').run(companyId,documentType,environment,series,String(now()));seq={next_number:1};}
  const number=Number(seq.next_number);db.prepare('UPDATE fiscal_sequences SET next_number=?,updated_at=? WHERE company_id=? AND document_type=? AND environment=? AND series=?').run(number+1,String(now()),companyId,documentType,environment,series);return number;
 }
 function createPreparedDocument(i={},a=null){
  manage(a);const companyId=companyOf(a),sourceType=String(i.sourceType||'').toUpperCase(),sourceId=req(i.sourceId,'Origem'),documentType=String(i.documentType||'').toLowerCase(),direction=String(i.direction||'OUTBOUND').toUpperCase(),operationKind=String(i.operationKind||'ISSUE').toUpperCase(),key=req(i.idempotencyKey,'Chave de idempotencia');
  if(!SOURCE_TYPES.has(sourceType)||!DOCUMENT_TYPES.has(documentType)||!DIRECTIONS.has(direction)||!OPERATION_KINDS.has(operationKind))throw new Error('Contrato fiscal invalido.');
  const cfg=settings(a);if(!cfg)throw new Error('Configuracao fiscal ausente.');
  const prior=db.prepare('SELECT * FROM fiscal_documents WHERE company_id=? AND idempotency_key=?').get(companyId,key);if(prior)return mapDocument(prior);
  const same=db.prepare('SELECT * FROM fiscal_documents WHERE company_id=? AND source_type=? AND source_id=? AND document_type=? AND operation_kind=?').get(companyId,sourceType,sourceId,documentType,operationKind);if(same)return mapDocument(same);
  if(i.parentDocumentId&&!getDocument(i.parentDocumentId,a))throw new Error('Documento fiscal relacionado nao encontrado na empresa.');
  const initialStatus=String(i.initialStatus||'PENDING').toUpperCase();if(initialStatus==='AUTHORIZED'&&!(direction==='INBOUND'&&operationKind==='INBOUND_LINK'))throw new Error('Somente documento fiscal de entrada vinculado pode iniciar autorizado.');if(!['PENDING','AUTHORIZED'].includes(initialStatus))throw new Error('Status fiscal inicial invalido.');
  return withTransaction(db,()=>{
   const series=String(i.series||(documentType==='nfce'?cfg.seriesNfce:documentType==='nfse'?cfg.seriesNfse:cfg.seriesNfe));
   const environment=String(i.environment||cfg.environment),provider=String(i.provider||cfg.provider);
   const number=i.number==null?allocateNumber(companyId,documentType,environment,series):Number(i.number);if(!Number.isSafeInteger(number)||number<0)throw new Error('Numero fiscal invalido.');
   const id=String(i.id||idFactory('fiscal')),ts=String(now()),snapshot=JSON.stringify(i.snapshot||{});
   db.prepare(`INSERT INTO fiscal_documents(id,company_id,source_type,source_id,document_type,direction,operation_kind,provider,environment,series,number,status,access_key,authorization_protocol,xml_text,idempotency_key,snapshot_json,parent_document_id,created_by,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,companyId,sourceType,sourceId,documentType,direction,operationKind,provider,environment,series,number,initialStatus,i.accessKey||null,i.protocol||null,i.xml||null,key,snapshot,i.parentDocumentId||null,a?.userId||null,ts,ts);
   event(id,initialStatus==='AUTHORIZED'?'INBOUND_LINKED':'ISSUE_REQUESTED',initialStatus,{sourceType,sourceId,documentType,operationKind});
   writeAudit(db,{action:'fiscal.document.prepare',entity:'fiscal-document',entityId:id,actor:a,context:{sourceType,sourceId,documentType,direction,operationKind}},now);
   return getDocument(id,a);
  });
 }

 function source(type,id,a){
  if(type==='POS_SALE'){const owner=db.prepare('SELECT company_id FROM pos_sales WHERE id=?').get(String(id));if(!owner)throw new Error('Venda PDV nao encontrada.');if(String(owner.company_id)!==companyOf(a))throw new Error('Venda PDV pertence a outra empresa.');const x=retail.getSale(id);if(!x)throw new Error('Venda PDV nao encontrada.');return x;}
  if(type==='ADMIN_INVOICE'){const x=salesAdmin.getInvoice(id,a);if(!x)throw new Error('Fatura administrativa nao encontrada.');return x;}
  throw new Error('Origem fiscal invalida.');
 }
 function createDocument(i={},a=null){
  manage(a);const sourceType=String(i.sourceType||'').toUpperCase(),documentType=sourceType==='POS_SALE'?'nfce':sourceType==='ADMIN_INVOICE'?'nfe':null;if(!documentType)throw new Error('Origem fiscal invalida.');
  const s=source(sourceType,i.sourceId,a);if(!settings(a))throw new Error('Configuracao fiscal ausente.');for(const item of s.items||[]){if(!productFiscal(item.productId,a))throw new Error('Dados fiscais ausentes para produto '+item.productId+'.');}
  return createPreparedDocument({id:i.id,sourceType,sourceId:i.sourceId,documentType,direction:'OUTBOUND',operationKind:'ISSUE',idempotencyKey:i.idempotencyKey,snapshot:{sourceType,sourceId:String(i.sourceId),totalCents:Number(s.totalCents||0),items:(s.items||[]).map(x=>({productId:x.productId,quantity:Number(x.quantity),unitPriceCents:Number(x.unitPriceCents),totalCents:Number(x.totalCents??Math.round(Number(x.quantity)*Number(x.unitPriceCents))) }))}},a);
 }
 function transition(id,i={},a=null){
  manage(a);const d=getDocument(id,a);if(!d)throw new Error('Documento fiscal nao encontrado.');const status=String(i.status||'').toUpperCase(),allowed={PENDING:['PROCESSING','FAILED'],PROCESSING:['AUTHORIZED','REJECTED','UNKNOWN','FAILED'],UNKNOWN:['PROCESSING','FAILED'],AUTHORIZED:['CANCELLED']}[d.status]||[];if(!allowed.includes(status))throw new Error('Transicao fiscal invalida.');
  db.prepare('UPDATE fiscal_documents SET status=?,access_key=COALESCE(?,access_key),authorization_protocol=COALESCE(?,authorization_protocol),xml_text=COALESCE(?,xml_text),cancellation_protocol=COALESCE(?,cancellation_protocol),cancellation_xml_text=COALESCE(?,cancellation_xml_text),sefaz_code=?,sefaz_message=?,attempt_count=attempt_count+?,updated_at=? WHERE id=? AND company_id=?').run(status,i.accessKey||null,i.protocol||null,i.xml||null,i.cancellationProtocol||null,i.cancellationXml||null,i.sefazCode||null,i.sefazMessage||null,status==='PROCESSING'?1:0,String(now()),d.id,d.companyId);event(d.id,status,status,{sefazCode:i.sefazCode||null});return getDocument(d.id,a);
 }
 return{settings,saveSettings,saveProfile,listProfiles,assignProduct,productFiscal,createPreparedDocument,createDocument,getDocument,listDocuments,documentsForSource,transition};
}
module.exports={createFiscalService};
