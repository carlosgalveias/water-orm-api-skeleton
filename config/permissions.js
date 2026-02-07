'use strict';
const fs = require('fs');
const path = require('path');

// All routes that require no authentication to acess
const unauthenticatedRoutes = [
  '/',
  '/letmein',
  '/user-security',
  '/ping'
];

Object.freeze(unauthenticatedRoutes);

/**
 * 0 - Permission Rules Below
 */

// Default permission rules
const defaultRules = {
  admin: ['read', 'write', 'delete'],
  user: ['read','write']
};

// you can define some custom rules for your custom routers
const rules = {
	examplerouter: {
		admin: ['read', 'write', 'delete'],
  		user: ['read','write']
	}
}


  const parseDbRules = function () {
    const basePath = path.join(__dirname, '../models/db/');
    fs.readdirSync(basePath).forEach(function (file) {
      if (!file.match(/\.js$/)) {
        return;
      }
      file = file.replace('.js', '');
      const model = require(basePath + file)();
      
      if (model.permissions) {
        rules[file] = model.permissions;
      }
    });
  };

  const parseRouterRules = function () {
    const basePath = path.join(__dirname, '../routers/');
    fs.readdirSync(basePath).forEach(function (file) {
      if (!file.match(/\.js$/)) {
        return;
      }
      file = file.replace('.js', '');
      
      const router = require(basePath + file);
      if (router.permissions) {
        rules[file] = router.permissions;
      }
    });
  };

parseDbRules();
parseRouterRules();

// What are constraints, imagine you want to get all invoices, so you make a get to
// the table 'invoice' but you want it to ONLY return the invoices of the user and not the otherones
// in the same sense, you may be an admin and want the entire list of invoices of all users
// These are the contraints that enforce this regardless of the query that comes.
// So if the user is a motherfucker and wants to get invoices of other ids, even tought the query is right, it wont be able to!!
// might not be how the model uses it the attribute
const selfUserConstraint = ['id', 'id'];
const userConstraint = ['user','id'];

const queryConstraints = {
  admin: {
  },
  user: {
  	users: selfUserConstraint, // I can see only myself
  	invoices: userConstraint
  },
};

module.exports = {
  unauthenticatedRoutes,
  permissionTable: {
    getAccessRights(model, role) {
      let accessRight;

      try {
        accessRight = rules[model][role];
      } catch (ex) {
        accessRight = defaultRules[role];
      }

      return accessRight;
    },
    getQueryConstraint(role, model) {
      try {
        return queryConstraints[role][model];
      } catch (ex) {
        return null;
      }
    },
    parseMethodAccess(method) {
      switch (method.toLowerCase()) {
        case 'get':
          return 'read';
        case 'post':
        case 'patch':
          return 'write';
        case 'delete':
          return 'delete';
      }
    },
  },
};
