'use strict';
/**
Database Configuration file
*/

const host = process.env.RUNNING_LOCALLY ? process.env.DB_ADDRESS : process.env.DB_ADDRESS_PRIVATE;
const poolSize = process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : 1;

const db = {
  adapter: process.env.RUNNING_TESTS ? 'worm-memory' : 'worm-postgresql',
  host,
  url: 'postgres://' + process.env.DB_USER + ':' + process.env.DB_PASSWORD + '@' + host + ':' + process.env.DB_PORT + '/' + process.env.DB_DBNAME,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DBNAME,
  migrate: 'safe',
  poolSize,
  caseSensitive: true,
  ssl: {
    sslmode: 'require',
    rejectUnauthorized: false
  },
  wlNext: {
    caseSensitive: true
  }
};

module.exports = db;