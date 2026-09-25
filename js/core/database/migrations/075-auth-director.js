'use strict';
module.exports={id:'075-auth-director',up(db){db.exec(`
ALTER TABLE users RENAME TO users_pre_director;
CREATE TABLE users(
 id TEXT PRIMARY KEY,
 username TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','manager','director','operator')),
 password_hash TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
INSERT INTO users(id,username,name,role,password_hash,active,created_at,updated_at)
SELECT id,username,name,role,password_hash,active,created_at,updated_at FROM users_pre_director;
DROP TABLE users_pre_director;
`);}};
