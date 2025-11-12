const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',           // PostgreSQL 유저
  host: 'localhost',
  database: 'devsync',        // 이미 만든 DB
  password: '7984689',  // PostgreSQL 비밀번호
  port: 5432,
});

module.exports = pool;
