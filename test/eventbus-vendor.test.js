'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('vendored eventbus exposes the desktop contract', () => {
  const eventbus = require('../vendor/artisys-eventbus/src');
  for (const key of [
    'createDomainEvent',
    'DomainEventBus',
    'DomainEventDispatcher',
    'SqliteOutboxStore',
    'SqliteEffectStore',
    'IdempotentEffectRunner',
    'SQLITE_SCHEMA'
  ]) {
    assert.ok(eventbus[key], `missing ${key}`);
  }
});
