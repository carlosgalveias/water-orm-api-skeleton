'use strict';
const utilDatabase = require('../utils/util-database');

// Initialize our ORM if not initialized
let orm; 
const initDb = async function() {
  orm = orm || (await utilDatabase.initDb());
};

const DBActions = {
  read: async function(args) {
    let res = [];
    await initDb();
    const table = args.table;
    const db = orm.waterline.collections[table];
    if (!db) {
      throw ('error accessing table', table);
    }
    if (args.limit) {
      if (args.attributes) {
        res = await db
          .find({
            where: args.query,
            select: args.select ? args.select : '*',
          })
          .limit(args.limit)
          .populate(args.attributes);
      } else {
        res = await db
          .find({
            where: args.query,
            select: args.select ? args.select : '*',
          })
          .limit(args.limit);
      }
    } else {
      if (args.attributes) {
        res = await db
          .find({
            where: args.query,
            select: args.select ? args.select : '*',
          })
          .populate(args.attributes);
      } else {
        res = await db.find({
          where: args.query,
          select: args.select ? args.select : '*',
        });
      }
    }
    if (res[0]) {
      return res;
    } else {
      // If we do not have results, do not give error, just return null
      return null;
    }
  },

  query: async function(args) {
    let res = [];
    await initDb();
    const table = args.table;
    const db = orm.waterline.collections[table];
    if (!db) {
      throw ('error accessing table', table);
    }
    return new Promise((resolve, reject) => {
      db.query(args.query, args.params || [], function(err, rawResult) {
        if (err) {
          return reject(err);
        }

        res = rawResult.rows;
        if (res && res[0]) {
          return resolve(res);
        } else {
          // console.error('Could not find any data with that ID', JSON.stringify(args))
          return resolve(null);
        }
      });
    });
  },

  readSort: async function(args) {
    let res = [];
    await initDb();
    const table = args.table;
    const skip = args.skip ? args.skip : 0;
    const db = orm.waterline.collections[table];
    if (!db) {
      throw 'error accessing table';
    }
    if (args.limit) {
      if (args.attributes) {
        res = await db
          .find({
            where: args.query,
          })
          .sort(args.sort)
          .skip(skip)
          .limit(args.limit)
          .populate(args.attributes);
      } else {
        res = await db
          .find({
            where: args.query,
          })
          .sort(args.sort)
          .skip(skip)
          .limit(args.limit);
      }
    } else {
      if (args.attributes) {
        res = await db
          .find({
            where: args.query,
          })
          .sort(args.sort)
          .populate(args.attributes);
      } else {
        res = await db
          .find({
            where: args.query,
          })
          .sort(args.sort);
      }
    }
    if (res[0]) {
      return res;
    } else {
      return null;
    }
  },

  count: async function(args) {
    let res = [];
    await initDb();
    const table = args.table;
    const db = orm.waterline.collections[table];
    if (!db) {
      throw 'error accessing table';
    }
    if (args.count) {
      res = await db.count(args.count);
    } else {
      res = await db.count();
    }
    if (res) {
      return res;
    } else {
      return null;
    }
  },

  write: async function(args) {
    await initDb();
    args.data = structuredClone(args.data);
    const table = args.table;
    const db = orm.waterline.collections[table];
    const res = await db.create(args.data);
    if (res) {
      return res;
    } else {
      return null;
    }
  },

  destroy: async function(args) {
    await initDb();
    const table = args.table;
    const db = orm.waterline.collections[table];

    const res = await db.destroy(args.query);
    if (res) {
      return res;
    } else {
      console.error('Record not found');
      return null;
    }
  },

  update: async function(args) {
    await initDb();
    const table = args.table;
    const db = orm.waterline.collections[table];
    if (!db) {
      throw 'error accessing table';
    }
    // dont allow to update project with undefined or null values
    args.data = structuredClone(args.data);
    const keys = Object.keys(args.data);

    // optimização: evita um round trip à bd quando tem id
    let id = args.query.id;
    if (id != null) {
      if (Array.isArray(id) && id.length === 1) {
        // se o id é um array, só deverá atualizar o primeiro id e por isso o id é o indice 0
        id = id[0];
      }
      const result = await db.update({ ...args.query, id }, args.data); // usa o query original + o id
      if (result.length === 0) {
        // escrever console log (acho desnecessário)
        console.error(
          'Could not find any data with that ID'
        );
      }
      return result.length === 0 ? null : result; // devolve o resultado ou null se zero updates
    }

    const res = await db.find({ where: args.query });
    if (res[0]) {
      const result = await db.update(res[0].id, args.data);
      return result;
    } else {
      console.error(
        'Could not find any data with that ID'
      );
      return null;
    }
  },
};

// main export function
const storageDB = async function(args) {
  if (!args || !args.type) {
    throw 'invalid request';
  }
  try {
    const res = await DBActions[args.type](args);
    if (global.gc) {
      global.gc(); // cleanup
    }
    return { result: res };
  } catch (e) {
    console.error(e);
    if (global.gc) {
      global.gc(); // cleanup
    }
    throw e; // throw again so that error propagates
  }
};
module.exports = storageDB;
// configuration for lambda deployment
module.exports.config = {
    cpu: '0.5',
    memory: '2G',
	timeout: 60
};