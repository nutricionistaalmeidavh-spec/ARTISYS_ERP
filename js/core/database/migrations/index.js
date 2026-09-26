'use strict';
const {runMigrations}=require('../migration-runner');
const migrations=[require('./001-core'),require('./010-finance'),require('./020-master-data'),require('./021-inventory'),require('./030-procurement'),require('./040-sales-admin'),require('./050-finance-automation'),require('./060-eventbus'),require('./070-inventory-operations'),require('./075-auth-director'),require('./080-procurement-advanced'),require('./090-sales-admin-history'),require('./100-inventory-depth')];
function runErpMigrations(db,now){return runMigrations(db,migrations,now);}
module.exports={migrations,runErpMigrations};
