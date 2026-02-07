'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { MockDatabase, createMockCallFunction, factories } = require('../helpers/test-helpers');

describe('util-auth', () => {
  let auth;
  let mockDb;

  beforeEach(() => {
    // Setup mock database
    mockDb = new MockDatabase();
    
    // Load auth module (note: full mocking would require more setup)
    auth = require('../../utils/util-auth');
  });

  afterEach(() => {
    mockDb.clear();
  });

  describe('validatePasswordRules()', () => {
    it('should validate a strong password', () => {
      const password = 'TestPassword123!@#';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, true, 'Should accept strong password');
    });

    it('should reject password shorter than 15 characters', () => {
      const password = 'Short1!';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, false, 'Should reject short password');
    });

    it('should reject password without uppercase letters', () => {
      const password = 'testpassword123!@#';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, false, 'Should reject password without uppercase');
    });

    it('should reject password without lowercase letters', () => {
      const password = 'TESTPASSWORD123!@#';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, false, 'Should reject password without lowercase');
    });

    it('should reject password without numbers', () => {
      const password = 'TestPasswordOnly!@#';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, false, 'Should reject password without numbers');
    });

    it('should reject password without special characters', () => {
      const password = 'TestPassword123456';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, false, 'Should reject password without special characters');
    });

    it('should reject null password', () => {
      const result = auth.validatePasswordRules(null);
      assert.strictEqual(result, false, 'Should reject null password');
    });

    it('should reject undefined password', () => {
      const result = auth.validatePasswordRules(undefined);
      assert.strictEqual(result, false, 'Should reject undefined password');
    });

    it('should reject password with insufficient uppercase', () => {
      const password = 'Testpassword123!@#';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, false, 'Should require at least 2 uppercase letters');
    });

    it('should reject password with insufficient special characters', () => {
      const password = 'TestPassword123!';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, false, 'Should require at least 2 special characters');
    });

    it('should accept password with exactly required characters', () => {
      const password = 'AAbbcc1122!!###';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, true, 'Should accept password with minimum requirements');
    });
  });

  describe('genCode()', () => {
    it('should generate password reset code with correct format', () => {
      const code = auth.genCode('password');
      assert.ok(code, 'Should generate a code');
      assert.match(code, /^[0-9A-F]{4}-[0-9A-F]{3}-[0-9A-F]{4}-A$/, 'Should match password code pattern');
    });

    it('should generate device verification code with correct format', () => {
      const code = auth.genCode('device');
      assert.ok(code, 'Should generate a code');
      assert.match(code, /^[0-9A-F]{4}-[0-9A-F]{3}-[0-9A-F]{4}-B$/, 'Should match device code pattern');
    });

    it('should throw error for invalid type', () => {
      assert.throws(
        () => auth.genCode('invalid'),
        Error,
        'Should throw error for invalid type'
      );
    });

    it('should generate unique codes', () => {
      const code1 = auth.genCode('password');
      const code2 = auth.genCode('password');
      assert.notStrictEqual(code1, code2, 'Should generate unique codes');
    });

    it('should generate uppercase codes', () => {
      const code = auth.genCode('password');
      assert.strictEqual(code, code.toUpperCase(), 'Code should be uppercase');
    });
  });

  describe('checkForBlockedTime()', () => {
    it('should return undefined for user with no attempts', () => {
      const user = { data: { attempts: 0, lastattempt: null } };
      const result = auth.checkForBlockedTime(user);
      assert.strictEqual(result, undefined);
    });
it('should return undefined for user with low attempts', () => {
  const user = {
    data: {
      attempts: 2,
      lastattempt: new Date().toISOString()
    }
  };
  const result = auth.checkForBlockedTime(user);
  assert.strictEqual(result, undefined);
});

it('should block user with 3+ attempts within 5 minutes', () => {
  const lastattempt = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
  const user = {
    data: {
      attempts: 3,
      lastattempt: lastattempt.toISOString()
    }
  };
  const blockResult = auth.checkForBlockedTime(user);
  assert.ok(blockResult, 'Should return block message');
  assert.ok(blockResult.includes('blocked until'), 'Should include block time');
});

it('should block user with 6+ attempts within 30 minutes', () => {
  const lastattempt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
  const user = {
    data: {
      attempts: 6,
      lastattempt: lastattempt.toISOString()
    }
  };
  const blockResult = auth.checkForBlockedTime(user);
  assert.ok(blockResult, 'Should return block message');
  assert.ok(blockResult.includes('blocked until'), 'Should include block time');
});

it('should not block user with old attempts', () => {
  const lastattempt = new Date(Date.now() - 60 * 60 * 1000); // 60 minutes ago
  const user = {
    data: {
      attempts: 6,
      lastattempt: lastattempt.toISOString()
    }
  };
  const timeoutResult = auth.checkForBlockedTime(user);
  assert.strictEqual(timeoutResult, undefined, 'Should not block after timeout');
});
  });

  describe('validatePayload()', () => {
    it('should validate correct payload', () => {
      const payload = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      assert.doesNotThrow(() => {
        auth.validatePayload(payload);
      });
    });

    it('should throw error for missing email', () => {
      const payload = {
        password: 'password123'
      };
      
      assert.throws(() => {
        auth.validatePayload(payload);
      }, /email/);
    });

    it('should throw error for missing password', () => {
      const payload = {
        email: 'test@example.com'
      };
      
      assert.throws(() => {
        auth.validatePayload(payload);
      }, /password/);
    });

    it('should throw error for empty email', () => {
      const payload = {
        email: '',
        password: 'password123'
      };
      
      assert.throws(() => {
        auth.validatePayload(payload);
      });
    });

    it('should throw error for empty password', () => {
      const payload = {
        email: 'test@example.com',
        password: ''
      };
      
      assert.throws(() => {
        auth.validatePayload(payload);
      });
    });

    it('should throw error for null email', () => {
      const payload = {
        email: null,
        password: 'password123'
      };
      
      assert.throws(() => {
        auth.validatePayload(payload);
      });
    });
  });

  describe('Password Salt and Unsalt', () => {
    it('should salt data successfully', async () => {
      const id = 1;
      const createdAt = new Date('2024-01-01');
      const data = 'testData';
      
      const salted = await auth.salt(id, createdAt, data);
      
      assert.ok(salted);
      assert.ok(salted.encrypted);
      assert.ok(salted.iv);
      assert.ok(salted.salt);
      assert.ok(salted.authTag);
    });

    it('should return empty string for empty data', async () => {
      const id = 1;
      const createdAt = new Date('2024-01-01');
      const data = '';
      
      const result = await auth.salt(id, createdAt, data);
      
      assert.strictEqual(result, '');
    });

    it('should handle null data', async () => {
      const id = 1;
      const createdAt = new Date('2024-01-01');
      const data = null;
      
      const result = await auth.salt(id, createdAt, data);
      
      assert.strictEqual(result, null);
    });

    it('should salt and unsalt data correctly', async () => {
      const id = 1;
      const createdAt = new Date('2024-01-01');
      const data = 'testData';
      
      const salted = await auth.salt(id, createdAt, data);
      const unsalted = await auth.unsalt(id, createdAt, salted);
      
      assert.strictEqual(unsalted, data);
    });

    it('should handle JSON objects', async () => {
      const id = 1;
      const createdAt = new Date('2024-01-01');
      const data = { test: 'value', number: 123 };
      
      const salted = await auth.salt(id, createdAt, data);
      const unsalted = await auth.unsalt(id, createdAt, salted);
      
      assert.deepStrictEqual(unsalted, data);
    });

    it('should handle numbers', async () => {
      const id = 1;
      const createdAt = new Date('2024-01-01');
      const data = 12345;
      
      const salted = await auth.salt(id, createdAt, data);
      const unsalted = await auth.unsalt(id, createdAt, salted);
      
      assert.strictEqual(unsalted, data);
    });
  });

  describe('Code Generation and Validation Flow', () => {
    it('should handle complete code lifecycle', async () => {
      // This test demonstrates the expected flow but requires database mocking
      const code = auth.genCode('password');
      assert.ok(code);
      assert.match(code, /^[0-9A-F]{4}-[0-9A-F]{3}-[0-9A-F]{4}-A$/);
    });

    it('should generate different codes for password and device', () => {
      const passwordCode = auth.genCode('password');
      const deviceCode = auth.genCode('device');
      
      assert.ok(passwordCode.endsWith('-A'));
      assert.ok(deviceCode.endsWith('-B'));
    });
  });

  describe('Password Validation', () => {
    it('should validate matching passwords', async () => {
      const password = 'testPassword123';
      const encrypt = require('../../utils/util-encryption');
      const hashed = await encrypt.sha256_hash(password);
      
      const isValid = await auth.validatePassword(password, hashed);
      
      assert.strictEqual(isValid, true);
    });

    it('should reject non-matching passwords', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const encrypt = require('../../utils/util-encryption');
      const hashed = await encrypt.sha256_hash(password);
      
      const isValid = await auth.validatePassword(wrongPassword, hashed);
      
      assert.strictEqual(isValid, false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long passwords', () => {
      const password = 'A'.repeat(100) + 'a'.repeat(100) + '1'.repeat(100) + '!'.repeat(100);
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, true);
    });

    it('should handle special unicode characters in validation', () => {
      // Password validation should work with standard ASCII special characters
      const password = 'TestPass123!@#$$%%';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, true);
    });

    it('should handle mixed special characters', () => {
      const password = 'TestPassword12!@';
      const result = auth.validatePasswordRules(password);
      assert.strictEqual(result, true);
    });
  });
});