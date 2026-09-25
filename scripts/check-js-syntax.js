'use strict';
const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');const roots=['js','server','desktop','scripts','test'];const files=[];
function walk(p){if(!fs.existsSync(p))return;const s=fs.statSync(p);if(s.isFile()){if(/\.(?:js|cjs)$/i.test(p))files.push(p);return;}for(const n of fs.readdirSync(p))walk(path.join(p,n));}
for(const r of roots)walk(r);for(const file of files){const res=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(res.status!==0){process.stderr.write(res.stderr||res.stdout);process.exit(res.status||1);}}console.log(`JS syntax OK (${files.length} files)`);
