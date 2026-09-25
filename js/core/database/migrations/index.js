'use strict';
const {runMigrations}=require('../migration-runner');
const migrations=[require('./001-core'),require('./010-finance'),require('./020-master-data'),require('./021-inventory'),require('./030-procurement')];
function runErpMigrations(db,now){return runMigrations(db,migrations,now);}
module.exports={migrations,runErpMigrations};
