'use strict';
const fs=require('node:fs');
const path=require('node:path');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const approved={'@artisys/finance-domain':'MIT','electron':'MIT','electron-builder':'MIT','playwright':'Apache-2.0'};
for(const name of [...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{})])if(!approved[name])throw new Error(`Direct dependency has no reviewed license entry: ${name}`);
const vendorPath=path.join('vendor','artisys-finance-domain','package.json');if(!fs.existsSync(vendorPath))throw new Error('Finance vendor package missing.');const vendor=JSON.parse(fs.readFileSync(vendorPath,'utf8'));if(String(vendor.license||'').toUpperCase()!=='MIT')throw new Error('Finance vendor license must be MIT.');
if(Object.keys(pkg.dependencies||{}).some(name=>/stripe|twilio|firebase|supabase|revenuecat/i.test(name)))throw new Error('Core package contains an external service dependency.');
console.log(`License gate: OK (${Object.keys(approved).length} reviewed direct dependencies)`);
