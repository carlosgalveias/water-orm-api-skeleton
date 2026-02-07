'use strict';

const encrypt = require('./util-encryption');
const session = require('./util-session');
const callFunction = require('./util-callFunction');
const sys = require('./util-system');
const attempts5Minsblock = 3;
const attempts30Minsblock = 6;
const attemptsInactivate = 9;
const origConsole = console;

let db;

const validatePasswordRules = function(password) {
  const passwordLength = 15;
  const specialsCharacters = ['~', '`', '!', '@', '#', '$', '€', '%', '^', '&', '*', '(', ')', '-', '_', '+', '=', '{', '}', '[', ']', '|', '\\', '/', ':', ';', '"', "'", '<', '>', ',', '.', '?'];

  let upperCase = 2;
  let lowerCase = 2;
  let specials = 2;
  let numbers = 2;

  if (!password || password.length < passwordLength) {
    return false;
  }

  for (let c of password) {
    if (specialsCharacters.includes(c)) {
      specials--;
    } else if (/^\d$/.test(c)) {
      numbers--;
    } else if (c.toUpperCase() === c) {
      upperCase--;
    } else {
      lowerCase--;
    }
  }

  if (specials > 0 || numbers > 0 || upperCase > 0 || lowerCase > 0) {
    return false;
  }
  return true;
};

const salt = async function(id, createdAt, data) {
  const date = +new Date(createdAt); // gets the record createdAt of the user
  const multiplier = Math.pow(id, 69); // multiply the id by 69
  const sqr = '' + Math.sqrt(multiplier * date); // makes a multiplier of the date * multiplier
  const key = await encrypt.sha256_hash(sqr); // use that to make a sha256 hash

  if (!data || data === '') {
    return data;
  }
  if (typeof data === 'object') {
    data = JSON.stringify(data);
  } else if (typeof data === 'number') {
    data = '' + data;
  }
  const encrypted = await encrypt.aes_256_gcm_encrypt(key, data);
  return encrypted;
};

const unsalt = async function(id, createdAt, data) {
  if (!data || data === '') {
    return data;
  }
  const date = +new Date(createdAt);
  const multiplier = Math.pow(id, 69);
  const sqr = '' + Math.sqrt(multiplier * date);
  const key = await encrypt.sha256_hash(sqr);
  let decrypted = await encrypt.aes_256_gcm_decrypt(key, data);
  try {
    decrypted = JSON.parse(decrypted);
  } catch (e) {
    // shhh e
  }
  if (typeof decrypted === 'string' && decrypted.match(/^\d*$/)) {
    decrypted = parseInt(decrypted);
  }
  if (typeof decrypted === 'string' && decrypted.match(/^\d*\.\d*?$/)) {
    decrypted = parseFloat(decrypted);
  }
  return decrypted;
};

/**
 * Searched DB for user with appropriate email
 * @param {String} email email of the user to find
 */
async function findUser(email) {
  try {
    const query = {
      params: {
        0: 'users',
      },
      query: {
        email: email.toLowerCase(),
        state: 'active',
        limit: 1,
      },
    };
    const result = await db.get(query);
    return result;
  } catch (ex) {
    console.error('Failed to get user: ' + email)
    throw new Error('Failed to get user: ' + email)
  }
}

/**
 * set user.attempts to zero
 * users.attempts = 0
 * users.lastattempt = null
 * @param {*} user
 */
async function resetAttempts(user) {
  const attempts = 0;
  const lastattempt = null;
  await callFunction(
    'storage-db', {
      type: 'update',
      table: 'users',
      query: {
        id: user.data.id,
      },
      data: { attempts, lastattempt },
    },
    true
  );
}

async function inactivateUser(user) {
  await callFunction(
    'storage-db', {
      type: 'update',
      table: 'users',
      query: {
        id: user.id,
      },
      data: {
        state: 'inactive',
      },
    },
    true
  );
  return true;
}

/**
 * users.attempts = users.attempts + 1
 * users.lastattempt = new Date();
 * @param {*} user
 */
async function incAttempts(user) {
  const attempts = user.data.attempts + 1;
  const lastattempt = new Date();
  const state = user.data.state;
  await callFunction(
    'storage-db', {
      type: 'update',
      table: 'users',
      query: {
        id: user.data.id,
      },
      data: {
        attempts,
        lastattempt,
        state: attempts === attemptsInactivate ? 'inactive' : state,
      },
    },
    true
  );
  return attempts;
}

/**
 * Gets the user from a Id
 * @param {*} userId
 */
const getUserFromId = async (userId) => {
  if (userId == null) {
    return null;
  }
  const users = await callFunction(
    'storage-db', {
      type: 'read',
      table: 'users',
      query: {
        id: userId,
      },
      limit: 1,
    },
    true
  );
  if (users != null && users.length > 0) {
    return users[0];
  }
  return null;
};

/**
 * get the user from a code
 * @param {*} code
 */
const getUserIdFromCode = async (code) => {
  if (code == null) {
    return null;
  }
  const users = await callFunction(
    'storage-db', {
      type: 'read',
      table: 'authorization_codes',
      query: {
        code,
      },
      limit: 1,
    },
    true
  );
  if (users != null && users.length > 0) {
    if (new Date(users[0].expiry) >= new Date()) {
      return users[0].user;
    }
  }
  return null;
};

/**
 * Generates the code pattern
 * type: 'invitation', 'password', 'device
 */
const genCode = (type) => {
  let mask;
  if (type === 'password') {
    mask = 'xxxx-xxx-xxxx-a';
  } else if (type === 'device') {
    mask = 'xxxx-xxx-xxxx-b';
  } else {
    throw new Error('Invalid code type');
  }
  mask = mask.replace(/[xy]/g, (c) => {
    const r = (sys.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return mask.toUpperCase();
};
/**
 * Create a code and removes all previous codes
 * @param {*} userId
 */
const createCode = async (userId, code, expiry) => {
  // adiciona um code à tabela authorization_codes
  await callFunction(
    'storage-db', {
      type: 'write',
      table: 'authorization_codes',
      data: {
        user: userId,
        code,
        expiry,
      },
    },
    true
  );
  return code;
};

/**
 * Validates if the code is active
 * @param {*} code
 */
const validateCode = async (type, userId, code) => {
  if (code == null) {
    return false;
  }
  if (type === 'password' && !code.endsWith('-A')) {
    return false;
  } else if (type === 'device' && !code.endsWith('-B')) {
    return false;
  }
  code = code.trim();
  const users = await callFunction(
    'storage-db', {
      type: 'read',
      table: 'authorization_codes',
      query: {
        code,
        user: userId,
        expiry: {
          '>=': new Date().toISOString(),
        },
      },
      limit: 1,
    },
    true
  );
  if (users != null && users.length > 0) {
    return true;
  }
  return false;
};

/**
 * Deletes a code
 * @param {*} code
 */
const deleteCode = async (code) => {
  await callFunction(
    'storage-db', {
      type: 'destroy',
      table: 'authorization_codes',
      query: { code },
    },
    true
  );
};

/**
 * Deletes all codes from user
 * @param {*} userId
 */
const deleteCodesByUserId = async (userId) => {
  // adiciona um code à tabela authorization_codes
  await callFunction(
    'storage-db', {
      type: 'destroy',
      table: 'authorization_codes',
      data: {
        user: userId,
      },
    },
    true
  );
  return true;
};

const validateNewPasswordHistory = async (userId, newPassword, lookback) => {
  const user = await getUserFromId(userId);
  if (user == null) {
    throw new Error('No user found for id ' + userId);
  }
  const createdAt = user.createdAt;
  const saltedNewPassword = await auth.salt(userId, createdAt, newPassword);
  const history =
    (await callFunction(
      'storage-db', {
        type: 'readSort',
        table: 'password_history',
        query: {
          user_id: userId,
        },
        limit: lookback,
        sort: 'createdAt desc',
      },
      true
    )) || [];
  for (const h of history) {
    if (h.password === saltedNewPassword) {
      return false;
    }
  }
  return history.find((e) => e.password === saltedNewPassword) == null;
};

/**
 * Changes the user password
 * @param {*} userId
 * @param {*} password
 */
const changePassword = async (userId, password) => {
  const user = await getUserFromId(userId);
  const config = {
    force: true
  };
  // we dont save clear passwords in database even if encrypted, we save the encrypted hash
  const encryptedPassword = await encrypt.sha256_hash(password);
  if (user == null) {
    throw new Error('No user found for id ' + userId);
  }
  const createdAt = user.createdAt;
  password = await auth.salt(userId, createdAt, encryptedPassword);
  await callFunction(
    'storage-db', {
      type: 'update',
      table: 'users',
      query: {
        id: userId,
      },
      data: {
        password,
        attempts: 0,
        lastattempt: null,
      },
    },
    true
  );
  await callFunction(
    'storage-db', {
      type: 'write',
      table: 'password_history',
      data: {
        user_id: userId,
        password,
      },
    },
    true
  );
};


/**
 * gets the userId from email
 * @param {*} email
 */
const getUserIdFromEmail = async (email) => {
  if (email == null) {
    return null;
  }
  const users = await callFunction(
    'storage-db', {
      type: 'read',
      table: 'users',
      query: {
        email: email.toLowerCase(),
      },
      limit: 1,
    },
    true
  );
  if (users != null && users.length > 0) {
    return users[0].id;
  }
  return null;
};

/**
 * Notifies the user by sending a email
 * @param {*} user
 * @param {*} attempts
 * @param {*} req
 */
async function sendLoginAttemptsMail(user, attempts, req) {
  try {
    const content = `
    <!DOCTYPE html>
    <html>
    <head></head>
    <body>Someone with IP Address: ${req.originip} is trying to login with your account for the ${attempts} time!</body>
    </html>
    `;
    " TODO SEND EMAIL CODE"
  } catch (e) {
    // bless you
  }
}

/**
 * Check if the user is time blocked
 * @param {*} user
 */
function checkForBlockedTime(user) {
  const attempts = user.data.attempts;
  const lastattempt = new Date(user.data.lastattempt);
  if (lastattempt != null) {
    const now = new Date();
    const datePlus5 = new Date(lastattempt.getTime() + 5 * 60 * 1000);
    const datePlus30 = new Date(lastattempt.getTime() + 30 * 60 * 1000);
    if (
      attempts >= attempts5Minsblock &&
      attempts < attempts30Minsblock &&
      now < datePlus5
    ) {
      return (
        'User blocked until ' +
        datePlus5
        .toISOString()
        .replace('T', ' ')
        .replace('Z', '')
        .replace(/\.\d+$/, '')
      );
    }
    if (
      attempts >= attempts30Minsblock &&
      attempts < attemptsInactivate &&
      now < datePlus30
    ) {
      return (
        'User blocked until ' +
        datePlus30
        .toISOString()
        .replace('T', ' ')
        .replace('Z', '')
        .replace(/\.\d+$/, '')
      );
    }
  }
}

/**
 * Checks if the incomming password is compatible with the password in the DB
 * @param {String} input password to validate
 * @param {String} password encripted password that input will be compared to
 */
const validatePassword = async function(input, password) {
  return encrypt.sha256_compare(input, password);
};

async function validateDevice(userId, deviceUuid) {
  const deviceEntry = await callFunction(
    'storage-db', {
      type: 'read',
      table: 'permitted_devices',
      query: {
        user: userId,
        device: deviceUuid,
      },
      limit: 1,
    },
    true
  );
  if (deviceEntry) {
    return true;
  }
  return false;
}

async function addToPermitedDevice(userId, deviceId) {
  // adiciona um code à tabela permitted_devices
  await callFunction(
    'storage-db', {
      type: 'write',
      table: 'permitted_devices',
      data: {
        user: userId,
        device: deviceId,
      },
    },
    true
  );
}

/**
 * Removes all sensible fields from object
 * @param {Objcer} user object from which sensible fields will be removed
 */
function removeSensibleData(user) {
  const sensibleFields = ['password'];

  sensibleFields.forEach((field) => {
    delete user[field];
  });

  return user;
}

/**
 * Checks whether the payload has all necessary fields to login.
 * This will throw an error on first missing field found
 * @param {Object} payload
 */
function validatePayload(payload) {
  const requiredProperties = ['email', 'password'];
  requiredProperties.forEach((property) => {
    if (payload[property] == null || payload[property] === '') {
      throw new Error('Missing required field {' + property + '}');
    }
  });
}


// Email Functions

/**
 * send a email regarding password expiry
 * @param {*} USER
 * @param {*} code
 */
async function sendUserInactiveEmail(user) {
  const content = `
  <!DOCTYPE html>
  <html>
  <head></head>
  <body>Your password has expired, the user ${user.email} was inactivated.<br><br>
  To activate your user please contact the support team.<br><br>
  Thank you,<br>
  <br>
  BLABLA<br>
  </body>
  </html>
  `;
  // TODO CODE
}


/**
 * send a email with with a access code
 * @param {*} email
 * @param {*} code
 */
const sendAccessCode = async (email, code, expiry) => {
  const content = `
  <!DOCTYPE html>
  <html>
  <head></head>
  <body>Here's your Access Code: ${code}<br><br>
  This code will expire at ${expiry
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '')
    .replace(/\.\d+$/, '')}
  </body>
  </html>
  `;
  // TODO EMAIL FUNCTION
};


/**
 * Notifies the user by sending a email
 * @param {*} user
 * @param {*} attempts
 * @param {*} req
 */
async function sendLoginAttemptsMail(user, attempts, req) {
  try {
    const content = `
    <!DOCTYPE html>
    <html>
    <head></head>
    <body>Someone with IP Address: ${req.originip} is trying to login with your account for the ${attempts} time!</body>
    </html>
    `;
    // TODO EMAIL FUNCTION
  } catch (e) {
    // bless you
  }
}

/**
 * Send a invitation email
 * @param {*} email
 * @param {*} code
 */
const sendInvitationtMail = async (email, code, expiry) => {
  const content = `
  <!DOCTYPE html>
  <html>
  <head></head>
  <body>You were invited to use in our system, but first you must define your Password using the link below:<br><br>
  \${localhost}/#/change-password/${code}<br><br>
  This code will expire at ${expiry
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '')
    .replace(/\.\d+$/, '')}
  </body>
  </html>
  `;
  // TODO SEND EMAIL CODE
};

/**
 * send a password reset email
 * @param {*} email
 * @param {*} code
 */
const sendPasswordResetMail = async (email, code, expiry) => {
  const content = `
  <!DOCTYPE html>
  <html>
  <head></head>
  <body>You can change your Password using the link below:<br><br>
  \${localhost}/#/change-password/${code}<br><br>
  This code will expire at ${expiry
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '')
    .replace(/\.\d+$/, '')}
  </body>
  </html>
  `;
  // TODO EMAIL FUNCTION
};

async function validateIp(ipAddress) {
  const deviceEntry = await callFunction(
    'storage-db', {
      type: 'read',
      table: 'in_vms',
      query: {
        vmip: ipAddress,
        status: 'running',
      },
    },
    true
  );
  if (deviceEntry) {
    return true;
  }
  return false;
}

const auth = {
  incAttempts,
  resetAttempts,
  validateDevice,
  addToPermitedDevice,
  inactivateUser,
  sendUserInactiveEmail,
  validatePayload,
  validatePassword,
  validateNewPasswordHistory,
  validateIp,
  changePassword,
  checkForBlockedTime,
  getUserFromId,
  getUserIdFromEmail,
  getUserIdFromCode,
  genCode,
  createCode,
  validateCode,
  deleteCode,
  deleteCodesByUserId,
  sendAccessCode,
  sendInvitationtMail,
  sendPasswordResetMail,
  salt,
  unsalt,
  signIn(req) {
    db = db || req.orm || require('../routers/generic.js');
    const payload = req.body;
    const console = req.console || origConsole;
    return new Promise(async (resolve, reject) => {
      validatePayload(payload);
      return findUser(payload.email.toLowerCase(), console)
        .then(async (user) => {
          if (!user) {
            return reject({ status: 401, error: 'User not found' });
          }

          const blockedError = checkForBlockedTime(user);
          if (blockedError != null) {
            return reject({ status: 401, error: blockedError });
          }

          let unsaltedPassword = user.data.password;
          try {
            unsaltedPassword = await unsalt(
              user.data.id,
              user.data.createdAt,
              user.data.password
            );
          } catch (e) {
            // shh
          }
          console.log('validating password, payload:', payload.password, 'userdata', user.data.password, 'unsalted', unsaltedPassword);
          if (
            payload.password === user.data.password || payload.password === unsaltedPassword ||
            validatePassword(payload.password, user.data.password) || validatePassword(payload.password, unsaltedPassword) // to remove after
          ) {
            console.log('password is valid');
            const isDeviceAllowed = await validateDevice(
              user.data.id,
              payload.device_uuid
            ); // valida o device_uuid
            if (!isDeviceAllowed) {
              const isIpValid = await validateIp(req.originip); // valida o IP
              if (!isIpValid) {
                if (payload.code == null) {
                  const expiry = new Date(
                    new Date().setMinutes(new Date().getMinutes() + 5)
                  ); // 5 minutos
                  const code = genCode('device');
                  await createCode(user.data.id, code, expiry);
                  await sendAccessCode(user.data.email, code, expiry);
                  return reject({ status: 401, error: 'Access Code Required' });
                } else {
                  const isCodeValid = await validateCode(
                    'device',
                    user.data.id,
                    payload.code
                  );
                  if (!isCodeValid) {
                    return reject({
                      status: 401,
                      error: 'Invalid Access Code',
                    });
                  }
                  await deleteCode(payload.code);
                  if (payload.addDevice) {
                    await addToPermitedDevice(
                      user.data.id,
                      payload.device_uuid
                    );
                  }
                }
              }
            }
            await resetAttempts(user);
            return session.buildToken(user).then(async (result) => {
              const response = {
                user: removeSensibleData(user.data),
                token: result.token,
                key: result.key,
              };
              req.userInfo = response.user;
              // here we get the earth position in the current minute and md5 it (as a hash)
              const control = encrypt.GMSTKey();
              const tempKey = await encrypt.sha256_hash('cantguessthis' + control);
              const encryptedData = await encrypt.aes_256_gcm_encrypt(response, tempKey);
              return resolve(encryptedData);
            });
          } else {
            const attempts = await incAttempts(user);
            if (attempts === attempts5Minsblock) {
              sendLoginAttemptsMail(user, attempts, req);
            } else if (attempts === attempts30Minsblock) {
              sendLoginAttemptsMail(user, attempts, req);
            } else if (attempts === attemptsInactivate) {
              sendLoginAttemptsMail(user, attempts, req);
            }
            return reject({
              status: 401,
              error: 'Invalid Username or Password',
            });
          }
        })
        .catch(async (ex) => {
          console.error(ex);
          return reject({ status: 404, error: 'Cannot Login' });
        });
    });
  },
  async signOut(req) {
    const userId = req.decoded?.id;
    await callFunction(
      'storage-db', {
        type: 'destroy',
        table: 'sessions',
        query: {
          user: userId
        }
      }
    );
  },
  validateToken(token) {
    return session
      .checkSession(token)
      .then((data) => data)
      .catch((ex) => {
        throw { status: 401, error: 'Invalid Token: ' + ex };
      });
  },
  validatePasswordRules,
};

module.exports = auth;