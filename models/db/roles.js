'use strict';

module.exports = function(conn) {
  return {
    identity: 'roles',
    connection: conn,
    attributes: {
      name: {
        type: 'string'
      },
      description: {
      	type: 'string'
      }
    },
    // noone can read this model , only local
    permissions: {
      admin: ['read','write'],
      user: []
    }
  };
};