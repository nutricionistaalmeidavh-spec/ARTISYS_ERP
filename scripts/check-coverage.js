'use strict';
const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['--experimental-test-coverage','--test','--test-coverage-lines=30','--test-coverage-functions=30','--test-coverage-branches=20','test/*.test.js'],{stdio:'inherit',shell:true});
if(result.status!==0)process.exit(result.status||1);
