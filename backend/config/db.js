const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',           // PostgreSQL 유저
  host: 'localhost',
  database: 'devsync',        // 이미 만든 DB
  password: 'jun09188',  // PostgreSQL 비밀m번호
  port: 5432,
});

module.exports = pool;
