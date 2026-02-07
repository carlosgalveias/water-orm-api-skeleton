'use strict';
const cfg = require('../config/database.js');
const sys = require('../utils/util-system');
const fs = require('fs');
const path = require('path');
const Waterline = require('water-orm');

const adapter = Waterline[cfg.adapter];

// Waterline initialization
const orm = new Waterline();

// Generate unique connection/adapter id for same machine connections
const connectionId = sys.uuid();
const adapterId = sys.uuid();

// DB Configuration
const config = {
  adapters: {},
  connections: {},
  defaults: {
    migrate: cfg.migrate,
    uri: cfg.uri,
    caseSensitive: true,
    wlNext: {
      caseSensitive: true
    }
  },
  caseSensitive: true,
  wlNext: {
    caseSensitive: true
  }
};

config.adapters[adapterId] = adapter;

// DB Connection
config.connections[connectionId] = cfg;
config.connections[connectionId].module = cfg.adapter;
config.connections[connectionId].adapter = adapterId;

// Load all the db models and initialize the db
fs.readdirSync(path.join(__dirname, 'db')).forEach(function(file) {
  const model = require(path.join(__dirname, 'db', file))(connectionId);
  orm.loadCollection(Waterline.Collection.extend(model));
});

const initDb = function() {
  return new Promise((resolve, reject) => {
    const start = +new Date();
    if (!orm.connections) {
      try {
        orm.initialize(config, function(err, models) {
          if (err) {
            console.error(err);
            reject(err);
          }
          return resolve(true);
        });
      } catch (e) {
        console.error(e);
        reject(e);
      }
    } else {
      return resolve(true);
    }
  });
};

const orminit = initDb();

//Export orm
module.exports = {
  waterline: orm,
  config: config,
  orminit
};