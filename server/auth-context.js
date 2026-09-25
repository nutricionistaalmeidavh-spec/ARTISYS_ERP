'use strict';
const {HttpError,bearer}=require('./http-utils');
function resolveActor(req,sessions){const token=bearer(req);if(!token)throw new HttpError(401,'Sessao obrigatoria.');const session=sessions.resolve(token);if(!session)throw new HttpError(401,'Sessao invalida ou expirada.');return{actor:{userId:session.userId,role:session.role},token};}
module.exports={resolveActor};
