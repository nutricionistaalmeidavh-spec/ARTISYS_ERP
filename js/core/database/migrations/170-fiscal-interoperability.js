'use strict';
module.exports={id:'170-fiscal-interoperability',up(db){
 db.exec(`
ALTER TABLE fiscal_company_settings RENAME TO fiscal_company_settings_legacy;
CREATE TABLE fiscal_company_settings(
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL UNIQUE,
 provider TEXT NOT NULL DEFAULT 'acbr-local' CHECK(provider IN('acbr-local','focus')),
 environment TEXT NOT NULL DEFAULT 'homologation' CHECK(environment IN('homologation','production')),
 cnpj TEXT NOT NULL,state_registration TEXT NOT NULL,legal_name TEXT NOT NULL,trade_name TEXT,crt TEXT NOT NULL,
 series_nfce TEXT NOT NULL DEFAULT '1',series_nfe TEXT NOT NULL DEFAULT '1',series_nfse TEXT NOT NULL DEFAULT '1',
 operation_nature TEXT NOT NULL DEFAULT 'VENDA',address_json TEXT NOT NULL DEFAULT '{}',updated_at TEXT NOT NULL
);
INSERT INTO fiscal_company_settings(id,company_id,provider,environment,cnpj,state_registration,legal_name,trade_name,crt,series_nfce,series_nfe,series_nfse,operation_nature,address_json,updated_at)
 SELECT company_id,company_id,provider,environment,cnpj,state_registration,legal_name,trade_name,crt,series_nfce,series_nfe,'1',operation_nature,address_json,updated_at FROM fiscal_company_settings_legacy;
DROP TABLE fiscal_company_settings_legacy;

ALTER TABLE product_fiscal_data RENAME TO product_fiscal_data_legacy;
ALTER TABLE fiscal_profiles RENAME TO fiscal_profiles_legacy;
CREATE TABLE fiscal_profiles(
 company_id TEXT NOT NULL DEFAULT 'default',id TEXT NOT NULL,name TEXT NOT NULL,ncm TEXT NOT NULL,cest TEXT,cfop TEXT NOT NULL,origin TEXT NOT NULL,
 csosn TEXT,icms_cst TEXT,pis_cst TEXT NOT NULL,cofins_cst TEXT NOT NULL,unit TEXT NOT NULL,ibs_cbs_cst TEXT,c_class_trib TEXT,
 active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(company_id,id)
);
INSERT INTO fiscal_profiles(company_id,id,name,ncm,cest,cfop,origin,csosn,icms_cst,pis_cst,cofins_cst,unit,ibs_cbs_cst,c_class_trib,active,created_at,updated_at)
 SELECT 'default',id,name,ncm,cest,cfop,origin,csosn,icms_cst,pis_cst,cofins_cst,unit,ibs_cbs_cst,c_class_trib,active,created_at,updated_at FROM fiscal_profiles_legacy;
CREATE TABLE product_fiscal_data(
 company_id TEXT NOT NULL DEFAULT 'default',product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,fiscal_profile_id TEXT NOT NULL,
 gtin TEXT,service_code TEXT,service_description TEXT,overrides_json TEXT NOT NULL DEFAULT '{}',updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,product_id),FOREIGN KEY(company_id,fiscal_profile_id) REFERENCES fiscal_profiles(company_id,id)
);
INSERT INTO product_fiscal_data(company_id,product_id,fiscal_profile_id,gtin,overrides_json,updated_at)
 SELECT 'default',product_id,fiscal_profile_id,gtin,overrides_json,updated_at FROM product_fiscal_data_legacy;
DROP TABLE product_fiscal_data_legacy;
DROP TABLE fiscal_profiles_legacy;

ALTER TABLE fiscal_sequences RENAME TO fiscal_sequences_legacy;
CREATE TABLE fiscal_sequences(
 company_id TEXT NOT NULL DEFAULT 'default',document_type TEXT NOT NULL CHECK(document_type IN('nfce','nfe','nfse')),
 environment TEXT NOT NULL CHECK(environment IN('homologation','production')),series TEXT NOT NULL,next_number INTEGER NOT NULL CHECK(next_number>0),updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,document_type,environment,series)
);
INSERT INTO fiscal_sequences(company_id,document_type,environment,series,next_number,updated_at)
 SELECT 'default',document_type,environment,series,next_number,updated_at FROM fiscal_sequences_legacy;
DROP TABLE fiscal_sequences_legacy;

ALTER TABLE fiscal_document_events RENAME TO fiscal_document_events_legacy;
ALTER TABLE fiscal_documents RENAME TO fiscal_documents_legacy;
CREATE TABLE fiscal_documents(
 id TEXT PRIMARY KEY,company_id TEXT NOT NULL DEFAULT 'default',
 source_type TEXT NOT NULL CHECK(source_type IN('POS_SALE','ADMIN_INVOICE','SERVICE_ORDER_SERVICE','SERVICE_ORDER_PARTS','POS_RETURN','ADMIN_RETURN','PURCHASE_RECEIPT','PURCHASE_RETURN','INVENTORY_TRANSFER')),
 source_id TEXT NOT NULL,document_type TEXT NOT NULL CHECK(document_type IN('nfce','nfe','nfse')),
 direction TEXT NOT NULL DEFAULT 'OUTBOUND' CHECK(direction IN('INBOUND','OUTBOUND')),
 operation_kind TEXT NOT NULL DEFAULT 'ISSUE' CHECK(operation_kind IN('ISSUE','RETURN','TRANSFER','INBOUND_LINK')),
 provider TEXT NOT NULL,environment TEXT NOT NULL,series TEXT NOT NULL,number INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','PROCESSING','AUTHORIZED','REJECTED','UNKNOWN','FAILED','CANCELLED')),
 access_key TEXT,authorization_protocol TEXT,xml_text TEXT,cancellation_protocol TEXT,cancellation_xml_text TEXT,sefaz_code TEXT,sefaz_message TEXT,
 attempt_count INTEGER NOT NULL DEFAULT 0,idempotency_key TEXT NOT NULL,snapshot_json TEXT NOT NULL DEFAULT '{}',parent_document_id TEXT REFERENCES fiscal_documents(id),
 created_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(company_id,idempotency_key),UNIQUE(company_id,document_type,environment,series,number),
 UNIQUE(company_id,source_type,source_id,document_type,operation_kind)
);
INSERT INTO fiscal_documents(id,company_id,source_type,source_id,document_type,direction,operation_kind,provider,environment,series,number,status,access_key,authorization_protocol,xml_text,cancellation_protocol,cancellation_xml_text,sefaz_code,sefaz_message,attempt_count,idempotency_key,snapshot_json,parent_document_id,created_by,created_at,updated_at)
 SELECT id,company_id,source_type,source_id,document_type,'OUTBOUND','ISSUE',provider,environment,series,number,status,access_key,authorization_protocol,xml_text,cancellation_protocol,cancellation_xml_text,sefaz_code,sefaz_message,attempt_count,idempotency_key,'{}',NULL,created_by,created_at,updated_at FROM fiscal_documents_legacy;
CREATE TABLE fiscal_document_events(id TEXT PRIMARY KEY,fiscal_document_id TEXT NOT NULL REFERENCES fiscal_documents(id),event_type TEXT NOT NULL,status TEXT,metadata_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);
INSERT INTO fiscal_document_events SELECT id,fiscal_document_id,event_type,status,metadata_json,created_at FROM fiscal_document_events_legacy;
DROP TABLE fiscal_document_events_legacy;
DROP TABLE fiscal_documents_legacy;
CREATE INDEX idx_fiscal_docs_source ON fiscal_documents(company_id,source_type,source_id);
CREATE INDEX idx_fiscal_docs_status ON fiscal_documents(company_id,status,created_at);
`);
}};
