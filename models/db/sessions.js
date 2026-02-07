'use strict';

module.exports = function(conn) {
  return {
    identity: 'sessions',
    connection: conn,
    attributes: {
      user: {
        index: true,
        model: 'users',
        unique: true
      },
      old_token: {
        type: 'string',
      },
      token: {
        type: 'string',
        index: true,
      },
      token_expiry_date: {
        type: 'datetime',
        index: true
      },
      rf: {
        type: 'integer',
        size: 256,
        index: true
      }
    },
    // noone can read this model , only local
    permissions: {
      admin: [],
      user: []
    }
  };
};