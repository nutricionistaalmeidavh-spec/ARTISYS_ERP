'use strict';
function quantity(value,label='quantity'){const n=Number(value);if(!Number.isFinite(n))throw new TypeError(`${label} deve ser numerico.`);return n;}
function positiveQuantity(value,label='quantity'){const n=quantity(value,label);if(n<=0)throw new RangeError(`${label} deve ser maior que zero.`);return n;}
function assertAvailable(balance,reserved,requested){if(Number(balance)-Number(reserved)<Number(requested))throw new Error('Estoque disponivel insuficiente.');}
module.exports={quantity,positiveQuantity,assertAvailable};
