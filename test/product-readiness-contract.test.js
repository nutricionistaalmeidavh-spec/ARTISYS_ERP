'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

function read(path){return fs.readFileSync(path,'utf8');}

test('CI targets main and package exposes real lint and coverage gates',()=>{
  const verify=read('.github/workflows/verify.yml');
  const win=read('.github/workflows/windows-build.yml');
  const pkg=JSON.parse(read('package.json'));
  assert.match(verify,/branches:\s*\[main\]/);
  assert.match(win,/branches:\s*\[main\]/);
  assert.match(pkg.scripts.lint||'',/eslint/);
  assert.ok(pkg.scripts.coverage,'coverage script missing');
  assert.match(pkg.scripts.e2e||'',/--test-concurrency=1/,'Electron E2E must run serially to avoid CI resource contention');
  assert.ok(fs.existsSync('eslint.config.js'),'eslint.config.js missing');
  assert.ok(fs.existsSync('scripts/check-coverage.js'),'coverage gate missing');
});
