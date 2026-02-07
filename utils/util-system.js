'use strict';
const os = require('os');
const crypto = require('crypto');
const utils = {
  sleep: function(delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
  },
  random: function() {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1); // Generates a random float between 0 and 1
  },
  randomMinMax: function(min, max) {
    return crypto.randomInt(min, max);
  },
  uuid: function(len=8) {
    const hrtime = process.hrtime();
    const nanoseconds = hrtime[0] * 1e9 + hrtime[1];
    const randomHex = utils.random().toString(16).substring(2, 10);
    const uniqueId = `${nanoseconds.toString(16)}${randomHex}`;
    return uniqueId.substring(0, len);
  },
  get: {
    arch: function() {
      return os.arch();
    },
    cpus: function() {
      return os.cpus();
    },
    loadAvg: function() {
      return os.loadavg();
    },
    memoryFree: function() {
      return os.freemem();
    },
    memoryTotal: function() {
      return os.totalmem();
    },
    nanoTime: function() {
      const hrTime = process.hrtime();
      return hrTime[0] * 1000000000 + hrTime[1];
    },
    version: function() {
      return os.version();
    }
  }
};
module.exports = utils;