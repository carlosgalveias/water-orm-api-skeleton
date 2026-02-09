'use strict';

const jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
const callFunction = require('./util-callFunction.js');
const system = require('./util-system');
const LocalCache = require('./util-localCache');
const constants = require('../config/constants.js');
const tokenHash = constants.TOKEN_HASH || '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';

// For high performant systems, we need to avoid database requests so lets use memory cache here
const cachedTokens = global.cachedTokens || new LocalCache({ timeout: -1, accessTimeout: 600000, label: 'sessionTokenCache', cacheRedis: false, cacheRedisPrefix: 'sessionTokenCache_' });

// Use it locally
global.cachedTokens = cachedTokens;
const origConsole = console;

function buildExpiryDate(totalSeconds) {
  totalSeconds = totalSeconds || constants.TOKEN_EXPIRY_MINUTES * 60; // Token is valid only for 30 minutes by default
  const time = +new Date(); // milliseconds
  const expiryDate = new Date(time + totalSeconds * 1000);
  return {
    date: expiryDate,
    seconds: totalSeconds
  };
}

const validateToken = function(req) {
  const token = req.headers['x-access-token'];
  return new Promise((resolve, reject) => {
    jwt.verify(token, tokenHash, function(err, decoded) {
      if (err) {
        return reject(err);
      } else {
        // if everything is good, save to request for use in other routes
        return resolve(decoded);
      }
    });
  });
};

const checkSession = async function(req) {
  try {
    const token = req.headers['x-access-token'];
    if (!token) {
      console.error('Unexisting token');
      throw new Error('Unexisting token');
    }
    const decoded = await validateToken(req)
    const querySessionUser = {
      type: 'readSort',
      table: 'sessions',
      query: {
        token: token,
        limit: 1
      },
      sort: 'id DESC'
    };
    
    const querySessionResult = await callFunction('storage-db', querySessionUser, true)
    if (!querySessionResult || !querySessionResult.length) {
      throw new Error('token does not exist');
    }
    
    return {
      decoded: decoded,
      token: token,
      user: querySessionResult && querySessionResult[0] ? querySessionResult[0].user : null
    };
  } catch (ex) {
    console.error('Failed to validate token', ex);
    return reject('Failed to validate token');
  }
};

const getSession = function(req, config) {
  return new Promise((resolve, reject) => {
    checkSession(req)
      .then(win => {
        return resolve(win);
      })
      .catch(fail => {
        return reject(fail);
      });
  });
};

function buildTokenData(payload, expirySeconds) {
  /* eslint-disable camelcase */
  expirySeconds = expirySeconds || constants.TOKEN_EXPIRY_MINUTES;
  const date = buildExpiryDate(expirySeconds);
  const rf = new Date().getTime() + 600000; // 10 minute mark
  payload.rf = rf;

  const token = jwt.sign(payload, tokenHash, {
    expiresIn: date.seconds
  });
  const token_expiry_date = date.date.toISOString();
  return { token, token_expiry_date, rf };
  /* eslint-enable camelcase */
}

function resetToken(decoded) {
  delete decoded.rf;
  delete decoded.iat;
  delete decoded.exp;
  return buildTokenData(decoded);
}

const createUserToken = async function(_user, roles, config) {
  const tokenPayload = {
    id: _user.id,
    roles: roles || []
  };
  const tokenData = buildTokenData(tokenPayload);
  const createSessionQuery = {
    type: 'write',
    table: 'sessions',
    data: {
      user: _user.id,
      token: tokenData.token,
      token_expiry_date: tokenData.token_expiry_date,
      rf: tokenData.rf
    }
  };
  await callFunction('storage-db', createSessionQuery, true);
  return {
    token: tokenData.token
  };
};

const validateTokenActive = function(token) {
  return new Promise((resolve, reject) => {
    try {
      jwt.verify(token, tokenHash, function(err, decoded) {
        if (err) {
          return resolve(false);
        } else {
          // if everything is good, save to request for use in other routes
          return resolve(true);
        }
      });
    } catch (e) {
      return resolve(false);
    }
  });
};

const checkSessionV2 = async function(token) {
  console.log('checkSessionV2', "token", token)
  if (!token) {
    throw new Error('No token provided');
  }
  const validToken = await validateTokenActive(token);
  if (!validToken) {
    if (await cachedTokens.has(token)) {
      await cachedTokens.del(token);
    }
    throw new Error('error in token');
  }
  if (await cachedTokens.has(token)) {
    console.log('returned cached token');
    return await cachedTokens.get(token);
  }
  let decoded;
  try {
    decoded = getTokenParams(token);
  } catch (e) {
    console.error('error decoding token', e);
    throw e;
  }
  console.log('decoded at checkSessionV2', decoded);
  const querySessionUser = {
    type: 'readSort',
    table: 'sessions',
    query: {
      // or: [{ token: token }], why a or?!
      token: token,
      limit: 1
    },
    sort: 'id DESC'
  };
  querySessionUser.query.user = decoded.id;
  try {
    // Session tokens are cached but if not exists, getting it will probably crete a new connection
    // in that case it will take from 1 to 2s so chances are that if we call storage-db externally
    // it is faster, so dont use true here
    const querySessionResult = await callFunction(
      'storage-db',
      querySessionUser,
      true
    );
    if (!querySessionResult || !querySessionResult.length) {
      throw ('token does not exist');
    }
    await cachedTokens.add(token, {
      decoded: decoded,
      token: querySessionResult && querySessionResult[0] ? querySessionResult[0].token : token,
      user: querySessionResult && querySessionResult[0] ? querySessionResult[0].user : null
    });
    return await cachedTokens.get(token);
  } catch (e) {
    console.error('error caught at calling storage-db at checkSessionV2', e);
    throw e;
  }
};

const getTokenParams = function(token) {
  return jwt.decode(token);
};

const getRoles = async function(_roles = []) {
  if (!_roles || !_roles.length) {
    return [];
  }
  const getRolesQuery = {
    type: 'read',
    table: 'roles',
    query: {
      id: _roles
    }
  };
  const queryResult = await callFunction('storage-db', getRolesQuery, true);
  try {
    if (queryResult) {
      return queryResult.map(el => el.name);
    } else {
      return [];
    }
  } catch (ex) {
    return [];
  }
};

const buildToken = async function(_user, config) {
  let relationships = {};
  console.log('## _user ##', _user);
  if (_user.data) {
    relationships = _user.relationships;
    _user = _user.data;
  }

  try {
    _user.roles = relationships.roles.data.map(el => el.id);
  } catch (ex) {}

  if (!config) { config = {}; }

  const roles = await getRoles(_user.roles);
  const getSessionQuery = {
    type: 'readSort',
    table: 'sessions',
    query: {
      user: _user.id,
      limit: 1
    },
    sort: 'id DESC'
  };
  const queryResult = await callFunction('storage-db', getSessionQuery, true);
  if (queryResult && queryResult[0] && await validateTokenActive(queryResult[0].token)) {
    return {
      token: queryResult[0].token
    };
  } else {
    // if everything is good, save to request for use in other routes
    const newData = await createUserToken(
      _user,
      roles,
      config
    );
    return newData;
  }
};

const updateUserToken = async function(user) {
  const newUser = {
    id: user.id,
    role: user.relationships.roles.data.map(el => el.id)
  };
  const config = {};
  const roles = await getRoles(newUser.roles);
  return createUserToken(newUser, roles, config);
};

const getActiveSessionByReference = async function(reference, console) {
  if (!reference) {
    throw new Error('missing reference');
  }
  console = console || origConsole;
  const payload = {
    type: 'readSort',
    table: 'sessions',
    query: {
      reference,
      rf: { '>': new Date().getTime() },
      limit: 1
    },
    sort: 'id DESC'
  };
  console.log({ payload });
  const activeSession = await callFunction('storage-db', payload, true);
  console.log('after callFunction');
  console.log({ activeSession });
  if (activeSession && activeSession[0]) {
    return { data: { token: activeSession[0].token} };
  }
};

const getActiveSession = async function(decoded, console) {
  try {
    const payload = {
      type: 'readSort',
      table: 'sessions',
      query: {
        rf: { '>': new Date().getTime() },
        limit: 1
      },
      sort: 'id DESC'
    };
    payload.query.user = decoded.id;
    const activeSession = await callFunction('storage-db', payload, true);
    console.log({ activeSession });
    if (activeSession && activeSession.length) {
      return { token: activeSession[0].token };
    }
  } catch (e) {
    console.error(e);
  }
  return null;
};

const changeToken = async function(req) {
  const decoded = req.decoded;
  const tokenData = resetToken(decoded);
  let type;
  if (decoded.roles[0] === 'worker') {
    type = 'worker';
  } else if (decoded.roles[0] === 'agi') {
    type = 'reference';
  } else if (decoded.roles[0] === 'rest') {
    type = 'reference';
  } else if (decoded.roles[0] === 'api') {
    type = 'reference';
  } else if (userRoles.includes(decoded.roles[0])) {
    type = 'user';
  }
  const sessionPayload = {
    token: tokenData.token,
    token_expiry_date: tokenData.token_expiry_date,
    rf: tokenData.rf
  };
  switch (type) {
    case 'user':
      sessionPayload.user = decoded.id;
      break;
    case 'reference':
      sessionPayload.reference = decoded.id;
      break;
    case 'worker':
      sessionPayload.worker = decoded.id;
      break;
    default:
      throw ('weird token!?');
  }
  const payload = {
    type: 'write',
    table: 'sessions',
    data: sessionPayload
  };
  await callFunction('storage-db', payload, true);
  return { token: tokenData.token };
};
const refreshSession = async function(req) {
  const console = req.console || origConsole;
  // check if our token already has a refresh token
  // if not check db and put in cache
  // if not create refresh token and put in cache
  console.log('refreshing session');
  const token = req.headers['x-access-token'];
  const cached = await cachedTokens.has(token) ? await cachedTokens.get(token) : null;
  if (cached && cached.refreshToken && cached.refreshToken.rf > +new Date().getTime()) {
    console.log('returning cached token');
    return cached.refreshToken;
  } else {
    console.log('getting active sessions');
    let refreshToken = await getActiveSession(req.decoded, console);
    if (!refreshToken) {
      console.log('no active session , generating new token pair');
      refreshToken = await changeToken(req);
    }
    cached.refreshToken = refreshToken;
    await cachedTokens.add(token, cached);
    return refreshToken;
  }
};

const session = {
  getTokenParams: getTokenParams,
  validateToken: validateToken,
  checkSession: checkSessionV2,
  getSession: getSession,
  getActiveSessionByReference,
  buildToken: buildToken,
  updateUserToken: updateUserToken,
  refreshSession
};

module.exports = session;