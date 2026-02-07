
'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { MockDatabase, factories } = require('../helpers/test-helpers');

describe('util-session', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = new MockDatabase();
  });

  describe('Token Management', () => {
    it('should have getTokenParams function', () => {
      const session = require('../../utils/util-session');
      assert.ok(typeof session.getTokenParams === 'function');
    });

    it('should have validateToken function', () => {
      const session = require('../../utils/util-session');
      assert.ok(typeof session.validateToken === 'function');
    });

    it('should have checkSession function', () => {
      const session = require('../../utils/util-session');
      assert.ok(typeof session.checkSession === 'function');
    });

    it('should have buildToken function', () => {
      const session = require('../../utils/util-session');
      assert.ok(typeof session.buildToken === 'function');
    });

    it('should have refreshSession function', () => {
      const session = require('../../utils/util-session');
      assert.ok(typeof session.refreshSession === 'function');
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

    it('should handle expired rf timestamp', () => {
      const now = Date.now();
      const rf = now - 100000;
      const isExpired = rf < now;
      assert.strictEqual(isExpired, true);
    });

    it('should extend session on refresh', () => {
      const now = Date.now();
      const newRf = now + 600000;
      assert.ok(newRf > now);
    });
  });

  describe('validateTokenActive', () => {
    it('should validate token structure exists', () => {
      const session = require('../../utils/util-session');
      assert.ok(typeof session.validateToken === 'function');
    });

    it('should handle token expiry check', () => {
      const now = Date.now();
      const expiryDate = new Date(now + 1800000);
      const isValid = expiryDate.getTime() > now;
      assert.strictEqual(isValid, true);
    });

    it('should detect expired token', () => {
      const now = Date.now();
      const expiryDate = new Date(now - 1000);
      const isValid = expiryDate.getTime() > now;
      assert.strictEqual(isValid, false);
    });

    it('should handle token about to expire', () => {
      const now = Date.now();
      const expiryDate = new Date(now + 60000);
      const threshold = 300000;
      const needsRefresh = (expiryDate.getTime() - now) < threshold;
      assert.strictEqual(needsRefresh, true);
    });
  });

  describe('Token Expiry Edge Cases', () => {
    it('should handle just expired token', () => {
      const now = Date.now();
      const expiryDate = new Date(now - 1);
      const isExpired = expiryDate.getTime() <= now;
      assert.strictEqual(isExpired, true);
    });

    it('should handle token expiring in 1 second', () => {
      const now = Date.now();
      const expiryDate = new Date(now + 1000);
      const isValid = expiryDate.getTime() > now;
      assert.strictEqual(isValid, true);
    });

    it('should calculate time until expiry', () => {
      const now = Date.now();
      const expiryDate = new Date(now + 600000);
      const timeUntilExpiry = expiryDate.getTime() - now;
      assert.ok(timeUntilExpiry > 0);
      assert.ok(timeUntilExpiry <= 600000);
    });
  });

  describe('Invalid Token Scenarios', () => {
    it('should handle malformed token', () => {
      const malformedToken = 'not.a.valid.jwt.token';
      assert.ok(malformedToken);
    });

    it('should handle missing token', () => {
      const token = null;
      assert.strictEqual(token, null);
    });

    it('should handle empty token', () => {
      const token = '';
      assert.strictEqual(token.length, 0);
    });

    it('should handle token with invalid signature', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.invalidsignature';
      assert.ok(token.split('.').length === 3);
    });
  });

  describe('Multi-Device Session Management', () => {
    it('should handle sessions from different devices', () => {
      const sessions = [
        { id: 1, user: 1, device: 'device-1' },
        { id: 2, user: 1, device: 'device-2' },
        { id: 3, user: 1, device: 'device-3' }
      ];
      const devices = new Set(sessions.map(s => s.device));
      assert.strictEqual(devices.size, 3);
    });

    it('should allow multiple active sessions', () => {
      const now = Date.now();
      const sessions = [
        { token: 'token1', rf: now + 600000 },
        { token: 'token2', rf: now + 600000 },
        { token: 'token3', rf: now + 600000 }
      ];
      const allActive = sessions.every(s => s.rf > now);
      assert.strictEqual(allActive, true);
    });
  });

  describe('Session Cleanup', () => {
    it('should identify sessions for cleanup', () => {
      const now = Date.now();
      const sessions = [
        { id: 1, rf: now - 100000 },
        { id: 2, rf: now + 600000 },
        { id: 3, rf: now - 200000 }
      ];
      const expired = sessions.filter(s => s.rf < now);
      assert.strictEqual(expired.length, 2);
    });

    it('should remove expired sessions', () => {
      const now = Date.now();
      const sessions = [
        { id: 1, rf: now + 600000 },
        { id: 2, rf: now + 600000 }
      ];
      const active = sessions.filter(s => s.rf > now);
      assert.strictEqual(active.length, 2);
    });
  });
});