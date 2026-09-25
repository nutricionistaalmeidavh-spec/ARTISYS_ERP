'use strict';

const { createDomainEvent, validateDomainEvent } = require('./domain-event');
const { DomainEventBus } = require('./event-bus');
const { DomainEventDispatcher } = require('./dispatcher');
const { IdempotentEffectRunner } = require('./effect-runner');
const { MemoryOutboxStore } = require('./adapters/memory-outbox');
const { MemoryEffectStore } = require('./adapters/memory-effect-store');
const { SqliteOutboxStore } = require('./adapters/sqlite-outbox');
const { SqliteEffectStore } = require('./adapters/sqlite-effect-store');
const { SQLITE_SCHEMA } = require('./adapters/sqlite-schema');

module.exports = {
  createDomainEvent,
  validateDomainEvent,
  DomainEventBus,
  DomainEventDispatcher,
  IdempotentEffectRunner,
  MemoryOutboxStore,
  MemoryEffectStore,
  SqliteOutboxStore,
  SqliteEffectStore,
  SQLITE_SCHEMA
};
