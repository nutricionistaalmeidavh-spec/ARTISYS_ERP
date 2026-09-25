'use strict';
const { validateDomainEvent } = require('../domain-event');
class MemoryOutboxStore {
  constructor(){this._records=new Map();this._order=[];}
  insert(event){validateDomainEvent(event);if(this._records.has(event.eventId))throw new Error(`Domain event ${event.eventId} already exists`);this._records.set(event.eventId,{event,dispatchedAt:null,lastError:null});this._order.push(event.eventId);return event;}
  async listPending(limit=100){const safeLimit=Math.max(1,Math.min(Number(limit)||100,1000)),pending=[];for(const eventId of this._order){const record=this._records.get(eventId);if(record&&!record.dispatchedAt){pending.push(record.event);if(pending.length>=safeLimit)break;}}return pending;}
  async markDispatched(eventId){const record=this._records.get(eventId);if(!record)return false;record.dispatchedAt=new Date().toISOString();record.lastError=null;return true;}
  async recordFailure(eventId,message){const record=this._records.get(eventId);if(!record)return false;record.lastError=String(message||'').slice(0,4000);return true;}
  get(eventId){const record=this._records.get(eventId);if(!record)return null;return{...record,...record.event};}
}
module.exports={MemoryOutboxStore};
