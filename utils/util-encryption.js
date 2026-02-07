'use strict'


const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');


function getJulianDate() {
    const now = new Date();
    const utcMillis = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds(),
        now.getUTCMilliseconds()
    );
    return utcMillis / 86400000 + 2440587.5;
}

function getGMST(jd) {
    const T = (jd - 2451545.0) / 36525;
    const theta0 = 280.46061837 
               + 360.98564736629 * (jd - 2451545.0) 
               + 0.000387933 * T * T 
               - (T * T * T) / 38710000.0;

    return ((theta0 % 360) + 360) % 360; // Normalize to [0,360]
}

function getGMSTKey() {
    const jd = getJulianDate();
    const gmst = getGMST(jd);
    
    // Convert GMST to minutes and round to the nearest 2-minute interval
    const gmstMinutes = Math.round((gmst * 60 / 15) / 2) * 2; // 1 hour = 15° in GMST

    return gmstMinutes.toString(); // Key as string
}


/**
 * Modern Async Cipher using AES-256-GCM (Authenticated Encryption)
 */
const aes_256_gcm_encrypt = async function(password, input) {
  // 1. Generate a random IV (Initialization Vector) - Never reuse an IV with the same key
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(16);

  // 2. Derive a secure key using Scrypt (Async)
  // Converting the password string into a cryptographically strong 32-byte key
  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 32, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  // 3. Create Cipher (GCM mode is recommended for integrity)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = '';
  cipher.setEncoding('hex');

  // 4. Use pipeline to stream the data
  // This handles all 'end', 'error', and 'readable' events for you
  await pipeline(
    Readable.from([input]),
    cipher,
    async function* (source) {
      for await (const chunk of source) {
        encrypted += chunk;
      }
    }
  );

  // For GCM, you usually want to append the auth tag to the result
  const authTag = cipher.getAuthTag().toString('hex');

  // Return everything needed to decrypt: Salt, IV, AuthTag, and Data
  return {
    encrypted,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag
  };
};

/**
 * Modern Async Decipher using AES-256-GCM
 * @param {string} password - The original password used for encryption
 * @param {Object} encryptedData - The object returned by the encryption function
 */
const aes_256_gcm_decrypt = async function(password, { encrypted, iv, salt, authTag }) {
  // 1. Derive the same key using the provided salt (Async)
  const key = await new Promise((resolve, reject) => {
    // Note: Scrypt parameters (like 32) must match the encryption exactly
    crypto.scrypt(password, Buffer.from(salt, 'hex'), 32, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  // 2. Create Decipher
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', 
    key, 
    Buffer.from(iv, 'hex')
  );

  // 3. Set the Auth Tag
  // This is CRITICAL for GCM. If the data was tampered with, 
  // decipher.final() will throw an "Unsupported state" error here.
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = '';
  decipher.setEncoding('utf8');

  // 4. Use pipeline to stream the decryption
  await pipeline(
    Readable.from(Buffer.from(encrypted, 'hex')),
    decipher,
    async function* (source) {
      for await (const chunk of source) {
        decrypted += chunk;
      }
    }
  );

  return decrypted;
};

const sha256_hash = function(key) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256');
      hash.on('readable', () => {
        const data = hash.read();
        if (data) {
          return resolve(data.toString('hex'));
        }
      });
      hash.write(key);
      hash.end();
    } catch (e) {
      return reject(e);
    }
  });
};

const sha256_compare = async function(string, hash){
	return await sha256_hash(string) == hash
}

module.exports = {
	aes_256_gcm_encrypt,
	aes_256_gcm_decrypt,
	sha256_hash,
  sha256_compare,
	getGMSTKey
}