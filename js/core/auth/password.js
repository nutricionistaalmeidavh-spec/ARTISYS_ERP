'use strict';
const {randomBytes,scryptSync,timingSafeEqual}=require('node:crypto');
function hashPassword(password){const text=String(password||'');if(!text.trim())throw new Error('Senha obrigatoria.');const salt=randomBytes(16);const hash=scryptSync(text,salt,32);return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;}
function verifyPassword(password,encoded){const parts=String(encoded||'').split('$');if(parts.length!==3||parts[0]!=='scrypt')return false;try{const salt=Buffer.from(parts[1],'hex');const expected=Buffer.from(parts[2],'hex');const actual=scryptSync(String(password||''),salt,expected.length);return expected.length===actual.length&&timingSafeEqual(expected,actual);}catch{return false;}}
module.exports={hashPassword,verifyPassword};
