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
    
    querySessionResult = await callFunction('storage-db', querySessionUser, true)
    if (!querySessionResult || !querySessionResult.length) {
      return reject('token does not exist');
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
  const cryptoKey = buildCryptoKey();
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
    roles: roles || [],
    companies: _user.companies || [],
    projects: _user.projects || []
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
    token: tokenData.token,
    key: tokenData.cryptoKey
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
  console.log('checkSessionV2')
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
    decoded = decriptToken(token);
  } catch (e) {
    console.error('error decrpting token', e);
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

  if (!decoded.roles.includes('worker') && !decoded.roles.includes('rest') && !decoded.roles.includes('agi')) {
    // why the or?!
    // querySessionUser.query.or.push({ user: decoded.id });
    querySessionUser.query.user = decoded.id;
  }
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
      crypto_key: querySessionResult && querySessionResult[0] ? querySessionResult[0].crypto_key : null,
      user: querySessionResult && querySessionResult[0] ? querySessionResult[0].user : null,
      worker: querySessionResult && querySessionResult[0] ? querySessionResult[0].worker : null
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

const validateAgi = async function(params) {
  const query = {
    type: 'read',
    table: 'in_agiservers',
    query: {
      ip: params.ip,
      mac: params.mac
    }
  };
  try {
    const result = await callFunction('storage-db', query, true);
    if (result && result[0]) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    console.error(e);
    return false;
  }
};

const _validateChatbotRequest = async function(req = { body: {} }) {
  let isKeyValid = false;
  const data = req.body || {}; // Will throw later and

  try {
    if (!data.apiKey) {
      throw 'Missing API key';
    }
    if (!data.project && !data.channelToken) {
      throw 'Missing project or channel reference';
    }
    if (!data.machineUuid) {
      throw 'Missing identifier';
    }
    if (data.project && typeof data.project !== 'number') {
      throw 'Project must be a integer';
    }

    if (data.project) {
      let project = await callFunction('storage-db', {
        type: 'read',
        query: { id: data.project },
        attributes: ['api_keys'],
        table: 'projects'
      }, true);

      project = project[0];

      if (!project) {
        throw 'Project seems that does not exist anymore';
      }
      if (!project.api_keys) {
        throw 'you need to create a api key for that project first';
      }

      project.api_keys.forEach(k => {
        if (encryption.oneWayEncrypt(k.key) === data.apiKey) {
          isKeyValid = k.key;
        }
      });
      if (!isKeyValid) {
        throw 'invalid api key';
      }

      const key = isKeyValid;
      // Return data to be handled
      return { data, key };
    } else {
      let query;

      query = await callFunction('storage-db', {
        type: 'read',
        query: {
          key: data.apiKey
        },
        // attributes: ['project'],
        table: 'api_keys'
      }, true);

      if (!query || !query[0]) {
        console.error('api key', data.apiKey, ' doesnt seem to exist in database');
        throw 'invalid api key';
      }
      if (!query[0].project) { throw 'Invalid project'; }

      const project = query[0].project;

      query = await callFunction('storage-db', {
        type: 'read',
        query: {
          token: data.channelToken
        },
        // attributes: ['am_module'],
        table: 'am_channel_tokens'
      }, true);

      if (!query[0]) { throw 'invalid channel token'; }
      if (!query[0].am_module) { throw 'Invalid module'; }

      data.project = project;
      data.module = query[0].am_module;

      const key = data.apiKey;

      return { data, key };
    }
  } catch (e) {
    console.error(e);
    throw e;
  }
};

const buildToken = async function(_user, config) {
  let relationships = {};
  // console.log('## _user ##', _user);
  if (_user.data) {
    relationships = _user.relationships;
    _user = _user.data;
  }

  try {
    _user.roles = relationships.roles.data.map(el => el.id);
  } catch (ex) {}

  try {
    _user.companies = relationships.companies.data.map(el => el.id);
  } catch (ex) {}

  try {
    _user.projects = relationships.projects.data.map(el => el.id);
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
      token: queryResult[0].token,
      key: queryResult[0].crypto_key
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

const buildAgiToken = async function(params, config) {
  if (!config) { config = {}; }
  const ip = params.ip || null;
  const mac = params.mac || null;
  if (!ip || !mac) {
    throw { status: 403, result: { error: 'Forbidden' } };
  }

  const validated = await validateAgi(params);
  if (!validated) {
    throw { status: 403, result: { error: 'Forbidden' } };
  }

  const reference = ip + '_' + mac;
  const tokenPayload = {
    id: reference,
    ip: params.ip,
    mac: params.mac,
    roles: ['agi']
  };
  const tokenData = buildTokenData(tokenPayload);
  try {
    const updateSessionQuery = {
      type: 'write',
      table: 'sessions',
      data: {
        reference,
        token: tokenData.token,
        crypto_key: tokenData.cryptoKey,
        token_expiry_date: tokenData.token_expiry_date,
        crypto_key_expiry_date: tokenData.crypto_key_expiry_date,
        rf: tokenData.rf
      }
    };
    await callFunction('storage-db', updateSessionQuery, true);
    return { data: { token: tokenData.token, crypto: tokenData.cryptoKey } };
  } catch (ex) {
    console.error('agi build token get session try catch exception', ex);
    throw ex;
  }
};


const buildCallbackToken = async function(expirySeconds) {
  const config = {};
  const ip = '1';
  const mac = '1';
  const reference = ip + '_' + mac;
  const tokenPayload = {
    id: reference,
    ip,
    mac,
    roles: ['rest']
  };
  const tokenData = buildTokenData(tokenPayload, expirySeconds);
  try {
    const updateSessionQuery = {
      type: 'write',
      table: 'sessions',
      data: {
        reference,
        token: tokenData.token,
        crypto_key: tokenData.cryptoKey,
        token_expiry_date: tokenData.token_expiry_date,
        crypto_key_expiry_date: tokenData.crypto_key_expiry_date,
        rf: tokenData.rf
      }
    };
    await callFunction('storage-db', updateSessionQuery, true);
    return tokenData.token;
  } catch (ex) {
    console.error('API build token get session try catch exception', ex);
    throw ex;
  }
};

const getProjectFromApiKey = async function(key) {
  const payload = {
    type: 'read',
    table: 'api_keys',
    query: {
      key
    }
  };
  const keyData = await callFunction('storage-db', payload, true);
  if (!keyData.length || !keyData[0].project) {
    throw new Error('Invalid Key');
  }
  return keyData[0].project;
};

const buildApiToken = async function(params, config) {
  if (!config) { config = {}; }
  const apiKey = params.apiKey || null;
  if (!apiKey) {
    throw ('shouldnt i have a apiKey??');
  }
  const projectId = await getProjectFromApiKey(apiKey);
  const reference = apiKey;
  const tokenPayload = {
    id: apiKey,
    ip: params.ip,
    mac: params.mac,
    projects: [projectId],
    roles: ['rest']
  };

  const tokenData = buildTokenData(tokenPayload);
  try {
    const createData = {
      token: tokenData.token,
      crypto_key: tokenData.cryptoKey,
      token_expiry_date: tokenData.token_expiry_date,
      crypto_key_expiry_date: tokenData.crypto_key_expiry_date,
      reference,
      rf: tokenData.rf
    };
    const createUpdatePayload = {
      type: 'write',
      table: 'sessions',
      data: createData
    };
    await callFunction('storage-db', createUpdatePayload, true);
    return { data: { token: tokenData.token, crypto: tokenData.cryptoKey } };
  } catch (ex) {
    console.error('agi build token get session try catch exception', ex);
    throw ex;
  }
};

const buildChatbotToken = async function(req, config = {}) {
  try {
    const { data, key } = await _validateChatbotRequest(req);
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0] ||
      req.connection.remoteAddress;

    if (!data) throw { status: 403, result: { error: 'Forbidden' } };

    const reference = ip + '_' + data.machineUuid;
    const tokenPayload = {
      id: reference,
      project: data.project,
      projects: [data.project],
      apiKey: data.apiKey,
      roles: ['rest']
    };

    const tokenData = buildTokenData(tokenPayload);

    const createSessionQuery = {
      type: 'write',
      table: 'sessions',
      data: {
        reference: reference,
        token: tokenData.token,
        crypto_key: tokenData.cryptoKey,
        token_expiry_date: tokenData.token_expiry_date,
        crypto_key_expiry_date: tokenData.crypto_key_expiry_date,
        rf: tokenData.rf
      }
    };

    await callFunction('storage-db', createSessionQuery, true);
    return {
      cognus: encryption.twoWayEncrypt({
          data: {
            token: tokenData.token,
            key: tokenData.cryptoKey,
            user: { id: reference }
          }
        },
        key, { force: true }
      )
    };
  } catch (ex) {
    console.error('build chatbot token try catch exception', ex);
    throw ex;
  }
};

const buildWorkerToken = async function(_worker, config) {
  if (!config) config = {};

  let workerProjects = [];
  if (_worker.projects) {
    workerProjects = _worker.projects;
  } else if (_worker.project) {
    workerProjects = [_worker.project];
  }

  const tokenPayload = {
    id: _worker.id,
    roles: ['worker'],
    companies: _worker.company || null,
    projects: workerProjects
  };
  const tokenData = buildTokenData(tokenPayload);

  try {
    const updateSessionQuery = {
      type: 'write',
      table: 'sessions',
      data: {
        worker: _worker.id,
        token: tokenData.token,
        crypto_key: tokenData.cryptoKey,
        token_expiry_date: tokenData.token_expiry_date,
        crypto_key_expiry_date: tokenData.crypto_key_expiry_date,
        rf: tokenData.rf
      }
    };
    await callFunction('storage-db', updateSessionQuery, true);
  } catch (ex) {
    console.error('worker build token get session try catch exception', ex);
    throw ex;
  }

  return {
    token: tokenData.token,
    key: tokenData.cryptoKey
  };
};

const updateUserToken = async function(user) {
  const newUser = {
    id: user.id,
    roles: user.relationships.roles.data.map(el => el.id),
    companies: user.relationships.companies.data.map(el => el.id),
    projects: user.relationships.projects.data.map(el => el.id)
  };
  const config = {};
  const roles = await getRoles(newUser.roles);
  return createUserToken(newUser, roles, config);
};

const buildChatbotTokenV2 = async function(req, config = {}) {
  try {
    // validate request
    const { data, key } = await _validateChatbotRequest(req);
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0] ||
      req.connection.remoteAddress;

    if (!data) { throw { status: 403, result: { error: 'Forbidden' } }; }

    const reference = ip + '_' + data.machineUuid;

    const tokenPayload = {
      id: reference,
      project: data.project,
      projects: [data.project],
      apliKey: data.apiKey,
      module: data.module,
      roles: ['rest']
    };
    const tokenData = buildTokenData(tokenPayload, 7200);

    const createSessionQuery = {
      type: 'write',
      table: 'sessions',
      data: {
        reference: reference,
        token: tokenData.token,
        crypto_key: tokenData.cryptoKey,
        token_expiry_date: tokenData.token_expiry_date,
        crypto_key_expiry_date: tokenData.crypto_key_expiry_date,
        rf: tokenData.rf
      }
    };

    await callFunction('storage-db', createSessionQuery, true);
    const returnData = {
      project: data.project,
      module: data.module,
      token: tokenData.token,
      key: tokenData.cryptoKey,
      user: { id: reference }
    };
    // Dont encrypt if its dev
    if (process.env.AUTH_STAGE === 'dev') {
      return {
        data: returnData
      };
    }

    return {
      cognus: encryption.twoWayEncrypt({ data: returnData },
        key, { force: true }
      )
    };
  } catch (ex) {
    console.error('build chatbot token try catch exception', ex);
    throw ex;
  }
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
    return { data: { token: activeSession[0].token, crypto: activeSession[0].crypto_key } };
  }
};

const getActiveSession = async function(decoded, console) {
  console = console || origConsole;
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
  console.log('getActiveSession');
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
    switch (type) {
      case 'user':
        payload.query.user = decoded.id;
        break;
      case 'reference':
        payload.query.reference = decoded.id;
        break;
      case 'worker':
        payload.query.worker = decoded.id;
        break;
      default:
        throw ('weird token!?');
    }
    const activeSession = await callFunction('storage-db', payload, true);
    console.log({ activeSession });
    if (activeSession && activeSession.length) {
      return { token: activeSession[0].token, key: activeSession[0].crypto_key };
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
    crypto_key: tokenData.cryptoKey,
    token_expiry_date: tokenData.token_expiry_date,
    crypto_key_expiry_date: tokenData.crypto_key_expiry_date,
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
  return { token: tokenData.token, key: tokenData.cryptoKey };
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