'use strict';
const {withTransaction}=require('./sqlite-database');
function runMigrations(db,migrations,now=()=>new Date().toISOString()){if(!db||typeof db.exec!=='function')throw new TypeError('db is required.');db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');for(const migration of migrations){if(db.prepare('SELECT 1 FROM schema_migrations WHERE id=?').get(migration.id))continue;withTransaction(db,()=>{migration.up(db);db.prepare('INSERT INTO schema_migrations(id,applied_at) VALUES(?,?)').run(migration.id,String(now()));});}}
module.exports={runMigrations};
