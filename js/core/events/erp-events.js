'use strict';
const { randomUUID } = require('node:crypto');
const {
  createDomainEvent,
  DomainEventBus,
  DomainEventDispatcher,
  SqliteOutboxStore,
  SqliteEffectStore
} = require('@artisys/eventbus');

function createErpEvents({ db, now = () => new Date().toISOString() } = {}) {
  if (!db) throw new TypeError('Database is required.');
  const bus = new DomainEventBus();
  const outbox = new SqliteOutboxStore(db);
  const effects = new SqliteEffectStore(db);
  const dispatcher = new DomainEventDispatcher({ bus, outbox });

  return {
    bus,
    outbox,
    effects,
    dispatcher,
    create(type, aggregate, aggregateId, payload = {}, actor = {}, mutationId = null) {
      return createDomainEvent({
        eventId: randomUUID(),
        type,
        aggregate,
        aggregateId,
        mutationId,
        source: 'artisys-erp',
        actor: actor || {},
        payload,
        occurredAt: now()
      });
    },
    dispatchPending() {
      return dispatcher.dispatchPending();
    }
  };
}

module.exports = { createErpEvents };
