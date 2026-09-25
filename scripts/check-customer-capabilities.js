'use strict';
const fs=require('node:fs');
const file='release/customer-capabilities.json';
const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
if(manifest.product!=='ArtiSys ERP'||manifest.localFirst!==true||manifest.requiresPaidService!==false)throw new Error('Invalid ERP commercial capability contract.');
const forbidden=/restaurant|comanda|nfce|nf-e|balc[aã]o|gaveta|pizzaria|autoatendimento|terminal\s+pdv|self-service/i;
const text=JSON.stringify(manifest);if(forbidden.test(text))throw new Error('Capability manifest contains functionality outside the ERP product boundary.');
const ids=new Set((manifest.capabilities||[]).filter(x=>x.status==='available').map(x=>x.id));for(const id of ['master-data','inventory','procurement','sales-admin','finance','reports','backup'])if(!ids.has(id))throw new Error(`Required released capability missing: ${id}`);
console.log(`Customer capabilities: OK (${ids.size} available)`);
