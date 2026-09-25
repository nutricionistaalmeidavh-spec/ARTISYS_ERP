'use strict';
const {runMigrations}=require('../migration-runner');
const core=require('./001-core');
const migrations=[core];
function runErpMigrations(db,now){return runMigrations(db,migrations,now);}
module.exports={migrations,runErpMigrations};
