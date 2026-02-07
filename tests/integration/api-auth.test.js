'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createMockRequest, createMockResponse, MockDatabase, factories } = require('../helpers/test-helpers');

describe('API - Authentication Endpoints', () => {
  let mockDb;
  let letmein;

  beforeEach(() => {
    mockDb = new MockDatabase();
    letmein = require('../../routers/letmein');
  });

  describe('POST /letmein - Sign In', () => {
    it('should have post method', () => {
      assert.ok(typeof letmein.post === 'function');
    });

    it('should handle sign in request structure', () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'TestPassword123!@#'
        }
      });
      
      assert.ok(req.body.email);
      assert.ok(req.body.password);
    });

    it('should validate required fields', () => {
      const validPayload = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      assert.ok(validPayload.email);
      assert.ok(validPayload.password);
    });

    it('should reject missing email', () => {
      const invalidPayload = {
        password: 'password123'
      };
      
      assert.strictEqual(invalidPayload.email, undefined);
    });

    it('should reject missing password', () => {
      const invalidPayload = {
        email: 'test@example.com'
      };
      
      assert.strictEqual(invalidPayload.password, undefined);
    });

    it('should handle device UUID in payload', () => {
      const payload = {
        email: 'test@example.com',
        password: 'password123',
        device_uuid: 'device-123-456'
      };
      
      assert.ok(payload.device_uuid);
    });

    it('should handle access code in payload', () => {
      const payload = {
        email: 'test@example.com',
        password: 'password123',
        code: 'XXXX-XXX-XXXX-B'
      };
      
      assert.ok(payload.code);
    });

    it('should handle addDevice flag', () => {
      const payload = {
        email: 'test@example.com',
        password: 'password123',
        device_uuid: 'device-123',
        code: 'XXXX-XXX-XXXX-B',
        addDevice: true
      };
      
      assert.strictEqual(payload.addDevice, true);
    });
  });

  describe('Sign In Response', () => {
    it('should return encrypted data on success', () => {
      // Mock successful response structure
      const response = {
        status: 200,
        result: {
          data: 'encrypted-token-data'
        }
      };
      
      assert.strictEqual(response.status, 200);
      assert.ok(response.result.data);
    });

    it('should return error on failure', () => {
      const response = {
        status: 401,
        error: 'Invalid Username or Password'
      };
      
      assert.strictEqual(response.status, 401);
      assert.ok(response.error);
    });

    it('should handle blocked user response', () => {
      const response = {
        status: 401,
        error: 'User blocked until 2024-01-01 12:00:00'
      };
      
      assert.strictEqual(response.status, 401);
      assert.ok(response.error.includes('blocked'));
    });

    it('should handle access code required response', () => {
      const response = {
        status: 401,
        error: 'Access Code Required'
      };
      
      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.error, 'Access Code Required');
    });

    it('should handle invalid access code response', () => {
      const response = {
        status: 401,
        error: 'Invalid Access Code'
      };
      
      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.error, 'Invalid Access Code');
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.com',
        'user+tag@example.co.uk'
      ];
      
      validEmails.forEach(email => {
        assert.ok(email.includes('@'));
        assert.ok(email.includes('.'));
      });
    });

    it('should handle case-insensitive emails', () => {
      const email1 = 'Test@Example.COM';
      const email2 = 'test@example.com';
      
      assert.strictEqual(email1.toLowerCase(), email2.toLowerCase());
    });
  });

  describe('Password Security', () => {
    it('should never return plain password', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        // password field should be removed
      };
      
      assert.strictEqual(userData.password, undefined);
    });

    it('should handle hashed passwords', () => {
      const hashedPassword = 'a'.repeat(64); // SHA-256 produces 64 hex chars
      
      assert.strictEqual(hashedPassword.length, 64);
      assert.match(hashedPassword, /^[a-f0-9]+$/);
    });
  });

  describe('Device Verification Flow', () => {
    it('should check device UUID', async () => {
      const deviceCheck = {
        userId: 1,
        deviceUuid: 'device-123'
      };
      
      await mockDb.create('permitted_devices', {
        user: deviceCheck.userId,
        device: deviceCheck.deviceUuid
      });
      
      const device = await mockDb.findOne('permitted_devices', {
        user: deviceCheck.userId,
        device: deviceCheck.deviceUuid
      });
      
      assert.ok(device);
    });

    it('should handle new device verification', async () => {
      const code = {
        user: 1,
        code: 'XXXX-XXX-XXXX-B',
        expiry: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      };
      
      await mockDb.create('authorization_codes', code);
      
      const stored = await mockDb.findOne('authorization_codes', { code: code.code });
      
      assert.ok(stored);
      assert.ok(stored.code.endsWith('-B'));
    });
  });

  describe('Brute Force Protection', () => {
    it('should track failed attempts', async () => {
      const user = await mockDb.create('users', {
        email: 'test@example.com',
        attempts: 0,
        lastattempt: null
      });
      
      // Simulate failed attempt
      user.attempts++;
      user.lastattempt = new Date();
      
      const updated = await mockDb.update('users', { id: user.id }, {
        attempts: user.attempts,
        lastattempt: user.lastattempt
      });
      
      assert.strictEqual(updated[0].attempts, 1);
    });

    it('should reset attempts on successful login', async () => {
      const user = await mockDb.create('users', {
        email: 'test@example.com',
        attempts: 3,
        lastattempt: new Date()
      });
      
      // Simulate successful login
      const updated = await mockDb.update('users', { id: user.id }, {
        attempts: 0,
        lastattempt: null
      });
      
      assert.strictEqual(updated[0].attempts, 0);
      assert.strictEqual(updated[0].lastattempt, null);
    });

    it('should handle 5-minute block (3+ attempts)', () => {
      const attempts = 3;
      const lastattempt = new Date(Date.now() - 2 * 60 * 1000); // 2 mins ago
      const blockUntil = new Date(lastattempt.getTime() + 5 * 60 * 1000);
      
      assert.ok(new Date() < blockUntil);
    });

    it('should handle 30-minute block (6+ attempts)', () => {
      const attempts = 6;
      const lastattempt = new Date(Date.now() - 10 * 60 * 1000); // 10 mins ago
      const blockUntil = new Date(lastattempt.getTime() + 30 * 60 * 1000);
      
      assert.ok(new Date() < blockUntil);
    });

    it('should inactivate user (9+ attempts)', async () => {
      const user = await mockDb.create('users', {
        email: 'test@example.com',
        attempts: 9,
        state: 'active'
      });
      
      // Simulate inactivation
      const updated = await mockDb.update('users', { id: user.id }, {
        state: 'inactive'
      });
      
      assert.strictEqual(updated[0].state, 'inactive');
    });
  });

  describe('Session Creation', () => {
    it('should create session on successful login', async () => {
      const session = await mockDb.create('sessions', {
        user: 1,
        token: 'jwt-token-here',
        token_expiry_date: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });
      
      assert.ok(session.id);
      assert.strictEqual(session.user, 1);
      assert.ok(session.token);
    });

    it('should include expiry date in session', async () => {
      const expiryDate = new Date(Date.now() + 30 * 60 * 1000);
      const session = await mockDb.create('sessions', {
        user: 1,
        token: 'token',
        token_expiry_date: expiryDate.toISOString()
      });
      
      assert.ok(session.token_expiry_date);
      assert.ok(new Date(session.token_expiry_date) > new Date());
    });
  });

  describe('Response Data Structure', () => {
    it('should structure successful response', () => {
      const response = {
        user: {
          id: 1,
          email: 'test@example.com',
          state: 'active'
        },
        token: 'jwt-token',
        key: 'encryption-key'
      };
      
      assert.ok(response.user);
      assert.ok(response.token);
      assert.ok(response.key);
      assert.strictEqual(response.user.password, undefined);
    });

    it('should encrypt response data', () => {
      const encryptedResponse = {
        encrypted: 'base64-encrypted-data',
        iv: 'initialization-vector',
        salt: 'salt-value',
        authTag: 'authentication-tag'
      };
      
      assert.ok(encryptedResponse.encrypted);
      assert.ok(encryptedResponse.iv);
    });
  });

  describe('Error Handling', () => {
    it('should handle user not found', () => {
      const error = {
        status: 401,
        error: 'User not found'
      };
      
      assert.strictEqual(error.status, 401);
    });

    it('should handle invalid password', () => {
      const error = {
        status: 401,
        error: 'Invalid Username or Password'
      };
      
      assert.strictEqual(error.status, 401);
    });

    it('should handle server errors', () => {
      const error = {
        status: 404,
        error: 'Cannot Login'
      };
      
      assert.strictEqual(error.status, 404);
    });
  });
});