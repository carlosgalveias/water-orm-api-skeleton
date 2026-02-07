'use strict';

// Requirements
const authCtrl = require('../utils/util-auth');

const letmein = {
  async post(req, res) {
    console.log('[DEBUG] Trying to Sign In');
    try {
      const result = await authCtrl.signIn(req);
      console.log('[DEBUG] Sign In successful: ');
      return res({ status: 200, result: { data: result } });
    } catch (ex) {
      console.log('[ERROR] Erro while trying to Sign In: ', ex);
      return res({ status: ex.status, result: ex });
    }
  }
};

module.exports = letmein;