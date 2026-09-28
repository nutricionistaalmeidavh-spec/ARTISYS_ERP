'use strict';
module.exports={id:'172-fiscal-company-key-cleanup',up(db){db.exec(`
DROP INDEX IF EXISTS idx_fiscal_profiles_legacy_id_compat;
DROP INDEX IF EXISTS idx_product_fiscal_legacy_product_compat;
`);}};
