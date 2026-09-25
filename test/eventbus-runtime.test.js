'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createErpRuntime } = require('../js/core/erp-runtime');
const { withTransaction } = require('../js/core/database/sqlite-database');

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

test('runtime exposes durable events and retries failed subscribers', async () => {
  const runtime = createErpRuntime();
  try {
    assert.equal(typeof runtime.events.create, 'function');
    assert.equal(typeof runtime.events.dispatchPending, 'function');
    let calls = 0;
    runtime.events.bus.subscribe('test.event', () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
    });
    const event = runtime.events.create('test.event', 'test', '1', { ok: true }, { id: 'u1' });
    runtime.events.outbox.insert(event);
    const first = await runtime.events.dispatchPending();
    assert.equal(first.failed, 1);
    const second = await runtime.events.dispatchPending();
    assert.equal(second.dispatched, 1);
    assert.equal(calls, 2);
  } finally {
    runtime.close();
  }
});

test('event inserted in a rolled back transaction does not survive', () => {
  const runtime = createErpRuntime();
  try {
    const event = runtime.events.create('test.rollback', 'test', 'rollback-1', {}, { id: 'u1' });
    assert.throws(() => withTransaction(runtime.db, () => {
      runtime.events.outbox.insert(event);
      throw new Error('force rollback');
    }), /force rollback/);
    const count = runtime.db.prepare('SELECT COUNT(*) AS n FROM domain_events WHERE event_id=?').get(event.eventId).n;
    assert.equal(Number(count), 0);
  } finally {
    runtime.close();
  }
});

test('pending event survives restart and dispatches exactly once', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'artisys-eventbus-'));
  const dbPath = join(dir, 'erp.sqlite');
  try {
    const first = createErpRuntime({ dbPath });
    const event = first.events.create('test.restart', 'test', 'restart-1', { value: 1 }, { id: 'u1' });
    first.events.outbox.insert(event);
    first.close();

    const second = createErpRuntime({ dbPath });
    let calls = 0;
    second.events.bus.subscribe('test.restart', () => { calls += 1; });
    const dispatched = await second.events.dispatchPending();
    assert.equal(dispatched.dispatched, 1);
    assert.equal(calls, 1);
    const again = await second.events.dispatchPending();
    assert.equal(again.attempted, 0);
    assert.equal(calls, 1);
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
