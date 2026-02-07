'use strict';
/**
 * @name: authorization_codes
 * @desc: Database used for authorization codes
 */
module.exports = function(conn) {
  return {
    identity: 'authorization_codes',
    connection: conn,
    attributes: {
      code: {
        type: 'string',
        index: true
      },
      expiry: {
        type: 'datetime',
        index: true
      },
      user: {
        model: 'users'
      }
    },
    permissions: {
      admin: [],
      user:[]
    }
  };
};