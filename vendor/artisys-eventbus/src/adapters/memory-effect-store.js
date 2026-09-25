'use strict';
class MemoryEffectStore {
  constructor(){this._applied=new Map();}
  _key(eventId,effectKey){return `${eventId}\u0000${effectKey}`;}
  async hasApplied(eventId,effectKey){return this._applied.has(this._key(eventId,effectKey));}
  async markApplied(effect){const record={eventId:effect.eventId,effectKey:effect.effectKey,aggregate:effect.aggregate,aggregateId:String(effect.aggregateId),appliedAt:effect.appliedAt||new Date().toISOString()};this._applied.set(this._key(record.eventId,record.effectKey),record);return record;}
  get(eventId,effectKey){return this._applied.get(this._key(eventId,effectKey))||null;}
}
module.exports={MemoryEffectStore};
