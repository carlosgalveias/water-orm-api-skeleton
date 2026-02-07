'use strict';
/**
 * @name: permitted_devices
 * @desc: Database used for permitted devices
 */
module.exports = function(conn) {
  return {
    identity: 'permitted_devices',
    connection: conn,
    attributes: {
      device: {
        type: 'string',
        index: true
      },
      user: {
        model: 'users'
      }
    },
    permissions: {
      admin: [],
      user: []
    }
  };
};