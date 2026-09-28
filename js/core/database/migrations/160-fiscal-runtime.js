'use strict';
module.exports={id:'160-fiscal-runtime',up(db){db.exec(`
ALTER TABLE contacts ADD COLUMN state_registration TEXT;
ALTER TABLE contacts ADD COLUMN fiscal_address_json TEXT NOT NULL DEFAULT '{}';
`);}};
