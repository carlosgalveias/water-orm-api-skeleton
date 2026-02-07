'use strict';

/**
 * GENERIC CRUD ROUTER (EMBER.JS / JSON:API COMPLIANT)
 * =============================================================================
 * This module provides a standardized interface for Database operations using 
 * Waterline ORM. It is designed to follow Ember Data (JSON:API) conventions,
 * handling side-loading, relationship flattening, and pagination automatically.
 * * EXTENSION PATTERN:
 * To override a specific behavior, import this module into a custom controller:
 * * const base = require('./generic.js');
 * const custom = { ...base };
 * custom.patch = async (req, res) => {
 * const result = await base.patch(req);
 * if (result.status === 200) { // Do custom logic }
 * return res ? res(result) : result;
 * };
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const pluralize = require('pluralize');
const utilDatabase = require('../utils/util-database');
const _ = require('lodash'); // Using lodash for robust deep cloning

// Logger abstraction: Suppresses logs during test runs unless they are errors
const fakeConsole = {
  log: () => {},
  error: (...args) => console.error(...args)
};
const origConsole = process.env.RUNNING_TESTS ? fakeConsole : console;

let orm;

/**
 * Ensures the database connection is established.
 */
const initDb = async function() {
  if (!orm) {
    orm = await utilDatabase.initDb();
  }
};

/**
 * Creates a record in the database. Used primarily for embedded relationships.
 * @param {Object} data - { type: 'modelName', attributes: { ... } }
 */
const createData = async function(data) {
  const model = pluralize(data.type);
  const db = orm.waterline.collections[model];
  
  return new Promise((resolve, reject) => {
    db.create(data.attributes).exec((err, res) => {
      if (err) return reject(err);
      resolve({ id: res.id, type: data.type });
    });
  });
};

/**
 * Transforms JSON:API relationship objects into flat ID-based keys for Waterline.
 * Recursively creates embedded records if an ID is missing.
 */
const flattenRelationship = async function(relationship) {
  const obj = {};
  for (const key of Object.keys(relationship)) {
    const data = relationship[key].data || null;
    if (!data) {
      obj[key] = null;
      continue;
    }

    if (Array.isArray(data)) {
      const ids = [];
      for (const d of data) {
        const record = d.id ? d : await createData(d);
        ids.push(record.id);
      }
      obj[key] = ids;
    } else {
      const record = data.id ? data : await createData(data);
      obj[key] = record.id;
    }
  }
  return obj;
};

const flattenRelationships = async function(relationships) {
  if (!relationships) return {};
  if (!Array.isArray(relationships)) return flattenRelationship(relationships);

  return Promise.all(relationships.map(r => flattenRelationship(r)));
};

/**
 * Deep search utility to cast strings to integers or nulls where appropriate.
 */
const deepFirstSearch = (obj, convert) => {
  if (convert == null || obj === undefined || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => deepFirstSearch(item, convert));
  } 
  
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const newObj = {};
    for (const k of Object.keys(obj)) {
      newObj[k] = deepFirstSearch(obj[k], convert);
    }
    return newObj;
  }

  return convert(obj);
};

const normalizeValue = (val) => {
  if (val === 'null') return null;
  if (typeof val === 'string' && val.match(/^\d+$/)) return parseInt(val, 10);
  return val;
};

/**
 * Standardizes the return format, supporting both callbacks and direct returns.
 */
const returnData = (result, cb) => {
  if (cb && typeof cb === 'function') return cb(result);
  return result;
};

const generic = {
  getOrm: async () => {
    await initDb();
    return orm;
  },

  /**
   * GET: Supports ID-based lookup or filtered collection queries.
   * Auto-populates relationships based on the model definition.
   */
  get: async function(req, res) {
    const log = process.env.RUNNING_TESTS ? fakeConsole : (req.console || origConsole);
    try {
      await initDb();
      const table = req.params['0'];
      const id = req.params.id;
      const db = orm.waterline.collections[table];

      if (!db) {
        return returnData({ status: 500, result: { error: `Invalid Table: ${table}` } }, res);
      }

      // 1. Parse stringified JSON query params
      Object.keys(req.query).forEach(key => {
        try {
          req.query[key] = JSON.parse(req.query[key]);
        } catch (e) { /* ignore non-json strings */ }
      });

      // 2. Normalize types (strings to ints/nulls)
      req.query = deepFirstSearch(req.query, normalizeValue);

      // 3. Determine populations and filters
      const populations = [];
      const populateFilters = [];
      
      Object.keys(db.attributes).forEach(key => {
        const attr = db.attributes[key];
        if (attr.collection) {
          if (req.query[key] && attr.via) {
            populateFilters.push({ key, query: req.query[key] });
            delete req.query[key];
          }
          populations.push(key);
        } else if (attr.model) {
          populations.push(key);
        }
      });

      // 4. Extract pagination/sort
      const limit = req.query.limit || 100;
      const skip = req.query.skip || 0;
      const sort = req.query.sort || { id: 'ASC' };
      ['limit', 'skip', 'sort', 'populate'].forEach(k => delete req.query[k]);

      const filter = req.query;
      if (id) {
        if (filter.id && filter.id != id) {
          return returnData({ status: 404, result: { error: 'ID mismatch' } }, res);
        }
        filter.id = id;
      }

      // 5. Execute Queries
      const count = await db.count().where(filter);
      let results = count > 0 
        ? await db.find().populate(populations).where(filter).limit(limit).skip(skip).sort(sort)
        : [];

      // 6. Manual filtering for Many-to-Many associations if required
      if (populateFilters.length > 0 && results.length > 0) {
        populateFilters.forEach(f => {
          const queryIds = Array.isArray(f.query) ? f.query : [f.query];
          results = results.filter(row => 
            row[f.key] && row[f.key].some(rel => queryIds.includes(rel.id))
          );
        });
      }

      if (id && results.length === 0) {
        return returnData({ status: 404, result: { error: 'Item not found' } }, res);
      }

      // 7. Format to JSON:API
      const data = results.map(row => {
        const attributes = {};
        const relationships = {};
        
        Object.keys(row).forEach(key => {
          const schema = db.attributes[key];
          if (row[key] && schema?.collection) {
            relationships[key] = {
              data: row[key].map(r => ({ type: pluralize(schema.collection), id: r.id }))
            };
          } else if (row[key] && schema?.model) {
            relationships[key] = { 
              data: { type: pluralize(schema.model), id: typeof row[key] === 'object' ? row[key].id : row[key] } 
            };
          } else if (!schema || (!schema.collection && !schema.model)) {
            attributes[key] = row[key];
          }
        });

        return { type: table, id: row.id, attributes, relationships };
      });

      const response = {
        meta: { totalrecords: count, query: filter, limit, skip, sort },
        data: id ? data[0] : data
      };

      if (!response.data && id) {
        return returnData({ status: 404, result: { error: 'Item not found' } }, res);
      }

      return returnData({ status: 200, result: response }, res);

    } catch (e) {
      log.error('GET flow error:', e);
      return returnData({ status: 500, result: { error: e.message } }, res);
    }
  },

  /**
   * PATCH: Updates an existing record.
   */
  patch: async function(originalReq, res) {
    const log = process.env.RUNNING_TESTS ? fakeConsole : (originalReq.console || origConsole);
    try {
      await initDb();
      const req = _.cloneDeep(originalReq); // Safe deep clone
      const table = req.params['0'];
      const id = req.params.id;

      if (!id || !req.body?.data) {
        return returnData({ status: 500, result: { error: 'Invalid Request: Missing ID or Data' } }, res);
      }

      const db = orm.waterline.collections[table];
      const attrs = req.body.data.attributes || {};

      if (attrs.password === null) delete attrs.password;

      // Flatten relationships into the attribute set
      if (req.body.data.relationships) {
        const flattened = await flattenRelationships(req.body.data.relationships);
        Object.assign(attrs, flattened);
      }

      attrs.id = id;
      await db.update(id, attrs);

      return returnData({ 
        status: 200, 
        result: { data: { id, attributes: attrs, type: table, relationships: req.body.data.relationships } } 
      }, res);

    } catch (e) {
      log.error('PATCH flow error:', e);
      return returnData({ status: 500, result: { error: e.message } }, res);
    }
  },

  /**
   * POST: Creates new records. Supports single objects or arrays.
   */
  post: async function(originalReq, res) {
    const log = process.env.RUNNING_TESTS ? fakeConsole : (originalReq.console || origConsole);
    try {
      await initDb();
      const req = _.cloneDeep(originalReq);
      const table = req.params['0'];
      const db = orm.waterline.collections[table];

      if (!req.body?.data) return returnData({ status: 500, result: { error: 'Invalid Data' } }, res);

      const isArray = Array.isArray(req.body.data);
      const dataItems = isArray ? req.body.data : [req.body.data];

      for (const item of dataItems) {
        if (item.id || item.attributes?.id) {
          return returnData({ status: 500, result: { error: 'ID assignment not allowed on POST' } }, res);
        }

        if (item.relationships) {
          const flattened = await flattenRelationships(item.relationships);
          Object.assign(item.attributes, flattened);
        }
      }

      const payload = isArray ? dataItems.map(d => d.attributes) : dataItems[0].attributes;
      const created = await db.create(payload);

      // Map generated IDs back to the JSON:API structure
      if (isArray) {
        created.forEach((record, idx) => { req.body.data[idx].id = record.id; });
      } else {
        req.body.data.id = created.id;
      }

      return returnData({ status: 200, result: { data: req.body.data } }, res);

    } catch (e) {
      log.error('POST flow error:', e);
      return returnData({ status: 500, result: { error: e.message } }, res);
    }
  },

  /**
   * DELETE: Removes a record by ID.
   */
  delete: async function(req, res) {
    const log = process.env.RUNNING_TESTS ? fakeConsole : (req.console || origConsole);
    try {
      await initDb();
      const table = req.params['0'];
      const id = req.params.id;
      const db = orm.waterline.collections[table];

      if (!db || !id) return returnData({ status: 500, result: { error: 'Invalid Table or ID' } }, res);

      await db.destroy(id);
      return returnData({ status: 200, result: { meta: { success: true } } }, res);

    } catch (e) {
      log.error('DELETE flow error:', e);
      return returnData({ status: 500, result: { error: e.message } }, res);
    }
  }
};

module.exports = generic;