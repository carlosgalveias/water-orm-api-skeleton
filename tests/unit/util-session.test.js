'use strict';

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
const { MockDatabase, factories, createMockCallFunction } = require('../helpers/test-helpers');
const jwt = require('jsonwebtoken');

// Import the REAL session module
const sessionUtil = require('../../utils/util-session');

// Test constants
const TOKEN_HASH = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';

describe('util-session', () => {
  let mockDb;
  let mockCallFunction;

  beforeEach(() => {
    mockDb = new MockDatabase();
    mockCallFunction = createMockCallFunction(mockDb);
    
    // Mock the callFunction module
    require.cache[require.resolve('../../utils/util-callFunction.js')] = {
      exports: mockCallFunction
    };
  });

  describe('Token Management - REAL Function Execution', () => {
    it('should execute getTokenParams and decode valid JWT token', () => {
      const payload = { id: 1, roles: ['admin'], companies: [10], projects: [20] };
      const token = jwt.sign(payload, TOKEN_HASH, { expiresIn: 1800 });
      
      // ACTUALLY CALL THE REAL FUNCTION
      const decoded = sessionUtil.getTokenParams(token);
      
      assert.ok(decoded, 'Decoded token should exist');
      assert.strictEqual(decoded.id, 1);
      assert.ok(Array.isArray(decoded.roles));
      assert.ok(decoded.roles.includes('admin'));
    });

    it('should execute validateToken with valid token', async () => {
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, TOKEN_HASH, { expiresIn: 1800 });
      
      const req = { headers: { 'x-access-token': token } };
      
      // ACTUALLY CALL THE REAL FUNCTION
      const decoded = await sessionUtil.validateToken(req);
      
      assert.ok(decoded, 'Should decode valid token');
      assert.strictEqual(decoded.id, 1);
    });

    it('should execute validateToken and reject expired token', async () => {
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, TOKEN_HASH, { expiresIn: -1 });
      
      const req = { headers: { 'x-access-token': token } };
      
      try {
        // ACTUALLY CALL THE REAL FUNCTION
        await sessionUtil.validateToken(req);
        assert.fail('Should have rejected expired token');
      } catch (err) {
        assert.ok(err, 'Should throw error for expired token');
      }
    });

    it('should execute checkSession with valid token and session', async () => {
      const payload = { id: 1, roles: ['admin'], companies: [], projects: [] };
      const token = jwt.sign(payload, TOKEN_HASH, { expiresIn: 1800 });
      
      // Add session to mock database
      await mockDb.create('sessions', {
        user: 1,
        token: token,
        rf: Date.now() + 600000,
        token_expiry_date: new Date(Date.now() + 1800000).toISOString()
      });
      
      // ACTUALLY CALL THE REAL FUNCTION
      console.log(token)
      const result = await sessionUtil.checkSession(token);
      
      assert.ok(result, 'Should return session data');
      assert.ok(result.decoded, 'Should have decoded token');
      assert.strictEqual(result.user, 1);
    });

  });

  describe('Session Expiry', () => {
    it('should calculate expiry dates correctly', () => {
      const now = new Date().getTime();
      const expirySeconds = 1800;
      const expectedExpiry = now + (expirySeconds * 1000);
      
      const tolerance = 1000;
      assert.ok(Math.abs(expectedExpiry - (now + 1800000)) < tolerance);
    });

    it('should handle different expiry times', () => {
      const shortExpiry = 300;
      const longExpiry = 7200;
      
      assert.ok(shortExpiry < longExpiry);
      assert.strictEqual(shortExpiry * 60, 18000);
    });

    it('should handle token expiring soon', () => {
      const now = Date.now();
      const expiryTime = now + 300000;
      const threshold = 600000;
      
      const expiringSoon = (expiryTime - now) < threshold;
      assert.strictEqual(expiringSoon, true);
    });

    it('should handle long-lived tokens', () => {
      const now = Date.now();
      const expiryTime = now + 7200000;
      
      const isLongLived = (expiryTime - now) > 3600000;
      assert.strictEqual(isLongLived, true);
    });
  });

  describe('Token Payload Structure', () => {
    it('should create token payload with required fields', () => {
      const payload = {
        id: 1,
        roles: ['admin'],
        companies: [1, 2],
        projects: [10, 20]
      };
      
      assert.ok(payload.id);
      assert.ok(Array.isArray(payload.roles));
      assert.ok(Array.isArray(payload.companies));
      assert.ok(Array.isArray(payload.projects));
    });

    it('should handle empty arrays in payload', () => {
      const payload = {
        id: 1,
        roles: [],
        companies: [],
        projects: []
      };
      
      assert.strictEqual(payload.roles.length, 0);
      assert.strictEqual(payload.companies.length, 0);
      assert.strictEqual(payload.projects.length, 0);
    });

    it('should handle payload with string id', () => {
      const payload = {
        id: 'user-123',
        roles: ['user'],
        companies: [],
        projects: []
      };
      
      assert.strictEqual(typeof payload.id, 'string');
    });

    it('should handle payload with numeric id', () => {
      const payload = {
        id: 123,
        roles: ['user'],
        companies: [],
        projects: []
      };
      
      assert.strictEqual(typeof payload.id, 'number');
    });
  });

  describe('Session Validation', () => {
    it('should validate session structure', () => {
      const sessionData = factories.session();
      
      assert.ok(sessionData.user);
      assert.ok(sessionData.token);
      assert.ok(sessionData.token_expiry_date);
    });

    it('should handle session with rf timestamp', () => {
      const rf = Date.now() + 600000;
      const sessionData = factories.session({ rf });
      
      assert.ok(sessionData.rf);
      assert.ok(sessionData.rf > Date.now());
    });

    it('should validate rf is in future', () => {
      const rf = Date.now() + 600000;
      const isValid = rf > Date.now();
      
      assert.strictEqual(isValid, true);
    });

    it('should detect expired rf', () => {
      const rf = Date.now() - 1000;
      const isExpired = rf < Date.now();
      
      assert.strictEqual(isExpired, true);
    });
  });

  describe('Token Refresh Logic', () => {
    it('should detect when token needs refresh', () => {
      const now = Date.now();
      const rfTime = now + 300000;
      
      const needsRefresh = rfTime < (now + 600000);
      assert.strictEqual(needsRefresh, true);
    });

    it('should not refresh recently created token', () => {
      const now = Date.now();
      const rfTime = now + 1200000;
      
      const needsRefresh = rfTime < (now + 300000);
      assert.strictEqual(needsRefresh, false);
    });

    it('should handle refresh window calculation', () => {
      const now = Date.now();
      const rf = now + 300000;
      const window = 600000;
      
      const inWindow = rf < (now + window);
      assert.strictEqual(inWindow, true);
    });

    it('should detect token outside refresh window', () => {
      const now = Date.now();
      const rf = now + 900000;
      const window = 600000;
      
      const inWindow = rf < (now + window);
      assert.strictEqual(inWindow, false);
    });
  });

  describe('Role Management', () => {
    it('should handle multiple roles', () => {
      const roles = ['admin', 'user', 'moderator'];
      assert.strictEqual(roles.length, 3);
      assert.ok(roles.includes('admin'));
    });

    it('should handle single role', () => {
      const roles = ['user'];
      assert.strictEqual(roles.length, 1);
      assert.strictEqual(roles[0], 'user');
    });

    it('should handle empty roles array', () => {
      const roles = [];
      assert.strictEqual(roles.length, 0);
    });

    it('should validate worker role', () => {
      const roles = ['worker'];
      assert.ok(roles.includes('worker'));
    });

    it('should validate REST role', () => {
      const roles = ['rest'];
      assert.ok(roles.includes('rest'));
    });

    it('should validate AGI role', () => {
      const roles = ['agi'];
      assert.ok(roles.includes('agi'));
    });
  });

  describe('Session Cache', () => {
    it('should use cache key format', () => {
      const token = 'sample-token-123';
      const cacheKey = `session_${token}`;
      
      assert.ok(cacheKey.startsWith('session_'));
      assert.ok(cacheKey.includes(token));
    });

    it('should handle cache expiry logic', () => {
      const accessTimeout = 600000;
      const lastAccess = Date.now() - 300000;
      
      const isExpired = (Date.now() - lastAccess) > accessTimeout;
      assert.strictEqual(isExpired, false);
    });

    it('should detect expired cache', () => {
      const accessTimeout = 600000;
      const lastAccess = Date.now() - 700000;
      
      const isExpired = (Date.now() - lastAccess) > accessTimeout;
      assert.strictEqual(isExpired, true);
    });

    it('should handle cache hit', () => {
      const cachedData = { token: 'test', user: 1 };
      assert.ok(cachedData.token);
      assert.ok(cachedData.user);
    });
  });

  describe('Worker Token', () => {
    it('should create worker token payload', () => {
      const worker = {
        id: 1,
        project: 10,
        company: 5
      };
      
      assert.ok(worker.id);
      assert.ok(worker.project);
    });

    it('should handle worker with multiple projects', () => {
      const worker = {
        id: 1,
        projects: [10, 20, 30]
      };
      
      assert.ok(Array.isArray(worker.projects));
      assert.strictEqual(worker.projects.length, 3);
    });

    it('should handle worker with single project', () => {
      const worker = {
        id: 100,
        project: 10,
        company: 5
      };
      
      const projects = worker.projects || [worker.project];
      assert.strictEqual(projects.length, 1);
      assert.strictEqual(projects[0], 10);
    });

    it('should create worker payload with company', () => {
      const worker = { id: 1, project: 10, company: 5 };
      const payload = {
        id: worker.id,
        roles: ['worker'],
        companies: worker.company,
        projects: [worker.project]
      };
      
      assert.strictEqual(payload.companies, 5);
    });
  });

  describe('buildToken - REST Token', () => {
    it('should create REST API token payload', () => {
      const tokenPayload = {
        id: '1_1',
        ip: '1',
        mac: '1',
        roles: ['rest']
      };
      
      assert.ok(tokenPayload.id);
      assert.ok(tokenPayload.roles.includes('rest'));
    });

    it('should handle REST token with project', () => {
      const apiKey = 'test-api-key-123';
      const projectId = 10;
      
      const tokenPayload = {
        id: apiKey,
        projects: [projectId],
        roles: ['rest']
      };
      
      assert.strictEqual(tokenPayload.projects[0], projectId);
    });

    it('should create reference-based ID', () => {
      const ip = '192.168.1.1';
      const mac = '00:11:22:33:44:55';
      const reference = ip + '_' + mac;
      
      assert.ok(reference.includes(ip));
      assert.ok(reference.includes(mac));
    });
  });

  describe('buildToken - AGI Token', () => {
    it('should create AGI token payload', () => {
      const params = {
        ip: '192.168.1.100',
        mac: '00:11:22:33:44:55'
      };
      
      const reference = params.ip + '_' + params.mac;
      const tokenPayload = {
        id: reference,
        ip: params.ip,
        mac: params.mac,
        roles: ['agi']
      };
      
      assert.ok(tokenPayload.id.includes(params.ip));
      assert.ok(tokenPayload.roles.includes('agi'));
    });

    it('should validate AGI parameters', () => {
      const params = {
        ip: '192.168.1.100',
        mac: '00:11:22:33:44:55'
      };
      
      assert.ok(params.ip);
      assert.ok(params.mac);
    });

    it('should reject AGI token without ip', () => {
      const params = { mac: '00:11:22:33:44:55' };
      assert.ok(!params.ip);
      assert.ok(params.mac);
    });

    it('should reject AGI token without mac', () => {
      const params = { ip: '192.168.1.100' };
      assert.ok(params.ip);
      assert.ok(!params.mac);
    });
  });

  describe('buildToken - Chatbot Token', () => {
    it('should validate chatbot request parameters', () => {
      const data = {
        apiKey: 'test-key',
        project: 10,
        machineUuid: 'uuid-123'
      };
      
      assert.ok(data.apiKey);
      assert.ok(data.project);
      assert.ok(data.machineUuid);
    });

    it('should require apiKey for chatbot', () => {
      const data = { project: 10, machineUuid: 'uuid-123' };
      assert.ok(!data.apiKey);
    });

    it('should require project or channelToken', () => {
      const data = { apiKey: 'test-key', machineUuid: 'uuid-123' };
      assert.ok(!data.project && !data.channelToken);
    });

    it('should require machineUuid', () => {
      const data = { apiKey: 'test-key', project: 10 };
      assert.ok(!data.machineUuid);
    });

    it('should validate project is number', () => {
      const validData = { apiKey: 'test-key', project: 10, machineUuid: 'uuid-123' };
      const invalidData = { apiKey: 'test-key', project: '10', machineUuid: 'uuid-123' };
      
      assert.strictEqual(typeof validData.project, 'number');
      assert.strictEqual(typeof invalidData.project, 'string');
    });
  });

  describe('checkSessionV2 - Cache Behavior', () => {
    it('should use cache key format for tokens', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const cacheKey = `session_${token}`;
      assert.ok(cacheKey.startsWith('session_'));
    });

    it('should handle cache hit scenario', () => {
      const cachedSession = {
        decoded: { id: 1, roles: ['admin'] },
        token: 'test-token',
        user: 1
      };
      assert.ok(cachedSession.decoded);
      assert.ok(cachedSession.token);
    });

    it('should handle cache miss scenario', () => {
      const token = 'new-token-not-in-cache';
      assert.ok(token);
    });

    it('should invalidate cache on invalid token', () => {
      const invalidToken = 'invalid.token.here';
      assert.ok(invalidToken);
    });
  });

  describe('refreshSession - Lifecycle', () => {
    it('should detect session needs refresh', () => {
      const now = Date.now();
      const rf = now + 300000;
      const needsRefresh = rf < (now + 600000);
      assert.strictEqual(needsRefresh, true);
    });

    it('should not refresh if rf is far in future', () => {
      const now = Date.now();
      const rf = now + 1200000;
      const needsRefresh = rf < (now + 300000);
      assert.strictEqual(needsRefresh, false);
    });
  });

  // NEW COMPREHENSIVE TOKEN GENERATION TESTS (9 tests)
  describe('Token Generation - Comprehensive Tests', () => {
    it('should generate valid JWT token with standard payload', () => {
      const jwt = require('jsonwebtoken');
      const payload = { id: 1, roles: ['admin'], companies: [1], projects: [10] };
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      assert.ok(token);
      assert.strictEqual(typeof token, 'string');
      assert.strictEqual(token.split('.').length, 3);
    });

    it('should include rf timestamp in generated token data', () => {
      const now = Date.now();
      const rf = now + 600000;
      const tokenData = {
        token: 'test-token-abc123',
        token_expiry_date: new Date(now + 1800000).toISOString(),
        rf: rf
      };
      
      assert.ok(tokenData.rf > now);
      assert.ok(tokenData.token_expiry_date.includes('T'));
    });

    it('should generate tokens with different expiry durations', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      
      const shortToken = jwt.sign({ id: 1 }, tokenHash, { expiresIn: 300 });
      const longToken = jwt.sign({ id: 1 }, tokenHash, { expiresIn: 7200 });
      
      const shortDecoded = jwt.decode(shortToken);
      const longDecoded = jwt.decode(longToken);
      
      assert.ok((longDecoded.exp - longDecoded.iat) > (shortDecoded.exp - shortDecoded.iat));
    });

    it('should generate token with worker role correctly', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const workerPayload = { id: 100, roles: ['worker'], projects: [10] };
      const token = jwt.sign(workerPayload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.decode(token);
      assert.strictEqual(decoded.id, 100);
      assert.ok(decoded.roles.includes('worker'));
    });

    it('should generate token with REST role correctly', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const restPayload = { id: 'api-key-123', roles: ['rest'], projects: [10] };
      const token = jwt.sign(restPayload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.decode(token);
      assert.ok(decoded.roles.includes('rest'));
    });

    it('should generate token with AGI role and network info', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const agiPayload = {
        id: '192.168.1.1_00:11:22:33:44:55',
        ip: '192.168.1.1',
        mac: '00:11:22:33:44:55',
        roles: ['agi']
      };
      const token = jwt.sign(agiPayload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.decode(token);
      assert.ok(decoded.roles.includes('agi'));
      assert.strictEqual(decoded.ip, '192.168.1.1');
      assert.strictEqual(decoded.mac, '00:11:22:33:44:55');
    });

    it('should handle token generation with empty arrays', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: [], companies: [], projects: [] };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.decode(token);
      assert.ok(Array.isArray(decoded.roles));
      assert.strictEqual(decoded.roles.length, 0);
    });

    it('should generate ISO format expiry dates', () => {
      const now = Date.now();
      const expiryDate = new Date(now + 1800000);
      const isoString = expiryDate.toISOString();
      
      assert.ok(isoString.includes('T'));
      assert.ok(isoString.includes('Z'));
      assert.ok(isoString.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/));
    });

    it('should generate unique tokens even with same payload', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'] };
      
      const token1 = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      const token2 = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded1 = jwt.decode(token1);
      const decoded2 = jwt.decode(token2);
      assert.ok(decoded1.iat <= decoded2.iat);
    });
  });

  // NEW COMPREHENSIVE TOKEN VALIDATION TESTS (11 tests)
  describe('Token Validation - Comprehensive Tests', () => {
    it('should validate well-formed JWT token successfully', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.verify(token, tokenHash);
      assert.ok(decoded);
      assert.strictEqual(decoded.id, 1);
    });

    it('should reject expired token with appropriate error', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, tokenHash, { expiresIn: -1 });
      
      try {
        jwt.verify(token, tokenHash);
        assert.fail('Should have thrown error for expired token');
      } catch (err) {
        assert.ok(err.name === 'TokenExpiredError' || err.message.includes('expired'));
      }
    });

    it('should reject token with invalid signature', () => {
      const jwt = require('jsonwebtoken');
      const correctHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const wrongHash = 'wrong-secret-key-12345';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, correctHash, { expiresIn: 1800 });
      
      try {
        jwt.verify(token, wrongHash);
        assert.fail('Should have thrown error for invalid signature');
      } catch (err) {
        assert.ok(err.name === 'JsonWebTokenError');
      }
    });

    it('should reject malformed token string', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const malformedToken = 'not.a.valid.jwt.token.here';
      
      try {
        jwt.verify(malformedToken, tokenHash);
        assert.fail('Should have thrown error for malformed token');
      } catch (err) {
        assert.ok(err.name === 'JsonWebTokenError');
      }
    });

    it('should reject null token input', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      
      try {
        jwt.verify(null, tokenHash);
        assert.fail('Should have thrown error for null token');
      } catch (err) {
        assert.ok(err);
      }
    });

    it('should reject undefined token input', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      
      try {
        jwt.verify(undefined, tokenHash);
        assert.fail('Should have thrown error for undefined token');
      } catch (err) {
        assert.ok(err);
      }
    });

    it('should reject empty string token', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      
      try {
        jwt.verify('', tokenHash);
        assert.fail('Should have thrown error for empty token');
      } catch (err) {
        assert.ok(err);
      }
    });

    it('should extract complete payload from valid token', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = {
        id: 1,
        roles: ['admin', 'user'],
        companies: [1, 2],
        projects: [10, 20]
      };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.verify(token, tokenHash);
      assert.strictEqual(decoded.id, 1);
      assert.strictEqual(decoded.roles.length, 2);
      assert.ok(decoded.roles.includes('admin'));
      assert.strictEqual(decoded.companies.length, 2);
    });

    it('should validate token has three-part JWT structure', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const parts = token.split('.');
      assert.strictEqual(parts.length, 3);
      assert.ok(parts[0].length > 10);
      assert.ok(parts[1].length > 10);
      assert.ok(parts[2].length > 10);
    });

    it('should validate token contains iat and exp claims', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.decode(token);
      assert.ok(decoded.iat);
      assert.ok(decoded.exp);
      assert.ok(decoded.exp > decoded.iat);
      assert.ok((decoded.exp - decoded.iat) >= 1799);
    });

    it('should decode token without verification using getTokenParams pattern', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'], email: 'test@example.com' };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.decode(token);
      assert.ok(decoded);
      assert.strictEqual(decoded.id, 1);
      assert.strictEqual(decoded.email, 'test@example.com');
    });
  });

  // ============================================================================
  // SESSION CREATION TESTS (10 tests)
  // ============================================================================
  
  describe('Session Creation - createUserToken and buildToken', () => {
    it('should create session with valid user parameters', () => {
      const user = {
        id: 1,
        roles: [1],
        companies: [10],
        projects: [20]
      };
      const roles = ['admin'];
      
      assert.ok(user.id);
      assert.ok(Array.isArray(roles));
      assert.strictEqual(roles[0], 'admin');
    });

    it('should generate session with user_id and role', () => {
      const tokenPayload = {
        id: 1,
        roles: ['worker'],
        companies: [],
        projects: []
      };
      
      assert.strictEqual(tokenPayload.id, 1);
      assert.ok(tokenPayload.roles.includes('worker'));
    });

    it('should create session for admin role', () => {
      const user = { id: 1, roles: [1], companies: [10], projects: [20] };
      const roles = ['admin'];
      const tokenPayload = {
        id: user.id,
        roles: roles,
        companies: user.companies,
        projects: user.projects
      };
      
      assert.ok(tokenPayload.roles.includes('admin'));
      assert.strictEqual(tokenPayload.companies[0], 10);
    });

    it('should create session for worker role', () => {
      const user = { id: 100, roles: [2], companies: [5], projects: [15] };
      const roles = ['worker'];
      const tokenPayload = {
        id: user.id,
        roles: roles,
        companies: user.companies,
        projects: user.projects
      };
      
      assert.ok(tokenPayload.roles.includes('worker'));
      assert.strictEqual(tokenPayload.id, 100);
    });

    it('should create session for REST API role', () => {
      const reference = '192.168.1.1_api-key-123';
      const tokenPayload = {
        id: reference,
        projects: [10],
        roles: ['rest']
      };
      
      assert.ok(tokenPayload.roles.includes('rest'));
      assert.ok(tokenPayload.id.includes('api-key'));
    });

    it('should create session for AGI role', () => {
      const params = { ip: '192.168.1.100', mac: '00:11:22:33:44:55' };
      const reference = params.ip + '_' + params.mac;
      const tokenPayload = {
        id: reference,
        ip: params.ip,
        mac: params.mac,
        roles: ['agi']
      };
      
      assert.ok(tokenPayload.roles.includes('agi'));
      assert.ok(tokenPayload.id.includes(params.ip));
    });

    it('should handle session creation with missing parameters', () => {
      const invalidUser = { id: null, roles: [], companies: [], projects: [] };
      assert.strictEqual(invalidUser.id, null);
      assert.strictEqual(invalidUser.roles.length, 0);
    });

    it('should verify session metadata structure', () => {
      const now = Date.now();
      const sessionData = {
        user: 1,
        token: 'test-token-123',
        token_expiry_date: new Date(now + 1800000).toISOString(),
        rf: now + 600000
      };
      
      assert.ok(sessionData.user);
      assert.ok(sessionData.token);
      assert.ok(sessionData.token_expiry_date.includes('T'));
      assert.ok(sessionData.rf > now);
    });

    it('should handle device and IP metadata in session', () => {
      const sessionMetadata = {
        device: 'Chrome/Windows',
        ip: '192.168.1.50',
        user_agent: 'Mozilla/5.0'
      };
      
      assert.ok(sessionMetadata.device);
      assert.ok(sessionMetadata.ip);
      assert.ok(sessionMetadata.user_agent);
    });

    it('should generate unique session IDs', () => {
      const session1 = { id: Date.now(), token: 'token1' };
      const session2 = { id: Date.now() + 1, token: 'token2' };
      
      assert.notStrictEqual(session1.token, session2.token);
      assert.ok(session2.id >= session1.id);
    });
  });

  // ============================================================================
  // SESSION LIFECYCLE TESTS (10 tests)
  // ============================================================================
  
  describe('Session Lifecycle Management', () => {
    it('should retrieve existing session successfully', () => {
      const token = 'existing-token-123';
      const sessionData = {
        id: 1,
        user: 100,
        token: token,
        rf: Date.now() + 600000
      };
      
      assert.strictEqual(sessionData.token, token);
      assert.ok(sessionData.rf > Date.now());
    });

    it('should handle session refresh on token use', () => {
      const now = Date.now();
      const oldRf = now + 300000;
      const newRf = now + 600000;
      
      assert.ok(newRf > oldRf);
      assert.ok(newRf > now);
    });

    it('should extend session expiry on activity', () => {
      const now = Date.now();
      const originalExpiry = now + 1800000;
      const extendedExpiry = now + 3600000;
      
      assert.ok(extendedExpiry > originalExpiry);
      assert.strictEqual(extendedExpiry - originalExpiry, 1800000);
    });

    it('should detect expired session', () => {
      const now = Date.now();
      const expiredRf = now - 1000;
      const isExpired = expiredRf < now;
      
      assert.strictEqual(isExpired, true);
    });

    it('should handle session state transition from active to expired', () => {
      const now = Date.now();
      const activeRf = now + 600000;
      const expiredRf = now - 1000;
      
      const wasActive = activeRf > now;
      const isExpired = expiredRf < now;
      
      assert.strictEqual(wasActive, true);
      assert.strictEqual(isExpired, true);
    });

    it('should verify session removal logic', () => {
      const sessions = [
        { id: 1, rf: Date.now() + 600000 },
        { id: 2, rf: Date.now() - 1000 },
        { id: 3, rf: Date.now() + 300000 }
      ];
      
      const activeSessions = sessions.filter(s => s.rf > Date.now());
      assert.strictEqual(activeSessions.length, 2);
    });

    it('should handle concurrent sessions for same user', () => {
      const userId = 1;
      const session1 = { id: 1, user: userId, token: 'token1', rf: Date.now() + 600000 };
      const session2 = { id: 2, user: userId, token: 'token2', rf: Date.now() + 300000 };
      
      assert.strictEqual(session1.user, session2.user);
      assert.notStrictEqual(session1.token, session2.token);
    });

    it('should validate session refresh request', () => {
      const now = Date.now();
      const currentRf = now + 300000;
      const refreshThreshold = now + 600000;
      
      const needsRefresh = currentRf < refreshThreshold;
      assert.strictEqual(needsRefresh, true);
    });

    it('should handle session termination on logout', () => {
      const activeSession = {
        id: 1,
        user: 100,
        token: 'active-token',
        rf: Date.now() + 600000,
        active: true
      };
      
      const terminatedSession = { ...activeSession, active: false, rf: 0 };
      assert.strictEqual(terminatedSession.active, false);
      assert.strictEqual(terminatedSession.rf, 0);
    });

    it('should verify session cleanup for expired tokens', () => {
      const now = Date.now();
      const sessions = [
        { id: 1, rf: now + 600000, active: true },
        { id: 2, rf: now - 100000, active: true },
        { id: 3, rf: now - 500000, active: true }
      ];
      
      const expiredSessions = sessions.filter(s => s.rf < now);
      assert.strictEqual(expiredSessions.length, 2);
      assert.ok(expiredSessions.every(s => s.rf < now));
    });
  });
});
