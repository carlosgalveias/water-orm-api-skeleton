'use strict';

const Redis = require('ioredis');
let instance = null;
let prefix = process.env.RUNNING_TESTS ? 'test_' : '';

const initDb = async function () {
  if (instance) {
    return instance;
  }
  instance = new Redis({
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true; // or `return 1;`
      }
    },
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_URL,
    family: 4, // 4 (IPv4) or 6 (IPv6)
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: 0,
    tls: {
      rejectUnauthorized: false,
    },
  });
  return instance;
};

const disconnect = function(){
  instance.disconnect()
  instance = null;
};

const read = async function (key) {
  instance = await initDb();
  let value = await instance.get(`${prefix}${key}`);
  if (value) {
    try {
      value = JSON.parse(value);
    } catch (e) {
      // shh
    }
    return { result: value };
  }
};

const write = async function (key, value) {
  if (typeof value === 'object') {
    value = JSON.stringify(value);
  }
  instance = await initDb();
  await instance.set(`${prefix}${key}`, value);
  return { result: 'ok' };
};

const remove = async function (key) {
  instance = await initDb();
  await instance.del(`${prefix}${key}`);
  return { result: 'ok' };
};

const clean = function () {
  return new Promise((resolve, reject) => {
    initDb().then((instance) => {
      const stream = instance.scanStream();
      stream.on('data', async (resultKeys) => {
        // Pause the stream from scanning more keys until we've migrated the current keys.
        stream.pause();
        Promise.all(
          resultKeys.map(async (k) => {
            const idleTime = await instance.object('IDLETIME', k);
            if (idleTime > 7 * 24 * 60 * 60) {
              await remove(k);
            }
          })
        ).then(() => {
          // Resume the stream here.
          stream.resume();
        });
      });
      stream.on('end', () => {
        disconnect();
        resolve({ result: 'ok' });
      });
    });
  });
};

const cleanTests = function () {
  return new Promise((resolve, reject) => {
    initDb().then((instance) => {
      const stream = instance.scanStream('test_*');
      stream.on('data', async (resultKeys) => {
        // Pause the stream from scanning more keys until we've migrated the current keys.
        stream.pause();
        Promise.all(
          resultKeys.map(async (k) => {
            await remove(k);
          })
        ).then(() => {
          // Resume the stream here.
          stream.resume();
        });
      });
      stream.on('end', () => {
        resolve({ result: 'ok' });
      });
    });
  });
};

const format = function () {
  return new Promise((resolve, reject) => {
    initDb().then((instance) => {
      const stream = instance.scanStream();
      stream.on('data', async (resultKeys) => {
        // Pause the stream from scanning more keys until we've migrated the current keys.
        stream.pause();
        Promise.all(
          resultKeys.map(async (k) => {
            await remove(k);
          })
        ).then(() => {
          // Resume the stream here.
          stream.resume();
        });
      });
      stream.on('end', () => {
        resolve({ result: 'ok' });
      });
    });
  });
};

const listKeys = function () {
  return new Promise((resolve, reject) => {
    initDb().then((instance) => {
      const stream = instance.scanStream();
      let keys = [];
      stream.on('data', async (resultKeys) => {
        stream.pause();

        Promise.all(
          resultKeys.map(async (k) => {
            keys.push(k);
          })
        ).then(() => {
          // Resume the stream here.
          stream.resume();
        });
      });
      stream.on('end', () => {
        resolve({ result: keys });
      });
    });
  });
};
const redisActions = {
  read: async function (args) {
    return read(args.key);
  },
  write: async function (args) {
    return write(args.key, args.data);
  },
  remove: async function (args) {
    return remove(args.key);
  },
  clean: async function () {
    return clean();
  },
  cleanTests: async function () {
    return cleanTests();
  },
  format: async function () {
    return format();
  },
  listKeys: async function () {
    return listKeys();
  },
  cleanAssitantCredentials
};

// function
const storageRedis = async function (args) {
  if (!args || !args.type) {
    throw new Error('invalid request');
  }
  try {
    return await redisActions[args.type](args);
  } catch (e) {
    console.error(e);
    throw e;
  }
};

module.exports = storageRedis;
module.exports.config = {
   cpu: '0.5',
   memory: '2G',
   timeout: 60
};