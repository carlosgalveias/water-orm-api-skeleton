'use strict';
module.exports = function (conn) {
  return {
    identity: 'password_history',
    connection: conn,
    attributes: {
      password: {
        type: 'string',
        required: true
      },
      user_id: {
        index: true,
        model: 'users'
      },
    },
    permissions: {
      admin: ['read', 'write', 'delete'],
      user: []
    }
  };
};