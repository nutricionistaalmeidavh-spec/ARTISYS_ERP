'use strict';
const {runMigrations}=require('../migration-runner');const migrations=[require('./001-core'),require('./010-finance')];function runErpMigrations(db,now){return runMigrations(db,migrations,now);}module.exports={migrations,runErpMigrations};
