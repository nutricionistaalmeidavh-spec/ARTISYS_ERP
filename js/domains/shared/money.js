'use strict';
function assertCents(value,label='value'){const n=Number(value);if(!Number.isInteger(n))throw new TypeError(`${label} must be integer cents`);return n;}module.exports={assertCents};
