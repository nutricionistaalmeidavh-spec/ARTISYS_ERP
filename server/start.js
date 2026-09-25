'use strict';
const path=require('node:path');const {createErpRuntime}=require('../js/core/erp-runtime');const {createLocalServer}=require('./local-server');
const host=process.env.ERP_HOST||'127.0.0.1';const port=Number(process.env.ERP_PORT||4174);const dbPath=process.env.ERP_DB_PATH||path.join(process.cwd(),'data','artisys-erp.sqlite');
const runtime=createErpRuntime({dbPath});const server=createLocalServer({runtime,host,port});server.start().then(address=>{console.log(`ArtiSys ERP local server: http://${address.host}:${address.port}`);}).catch(error=>{console.error(error);runtime.close();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.stop();runtime.close();process.exit(0);});
