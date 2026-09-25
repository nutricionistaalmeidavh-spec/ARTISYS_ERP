'use strict';
function assertRole(actor,allowedRoles=[]){if(!actor||!allowedRoles.includes(String(actor.role||'')))throw new Error('Autorizacao insuficiente.');return actor;}
module.exports={assertRole};
