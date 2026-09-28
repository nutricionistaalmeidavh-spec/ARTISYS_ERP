'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {migrations}=require('../js/core/database/migrations');
test('fiscal runtime migration runs before traceability ledger',()=>{const ids=migrations.map(x=>x.id);const fiscal=ids.indexOf('160-fiscal-runtime'),trace=ids.indexOf('160-traceability-ledger');assert.ok(fiscal>=0);assert.ok(trace>=0);assert.ok(fiscal<trace);assert.equal(new Set(ids).size,ids.length);});
