'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const encryption = require('../../utils/util-encryption');

describe('util-encryption', () => {
  describe('aes_256_gcm_encrypt()', () => {
    it('should encrypt data successfully', async () => {
      const password = 'testPassword123';
      const plaintext = 'Hello, World!';
      
      const result = await encryption.aes_256_gcm_encrypt(password, plaintext);
      
      assert.ok(result.encrypted, 'Should return encrypted data');
      assert.ok(result.iv, 'Should return IV');
      assert.ok(result.salt, 'Should return salt');
      assert.ok(result.authTag, 'Should return auth tag');
      assert.strictEqual(typeof result.encrypted, 'string');
      assert.strictEqual(typeof result.iv, 'string');
      assert.strictEqual(typeof result.salt, 'string');
      assert.strictEqual(typeof result.authTag, 'string');
    });

    it('should produce different IVs for same input', async () => {
      const password = 'testPassword123';
      const plaintext = 'Same data';
      
      const result1 = await encryption.aes_256_gcm_encrypt(password, plaintext);
      const result2 = await encryption.aes_256_gcm_encrypt(password, plaintext);
      
      assert.notStrictEqual(result1.iv, result2.iv, 'IVs should be unique');
      assert.notStrictEqual(result1.encrypted, result2.encrypted, 'Encrypted data should differ');
    });

    it('should encrypt empty string', async () => {
      const password = 'testPassword123';
      const plaintext = '';
      
      const result = await encryption.aes_256_gcm_encrypt(password, plaintext);
      
      assert.ok(result.encrypted !== undefined);
      assert.ok(result.iv);
      assert.ok(result.salt);
      assert.ok(result.authTag);
    });

    it('should encrypt numbers as strings', async () => {
      const password = 'testPassword123';
      const plaintext = '12345';
      
      const result = await encryption.aes_256_gcm_encrypt(password, plaintext);
      
      assert.ok(result.encrypted);
      assert.ok(result.iv);
    });

    it('should handle long strings', async () => {
      const password = 'testPassword123';
      const plaintext = 'A'.repeat(10000);
      
      const result = await encryption.aes_256_gcm_encrypt(password, plaintext);
      
      assert.ok(result.encrypted);
      assert.ok(result.iv);
    });
  });

  describe('aes_256_gcm_decrypt()', () => {
    it('should decrypt data successfully', async () => {
      const password = 'testPassword123';
      const plaintext = 'Hello, World!';
      
      const encrypted = await encryption.aes_256_gcm_encrypt(password, plaintext);
      const decrypted = await encryption.aes_256_gcm_decrypt(password, encrypted);
      
      assert.strictEqual(decrypted, plaintext, 'Decrypted data should match original');
    });

    it('should decrypt empty string', async () => {
      const password = 'testPassword123';
      const plaintext = '';
      
      const encrypted = await encryption.aes_256_gcm_encrypt(password, plaintext);
      const decrypted = await encryption.aes_256_gcm_decrypt(password, encrypted);
      
      assert.strictEqual(decrypted, plaintext);
    });

    it('should decrypt long strings', async () => {
      const password = 'testPassword123';
      const plaintext = 'A'.repeat(10000);
      
      const encrypted = await encryption.aes_256_gcm_encrypt(password, plaintext);
      const decrypted = await encryption.aes_256_gcm_decrypt(password, encrypted);
      
      assert.strictEqual(decrypted, plaintext);
    });

    it('should fail with wrong password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const plaintext = 'Secret data';
      
      const encrypted = await encryption.aes_256_gcm_encrypt(password, plaintext);
      
      await assert.rejects(
        async () => await encryption.aes_256_gcm_decrypt(wrongPassword, encrypted),
        Error,
        'Should throw error with wrong password'
      );
    });

    it('should fail with tampered encrypted data', async () => {
      const password = 'testPassword123';
      const plaintext = 'Secret data';
      
      const encrypted = await encryption.aes_256_gcm_encrypt(password, plaintext);
      const tampered = { ...encrypted, encrypted: 'tampered' + encrypted.encrypted };
      
      await assert.rejects(
        async () => await encryption.aes_256_gcm_decrypt(password, tampered),
        Error,
        'Should throw error with tampered data'
      );
    });

    it('should fail with tampered auth tag', async () => {
      const password = 'testPassword123';
      const plaintext = 'Secret data';
      
      const encrypted = await encryption.aes_256_gcm_encrypt(password, plaintext);
      const tampered = { ...encrypted, authTag: 'ffffffffffffffffffffffffffffffff' };
      
      await assert.rejects(
        async () => await encryption.aes_256_gcm_decrypt(password, tampered),
        Error,
        'Should throw error with tampered auth tag'
      );
    });

    it('should handle special characters', async () => {
      const password = 'testPassword123';
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      
      const encrypted = await encryption.aes_256_gcm_encrypt(password, plaintext);
      const decrypted = await encryption.aes_256_gcm_decrypt(password, encrypted);
      
      assert.strictEqual(decrypted, plaintext);
    });

    it('should handle unicode characters', async () => {
      const password = 'testPassword123';
      const plaintext = 'Hello 世界 🌍 café';
      
      const encrypted = await encryption.aes_256_gcm_encrypt(password, plaintext);
      const decrypted = await encryption.aes_256_gcm_decrypt(password, encrypted);
      
      assert.strictEqual(decrypted, plaintext);
    });
  });

  describe('sha256_hash()', () => {
    it('should hash string successfully', async () => {
      const input = 'testString';
      
      const hash = await encryption.sha256_hash(input);
      
      assert.ok(hash, 'Should return a hash');
      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length, 64, 'SHA-256 hash should be 64 hex characters');
    });

    it('should produce consistent hashes', async () => {
      const input = 'testString';
      
      const hash1 = await encryption.sha256_hash(input);
      const hash2 = await encryption.sha256_hash(input);
      
      assert.strictEqual(hash1, hash2, 'Same input should produce same hash');
    });

    it('should produce different hashes for different inputs', async () => {
      const input1 = 'testString1';
      const input2 = 'testString2';
      
      const hash1 = await encryption.sha256_hash(input1);
      const hash2 = await encryption.sha256_hash(input2);
      
      assert.notStrictEqual(hash1, hash2, 'Different inputs should produce different hashes');
    });

    it('should hash empty string', async () => {
      const input = '';
      
      const hash = await encryption.sha256_hash(input);
      
      assert.ok(hash);
      assert.strictEqual(hash.length, 64);
    });

    it('should hash long strings', async () => {
      const input = 'A'.repeat(10000);
      
      const hash = await encryption.sha256_hash(input);
      
      assert.ok(hash);
      assert.strictEqual(hash.length, 64);
    });

    it('should hash numbers', async () => {
      const input = '123456';
      
      const hash = await encryption.sha256_hash(input);
      
      assert.ok(hash);
      assert.strictEqual(hash.length, 64);
    });

    it('should hash special characters', async () => {
      const input = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      
      const hash = await encryption.sha256_hash(input);
      
      assert.ok(hash);
      assert.strictEqual(hash.length, 64);
    });

    it('should produce case-sensitive hashes', async () => {
      const input1 = 'TestString';
      const input2 = 'teststring';
      
      const hash1 = await encryption.sha256_hash(input1);
      const hash2 = await encryption.sha256_hash(input2);
      
      assert.notStrictEqual(hash1, hash2, 'Case differences should produce different hashes');
    });
  });

  describe('getGMSTKey()', () => {
    it('should return a string key', () => {
      const key = encryption.getGMSTKey();
      
      assert.ok(key, 'Should return a key');
      assert.strictEqual(typeof key, 'string');
    });

    it('should return numeric string', () => {
      const key = encryption.getGMSTKey();
      
      assert.ok(/^\d+$/.test(key), 'Key should be numeric string');
    });

    it('should return consistent key within same 2-minute window', () => {
      const key1 = encryption.getGMSTKey();
      const key2 = encryption.getGMSTKey();
      
      // Since we're in the same execution, these should be identical
      assert.strictEqual(key1, key2, 'Keys within same 2-minute window should match');
    });

    it('should return a reasonable GMST value', () => {
      const key = encryption.getGMSTKey();
      const numericKey = parseInt(key, 10);
      
      // GMST in minutes should be between 0 and ~1440 (minutes in a day)
      assert.ok(numericKey >= 0, 'GMST key should be non-negative');
      assert.ok(numericKey <= 100000, 'GMST key should be reasonable');
    });
  });

  describe('Integration: Encrypt and Decrypt workflow', () => {
    it('should handle full encrypt-decrypt cycle with complex data', async () => {
      const password = 'MySecurePassword!123';
      const data = {
        user: 'john@example.com',
        roles: ['admin', 'user'],
        settings: {
          theme: 'dark',
          notifications: true
        }
      };
      const plaintext = JSON.stringify(data);
      
      const encrypted = await encryption.aes_256_gcm_encrypt(password, plaintext);
      const decrypted = await encryption.aes_256_gcm_decrypt(password, encrypted);
      const parsed = JSON.parse(decrypted);
      
      assert.deepStrictEqual(parsed, data, 'Decrypted JSON should match original object');
    });

    it('should maintain data integrity through multiple encrypt-decrypt cycles', async () => {
      const password = 'testPassword';
      let data = 'Original data';
      
      for (let i = 0; i < 5; i++) {
        const encrypted = await encryption.aes_256_gcm_encrypt(password, data);
        data = await encryption.aes_256_gcm_decrypt(password, encrypted);
      }
      
      assert.strictEqual(data, 'Original data', 'Data should remain unchanged after multiple cycles');
    });
  });
});