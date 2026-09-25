'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createErpRuntime } = require('../js/core/erp-runtime');

test('ERP creates durable EventBus tables', () => {
  const runtime = createErpRuntime();
  try {
    const names = runtime.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
    assert.ok(names.includes('domain_events'));
    assert.ok(names.includes('domain_event_effects'));
  } finally {
    runtime.close();
  }
});
