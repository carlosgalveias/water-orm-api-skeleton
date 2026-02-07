'use strict';
module.exports = function (conn) {
  return {
    identity: 'users',
    connection: conn,
    attributes: {
      name: {
        type: 'string',
        index: true
      },
      password: {
        type: 'string',
        required: true
      },
      email: {
        type: 'string',
        unique: true,
        index: true
      },
      // login attempts track
      attempts: {
        type: 'integer'
      },
      lastattempt: {
        type: 'datetime'
      },
      full_name: { type: 'string' },
      // base 64 avatar
      avatar: { type: 'string' },
      roles: {
        index: true,
        model: 'roles'
      },
      state: {
        type: 'string',
        enum: ['active', 'inactive'],
        defaultsTo: 'inactive',
        index: true
      }
    },
    // roler permissions for this table
    permissions: {
      admin: ['read', 'write', 'delete'],
      user: ['read', 'write']
    }
  };
};