'use strict';
const {randomUUID}=require('node:crypto');
const {writeAudit}=require('../../core/audit/audit-log');
const {assertRole}=require('../../core/auth/rbac');
function createContactService({db,now=()=>new Date().toISOString(),idFactory=p=>`${p}-${randomUUID()}`}={}){
 if(!db)throw new TypeError('Database is required.');
 const map=row=>row&&({id:row.id,kind:row.kind,name:row.name,taxId:row.tax_id,email:row.email,phone:row.phone,active:Boolean(row.active),createdAt:row.created_at,updatedAt:row.updated_at});
 function save(kind,input={},actor=null){assertRole(actor,['admin','manager']);const id=String(input.id||idFactory(kind==='CUSTOMER'?'customer':'supplier'));const name=String(input.name||'').trim();if(!name)throw new Error('Nome do contato obrigatorio.');const ts=String(now());db.prepare(`INSERT INTO contacts(id,kind,name,tax_id,email,phone,active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)`).run(id,kind,name,input.taxId||null,input.email||null,input.phone||null,ts,ts);writeAudit(db,{action:'contacts.create',entity:'contact',entityId:id,actor,context:{kind}},now);return getContact(id);}
 function createCustomer(input,actor){return save('CUSTOMER',input,actor);}
 function createSupplier(input,actor){return save('SUPPLIER',input,actor);}
 function getContact(id){return map(db.prepare('SELECT * FROM contacts WHERE id=?').get(String(id)));}
 function requireKind(id,kind,label){const row=getContact(id);if(!row)throw new Error(`${label} nao encontrado.`);if(!row.active)throw new Error(`${label} inativo.`);if(row.kind!==kind&&row.kind!=='BOTH')throw new Error(`${label} possui tipo invalido.`);return row;}
 function requireCustomer(id){return requireKind(id,'CUSTOMER','Cliente');}
 function requireSupplier(id){return requireKind(id,'SUPPLIER','Fornecedor');}
 function list({kind=null,includeInactive=false}={}){const clauses=[],params=[];if(kind){clauses.push('(kind=? OR kind=\'BOTH\')');params.push(String(kind).toUpperCase());}if(!includeInactive)clauses.push('active=1');return db.prepare(`SELECT * FROM contacts${clauses.length?` WHERE ${clauses.join(' AND ')}`:''} ORDER BY name,id`).all(...params).map(map);}
 function setActive(id,active,actor){assertRole(actor,['admin','manager']);const result=db.prepare('UPDATE contacts SET active=?,updated_at=? WHERE id=?').run(active?1:0,String(now()),String(id));if(!result.changes)throw new Error('Contato nao encontrado.');writeAudit(db,{action:'contacts.active',entity:'contact',entityId:String(id),actor,context:{active:Boolean(active)}},now);return getContact(id);}
 return{createCustomer,createSupplier,getContact,requireCustomer,requireSupplier,list,setActive};
}
module.exports={createContactService};
