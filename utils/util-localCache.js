'use strict';
const sys = require('./util-system');
const sizeof = require('object-sizeof');
const Logger = require('./util-logger');
const callFunction = require('./util-callFunction');
// we need to know if we are executing in cloud (lambda) to know if we are going to use REDIS, its not necessary running locally
// we might also not suppport REDIS and in that case we do not have REDIS_URL.
const isLambda = !(process.env.RUNNING_LOCALLY || process.env.RUNNING_TESTS || !process.env.REDIS_URL);

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const getFromRedis = async function(key) {
  try {
    const data = await callFunction('storage-redis', { type: 'read', key }, true);
    return data;
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

const addToRedis = async function(key, val) {
  try {
    await callFunction(
      'storage-redis', { type: 'write', key, data: val },
      true
    );
  } catch (e) {
    console.error(e)
  }
}

const delFromRedis = async function(key) {
  try {
    await callFunction(
      'storage-redis', { type: 'remove', key },
      true
    );
  } catch (e) {
    console.error(e);
  }
}

const localCache = function(args) {
  this.hashMap = {};
  this.timeout = -1; // time to delete key even if it is being used (to refresh cache, disabled by default)
  this.accessTimeout = 3600000; // by default keys expire in 1h if not used
  this.label = 'localCache';
  this.cacheRedis = false;
  this.cacheRedisPrefix = this.label + '_';
  Object.assign(this, args);
  if (!isLambda) {
    // we are not in a app so we also do not cache for redis
    this.cacheRedis = false;
  }
  this.logger = new Logger({ tags: ['[DEBUG] '+ this.label || '[DEBUG] localCache'] });
  this.logger.log(`cache for ${this.label || 'localCache'} created. Timout:${this.timeout}, accessTimeout:${this.accessTimeout}`);
  this.add = async function(key, val) {
    this.hashMap[key] = {
      data: val,
      time: +new Date(), // created date
      last: +new Date() // last access
    };
    if (this.cacheRedis) {
      await addToRedis(this.cacheRedisPrefix + key, val)
    }
  };
  this.del = async function(key) {
    delete this.hashMap[key];
    if (this.cacheRedis) {
      delFromRedis(this.cacheRedisPrefix + key)
    }
  };
  this.get = async function(key) {
    let val;
    if (!this.hashMap[key] && !this.cacheRedis) {
      return undefined;
    }
    if (!this.hashMap[key] && this.cacheRedis) {
      val = await getFromRedis(this.cacheRedisPrefix + key);
      if (!val) {
        return undefined;
      }
    } else {
      val = this.hashMap[key].data;
    }
    if (!this.hashMap[key]) {
      this.hashMap[key] = {
        data: val,
        time: +new Date(), // created date
        last: +new Date() // last access
      };
    } else {
      this.hashMap[key].last = +new Date();
    }
    return val;
  };
  this.has = async function(key) {
    if (!this.cacheRedis) {
      return !!this.hashMap[key];
    }
    return !!(this.hashMap[key] || await getFromRedis(this.cacheRedisPrefix + key))
  };
  this.workFlow = async function() {
    if (isLambda && (this.timeout > 0 || this.accessTimeout > 0)) {
      while (true) {
        try {
          await sys.sleep(10000);
          const keys = Object.keys(this.hashMap);
          for (const key of keys) {
            const last = this.hashMap[key].last;
            const time = this.hashMap[key].time;
            const now = +new Date();
            if (this.timeout > 0 && now > time + this.timeout) {
              delete this.hashMap[key];
              await delFromRedis(this.cacheRedisPrefix + key);
            }
            if (this.accessTimeout > 0 && now > last + this.accessTimeout) {
              delete this.hashMap[key];
              await delFromRedis(this.cacheRedisPrefix + key);
            }
          }
        } catch (e) {
          console.error(e);
          this.logger.error(e);
        }
      }
    }
  };
  this.workFlow();
};

module.exports = localCache;