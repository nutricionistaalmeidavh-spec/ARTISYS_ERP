'use strict';
const fs=require('node:fs');const path=require('node:path');
const {openDatabase}=require('./database/sqlite-database');const {runErpMigrations}=require('./database/migrations');const {createAuthService}=require('./auth/auth-service');const {createSettingsService}=require('./settings/settings-service');
function createErpRuntime({dbPath=':memory:',now=()=>new Date().toISOString(),idFactory}={}){if(dbPath!==':memory:'){fs.mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});}const db=openDatabase(dbPath);runErpMigrations(db,now);const common={db,now};if(idFactory)common.idFactory=idFactory;const auth=createAuthService(common);const settings=createSettingsService({db,now});let closed=false;return{db,auth,settings,close(){if(closed)return;closed=true;db.close();}};}
module.exports={createErpRuntime};
