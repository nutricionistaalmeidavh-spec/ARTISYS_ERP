'use strict';
const fs=require('node:fs');
const path=require('node:path');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const approved={'@artisys/eventbus':'MIT','@artisys/finance-domain':'MIT','pdfjs-dist':'Apache-2.0','electron':'MIT','electron-builder':'MIT','eslint':'MIT','playwright':'Apache-2.0'};
for(const name of [...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{})])if(!approved[name])throw new Error(`Direct dependency has no reviewed license entry: ${name}`);
for(const [packageName,folder] of [['@artisys/eventbus','artisys-eventbus'],['@artisys/finance-domain','artisys-finance-domain']]){const vendorPath=path.join('vendor',folder,'package.json');if(!fs.existsSync(vendorPath))throw new Error(`${packageName} vendor package missing.`);const vendor=JSON.parse(fs.readFileSync(vendorPath,'utf8'));if(String(vendor.license||'').toUpperCase()!==approved[packageName].toUpperCase())throw new Error(`${packageName} vendor license must be ${approved[packageName]}.`);}
if(Object.keys(pkg.dependencies||{}).some(name=>/stripe|twilio|firebase|supabase|revenuecat/i.test(name)))throw new Error('Core package contains an external service dependency.');
console.log(`License gate: OK (${Object.keys(approved).length} reviewed direct dependencies)`);
