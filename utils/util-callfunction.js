'use strict';
const sys = require('./util-system');
const storageDB = require('../controllers/storage-db.js');
const constants = require('../config/constants.js');

const localRequest = async function (name, args, nonBlocking) {
    if (!name) {
      throw new Error('no function name to call?!');
    }
    try {
      let fn = fns[name];
      if (!fn) {
        fn = require(path.join(__dirname, '..', 'controllers', name + '.js'));
        fns[name] = fn;
      }
      if (!nonBlocking || process.env.RUNNING_TESTS) {
        return await fn(args);
      } else {
        fn(args);
        return { success: true };
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

const makeCall = async function(local, params) {
  // If the function is going to be invoked using HTTPS (like a lambda) 
  if (!local) {
    const name = params.name;
    if (params.nonBlocking) { // This means that its send and forget, we dont care about the response
      // If nonBlocking just call fetch and return
      fetch(constants.FUNCTION_URL.replace('<FunctionName>', name), {
        method: 'post',
        body: JSON.stringify(params.params),
        headers: { 'Content-Type': 'application/json' },
      });
      return { success: true };
    }

    const response = await fetch(constants.FUNCTION_URL.replace('<FunctionName>', name), {
      method: 'post',
      body: JSON.stringify(params.params),
      headers: { 'Content-Type': 'application/json' },
    });
    return await response.json();
  }
  return await localRequest(params.name, params.params, params.nonBlocking);
};

const callFunction = async function(
  service,
  args,
  direct = true,
  nonBlocking = false,
  isFn = false
) {
  //console.log('callfunction->', { service, direct, nonBlocking, isFn, isCE });
  try {
    let local;
    // if local use require, if not local it should call a lambda (TODO)
    if ( direct || process.env.RUNNING_TESTS ||process.env.RUNNING_LOCALLY ) {
      local = true;
    } else {
      local = false;
    }
    try {
      const data = await makeCall(local, {
        name: service,
        nonBlocking,
        isFn,
        params: args,
      });
      return data && (data.result || data.result === null) ? data.result : data;
    } catch (e) {
      console.error('callfunction->catch', {
        message: e.message,
        status: e.status || e.statusCode,
      });
      throw e;
    }
  } catch (e) {
    console.error('callFunction->catch->final', e);
    throw e;
  }
};

module.exports = callFunction;