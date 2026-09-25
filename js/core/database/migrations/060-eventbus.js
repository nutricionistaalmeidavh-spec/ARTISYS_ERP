'use strict';
const { SQLITE_SCHEMA } = require('@artisys/eventbus');

module.exports = {
  id: '060-eventbus',
  up(db) {
    db.exec(SQLITE_SCHEMA);
  }
};
