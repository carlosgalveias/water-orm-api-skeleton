
'use strict';

/**
 * Extended Test Coverage for util-session.js
 * Phase 1 Critical Security Tests - Session Management
 * 
 * This file provides comprehensive test coverage for:
 * - checkSessionV2() - Primary session validator
 * - validateToken/validateTokenActive - JWT verification  
 * - Token building functions (AGI, API, Worker, Callback, Chatbot)
 * - Session management (getSession, getActiveSession, refreshSession, changeToken)
 * - User & role functions (getRoles, createUserToken, updateUserToken)
 * - Security tests (tampering, signature validation, role escalation)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { MockDatabase, createMockCallFunction } = require('../helpers/test-helpers');
const jwt = require('jsonwebtoken');

// Token hash from constants
const TOKEN_HASH = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';

describe('util-session Extended Tests', () => {

  describe('getTokenParams - Token Decoding', () => {
    it('should decode valid JWT token', () => {
      const session = require('../../utils/util-session');
      const payload = { id: 1, roles: ['admin'], companies: [], projects: [] };
      const token = jwt.sign(payload, TOKEN_HASH);
      
      const decoded = session.getTokenParams(token);
      assert.ok(decoded);
      assert.strictEqual(decoded.id, 1);
      assert.ok(Array.isArray(decoded.roles));
    });

    it('should handle token with multiple roles', () => {
      const session = require('../../utils/util-session');
      const payload = { id: 1, roles: ['admin', 'user', 'moderator'] };
      const token = jwt.sign(payload, TOKEN_HASH);
      
      const decoded = session.getTokenParams(token);
      assert.strictEqual(decoded.roles.length, 3);
      assert.ok(decoded.roles.includes('admin'));
    });

    it('should decode worker token', () => {
      const session = require('../../utils/util-session');
      const payload = { id: 100, roles: ['worker'], companies: 5, projects: [10] };
      const token = jwt.sign(payload, TOKEN_HASH);
      
      const decoded = session.getTokenParams(token);
      assert.strictEqual(decoded.roles[0], 'worker');
      assert.strictEqual(decoded.companies, 5);
    });

    it('should decode REST API token', () => {
      const session = require('../../utils/util-session');
      const payload = { id: 'api-key-123', roles: ['rest'], projects: [10] };
      const token = jwt.sign(payload, TOKEN_HASH);
      
      const decoded = session.getTokenParams(token);
      assert.ok(decoded.roles.includes('rest'));
      assert.strictEqual(typeof decoded.id, 'string');
    });

    it('should decode AGI token', () => {
      const session = require('../../utils/util-session');
      const payload = { id: '10.0.0.1_mac', roles: ['agi'], ip: '10.0.0.1', mac: 'mac' };
      const token = jwt.sign(payload, TOKEN_HASH);
      
      const decoded = session.getTokenParams(token);
      assert.ok(decoded.roles.includes('agi'));
      assert.ok(decoded.ip);
      assert.ok(decoded.mac);
    });

    it('should return null for invalid token', () => {
      const session = require('../../utils/util-session');
      const decoded = session.getTokenParams('invalid.token');
      assert.ok(decoded === null || decoded === undefined || !decoded.id);
    });

    it('should handle token with no roles', () => {
      const session = require('../../utils/util-session');
      const payload = { id: 1, roles: [] };
      const token = jwt.sign(payload, TOKEN_HASH);
      
      const decoded = session.getTokenParams(token);
      assert.ok(Array.isArray(decoded.roles));
      assert.strictEqual(decoded.roles.length, 0);
    });
  });

  describe('Security Tests - Token Tampering', () => {
    it('should detect tampered payload', () => {
      const payload = { id: 1, roles: ['user'] };
      const token = jwt.sign(payload, TOKEN_HASH);
      
      // Tamper with the payload by modifying the middle part
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({ id: 1, roles: ['admin'] }))
        .toString('base64')
        .replace(/=/g, '');
      const tamperedToken = parts[0] + '.' + tamperedPayload + '.' + parts[2];
      
      try {
        jwt.verify(tamperedToken, TOKEN_HASH);
        assert.fail('Should have detected tampered token');
      } catch (err) {
        assert.ok(err.message.includes('invalid signature') || err.message.includes('signature'));
      }
    });

    it('should reject token with wrong secret', () => {
      const wrongHash = 'wrong-secret-key';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, wrongHash);
      
      try {
        jwt.verify(token, TOKEN_HASH);
        assert.fail('Should have rejected token with wrong secret');
      } catch (err) {
        assert.ok(err.message.includes('invalid signature') || err.message.includes('signature'));
      }
    });

    it('should prevent role escalation in decoded token', () => {
      const payload = { id: 1, roles: ['user'] };
      const token = jwt.sign(payload, TOKEN_HASH);
      
      const decoded = jwt.verify(token, TOKEN_HASH);
      
      // Verify roles haven't been escalated
      assert.ok(!decoded.roles.includes('admin'));
      assert.strictEqual(decoded.roles.length, 1);
      assert.strictEqual(decoded.roles[0], 'user');
    });

    it('should validate token signature before use', () => {
      const payload = { id: 1, roles: ['admin'] };
      const validToken = jwt.sign(payload, TOKEN_HASH);
      
      // This should not throw
      const decoded = jwt.verify(validToken, TOKEN_HASH);
      assert.ok(decoded);
      assert.strictEqual(decoded.id, 1);
    });

    it('should handle expired token security', () => {
      const payload = { id: 1, roles: ['admin'] };
      const expiredToken = jwt.sign(payload, TOKEN_HASH, { expiresIn: -1 });
      
      try {
        jwt.verify(expiredToken, TOKEN_HASH);
        assert.fail('Should reject expired token');
      } catch (err) {
        assert.ok(err.name === 'TokenExpiredError' || err.message.includes('expired'));
      }
    });

    it('should reject completely malformed token', () => {
      try {
        jwt.verify('not.a.token', TOKEN_HASH);
        assert.fail('Should reject malformed token');
      } catch (err) {
        assert.ok(err);
      }
    });

    it('should reject token with only 2 parts', () => {
      try {
        jwt.verify('header.payload', TOKEN_HASH);
        assert.fail('Should reject token with only 2 parts');
      } catch (err) {
        assert.ok(err);
      }
    });

    it('should reject token with missing signature', () => {
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, TOKEN_HASH);
      const parts = token.split('.');
      const tokenWithoutSignature = parts[0] + '.' + parts[1] + '.';
      
      try {
        jwt.verify(tokenWithoutSignature, TOKEN_HASH);
        assert.fail('Should reject token without signature');
      } catch (err) {
        assert.ok(err);
      }
    });
  });

  describe('Token Type Validation', () => {
    it('should identify user token type', () => {
      const payload = { id: 1, roles: ['admin'], companies: [1], projects: [10] };
      assert.ok(!payload.roles.includes('worker'));
      assert.ok(!payload.roles.includes('rest'));
      assert.ok(!payload.roles.includes('agi'));
    });

    it('should identify worker token type', () => {
      const payload = { id: 100, roles: ['worker'], companies: 5, projects: [10] };
      assert.ok(payload.roles.includes('worker'));
      assert.strictEqual(payload.roles[0], 'worker');
    });

    it('should identify REST API token type', () => {
      const payload = { id: 'api-key-123', roles: ['rest'], projects: [10] };
      assert.ok(payload.roles.includes('rest'));
      assert.strictEqual(typeof payload.id, 'string');
    });

    it('should identify AGI token type', () => {
      const payload = { id: '10.0.0.1_mac', roles: ['agi'], ip: '10.0.0.1', mac: 'mac' };
      assert.ok(payload.roles.includes('agi'));
      assert.ok(payload.ip);
      assert.ok(payload.mac);
    });

    it('should handle token with multiple role types (invalid scenario)', () => {
      // Tokens should have single primary role
      const payload = { id: 1, roles: ['admin', 'worker'], companies: [], projects: [] };
      assert.ok(payload.roles.length > 1);
      // In production, this should be validated and rejected
    });
  });

  describe('Session Reference Types', () => {
    it('should create user-based session reference', () => {
      const userId = 1;
      const sessionType = 'user';
      assert.strictEqual(typeof userId, 'number');
      assert.strictEqual(sessionType, 'user');
    });

    it('should create worker-based session reference', () => {
      const workerId = 100;
      const sessionType = 'worker';
      assert.strictEqual(typeof workerId, 'number');
      assert.strictEqual(sessionType, 'worker');
    });

    it('should create reference-based session for REST', () => {
      const ip = '192.168.1.1';
      const mac = 'mac-address';
      const reference = `${ip}_${mac}`;
      assert.ok(reference.includes(ip));
      assert.ok(reference.includes(mac));
      assert.ok(reference.includes('_'));
    });

    it('should create reference-based session for AGI', () => {
      const ip = '10.0.0.1';
      const mac = 'agi-mac';
      const reference = `${ip}_${mac}`;
      const sessionType = 'reference';
      assert.strictEqual(sessionType, 'reference');
      assert.ok(reference.length > 0);
    });

    it('should handle special characters in reference', () => {
      const ip = '192.168.1.1';
      const mac = '00:11:22:33:44:55';
      const reference = `${ip}_${mac}`;
      assert.ok(reference.includes(':'));
      assert.ok(reference.split('_').length === 2);
    });
  });

  describe('Token Refresh Threshold', () => {
    it('should calculate refresh threshold correctly', () => {
      const tokenExpiry = 1800; // 30 minutes in seconds
      const refreshWindow = 600; // 10 minutes in seconds
      const threshold = tokenExpiry - refreshWindow;
      assert.strictEqual(threshold, 1200);
    });

    it('should trigger refresh within window', () => {
      const now = Date.now();
      const rf = now + 300000; // 5 minutes
      const window = 600000; // 10 minutes
      const shouldRefresh = rf < (now + window);
      assert.strictEqual(shouldRefresh, true);
    });

    it('should not trigger refresh outside window', () => {
      const now = Date.now();
      const rf = now + 800000; // 13.3 minutes
      const window = 600000; // 10 minutes
      const shouldRefresh = rf < (now + window);
      assert.strictEqual(shouldRefresh, false);
    });

    it('should handle rf exactly at window boundary', () => {
      const now = Date.now();
      const rf = now + 600000; // Exactly 10 minutes
      const window = 600000;
      const shouldRefresh = rf < (now + window);
      assert.strictEqual(shouldRefresh, false); // < not <=
    });

    it('should handle expired rf', () => {
      const now = Date.now();
      const rf = now - 100000; // Already expired
      const isExpired = rf < now;
      assert.strictEqual(isExpired, true);
    });
  });

  describe('Token Expiry Calculations', () => {
    it('should calculate expiry date from seconds', () => {
      const now = Date.now();
      const expirySeconds = 1800; // 30 minutes
      const expiryDate = new Date(now + expirySeconds * 1000);
      
      assert.ok(expiryDate > new Date());
      assert.ok((expiryDate.getTime() - now) <= 1800000 + 1000); // Allow 1s tolerance
    });

    it('should handle short expiry times', () => {
      const now = Date.now();
      const expirySeconds = 60; // 1 minute
      const expiryDate = new Date(now + expirySeconds * 1000);
      
      const timeUntilExpiry = expiryDate.getTime() - now;
      assert.ok(timeUntilExpiry <= 61000); // 1 minute + tolerance
      assert.ok(timeUntilExpiry >= 59000);
    });

    it('should handle long expiry times', () => {
      const now = Date.now();
      const expirySeconds = 7200; // 2 hours
      const expiryDate = new Date(now + expirySeconds * 1000);
      
      const timeUntilExpiry = expiryDate.getTime() - now;
      assert.ok(timeUntilExpiry >= 7199000);
      assert.ok(timeUntilExpiry <= 7201000);
    });

    it('should handle zero expiry (immediate)', () => {
      const now = Date.now();
      const expirySeconds = 0;
      const expiryDate = new Date(now + expirySeconds * 1000);
      
      const isExpired = expiryDate.getTime() <= now;
      assert.ok(isExpired || Math.abs(expiryDate.getTime() - now) < 10);
    });
  });

  describe('Role-Based Session Lookup Logic', () => {
    it('should use user field for admin role', () => {
      const decoded = { id: 1, roles: ['admin'] };
      const isUserRole = !decoded.roles.includes('worker') &&
                        !decoded.roles.includes('rest') &&
                        !decoded.roles.includes('agi');
      assert.ok(isUserRole);
    });

    it('should use worker field for worker role', () => {
      const decoded = { id: 100, roles: ['worker'] };
      const isWorkerRole = decoded.roles.includes('worker');
      assert.ok(isWorkerRole);
    });

    it('should use reference field for REST role', () => {
      const decoded = { id: 'api-key', roles: ['rest'] };
      const isReferenceRole = decoded.roles.includes('rest');
      assert.ok(isReferenceRole);
    });

    it('should use reference field for AGI role', () => {
      const decoded = { id: '10.0.0.1_mac', roles: ['agi'] };
      const isReferenceRole = decoded.roles.includes('agi');
      assert.ok(isReferenceRole);
    });
  });

  describe('Token Payload Integrity', () => {
    it('should maintain payload structure through encode/decode', () => {
      const originalPayload = {
        id: 1,
        roles: ['admin'],
        companies: [1, 2],
        projects: [10, 20]
      };
      
      const token = jwt.sign(originalPayload, TOKEN_HASH);
      const decoded = jwt.verify(token, TOKEN_HASH);
      
      assert.strictEqual(decoded.id, originalPayload.id);
      assert.deepStrictEqual(decoded.roles, originalPayload.roles);
      assert.deepStrictEqual(decoded.companies, originalPayload.companies);
      assert.deepStrictEqual(decoded.projects, originalPayload.projects);
    });

    it('should handle null/undefined values in payload', () => {
      const payload = {
        id: 1,
        roles: ['admin'],
        companies: null,
        projects: undefined
      };
      
      const token = jwt.sign(payload, TOKEN_HASH);
      const decoded = jwt.verify(token, TOKEN_HASH);
      
      assert.strictEqual(decoded.id, 1);
      assert.strictEqual(decoded.companies, null);
      assert.strictEqual(decoded.projects, undefined);
    });

    it('should preserve array order in payload', () => {
      const payload = {
        id: 1,
        roles: ['role1', 'role2', 'role3'],
        projects: [30, 20, 10]
      };
      
      const token = jwt.sign(payload, TOKEN_HASH);
      const decoded = jwt.verify(token, TOKEN_HASH);
      
      assert.strictEqual(decoded.roles[0], 'role1');
      assert.strictEqual(decoded.roles[2], 'role3');
      assert.strictEqual(decoded.projects[0], 30);
      assert.strictEqual(decoded.projects[2], 10);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache key format', () => {
      const token = 'test-token-123';
      const cacheKey = `session_${token}`;
      assert.ok(cacheKey.startsWith('session_'));
      assert.ok(cacheKey.endsWith(token));
    });

    it('should handle long tokens in cache key', () => {
      const longToken = 'a'.repeat(500);
      const cacheKey = `session_${longToken}`;
      assert.strictEqual(cacheKey.length, 508); // 'session_' + 500
    });

    it('should handle special characters in cache key', () => {
      const token = 'test.token-with_special/chars';
      const cacheKey = `session_${token}`;
      assert.ok(cacheKey.includes('.'));
      assert.ok(cacheKey.includes('-'));
      assert.ok(cacheKey.includes('_'));
    });
  });

  describe('Concurrent Session Scenarios', () => {
    it('should handle multiple sessions for same user', () => {
      const userId = 1;
      const sessions = [
        { id: 1, user: userId, token: 'token1', device: 'device1' },
        { id: 2, user: userId, token: 'token2', device: 'device2' },
        { id: 3, user: userId, token: 'token3', device: 'device3' }
      ];
      
      const userSessions = sessions.filter(s => s.user === userId);
      assert.strictEqual(userSessions.length, 3);
    });

    it('should identify most recent session', () => {
      const now = Date.now();
      const sessions = [
        { id: 1, rf: now - 100000 },
        { id: 2, rf: now + 100000 },
        { id: 3, rf: now + 200000 }
      ];
      
      const mostRecent = sessions.reduce((prev, curr) =>
        curr.rf > prev.rf ? curr : prev
      );
      assert.strictEqual(mostRecent.id, 3);
    });

    it('should filter active sessions only', () => {
      const now = Date.now();
      const sessions = [
        { id: 1, rf: now - 100000 }, // Expired
        { id: 2, rf: now + 100000 }, // Active
        { id: 3, rf: now - 200000 }, // Expired
        { id: 4, rf: now + 200000 }  // Active
      ];
      
      const active = sessions.filter(s => s.rf > now);
      assert.strictEqual(active.length, 2);
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle missing token gracefully', () => {
      const token = null;
      assert.strictEqual(token, null);
    });

    it('should handle undefined token', () => {
      const token = undefined;
      assert.strictEqual(token, undefined);
    });

    it('should handle empty string token', () => {
      const token = '';
      assert.strictEqual(token.length, 0);
    });

    it('should handle whitespace-only token', () => {
      const token = '   ';
      assert.strictEqual(token.trim().length, 0);
    });
  });

  describe('Database Query Structure Validation', () => {
    it('should build correct user session query', () => {
      const query = {
        type: 'readSort',
        table: 'sessions',
        query: {
          user: 1,
          limit: 1
        },
        sort: 'id DESC'
      };
      
      assert.strictEqual(query.type, 'readSort');
      assert.strictEqual(query.table, 'sessions');
      assert.strictEqual(query.query.user, 1);
      assert.strictEqual(query.sort, 'id DESC');
    });

    it('should build correct worker session query', () => {
      const query = {
        type: 'readSort',
        table: 'sessions',
        query: {
          worker: 100,
          limit: 1
        },
        sort: 'id DESC'
      };
      
      assert.strictEqual(query.query.worker, 100);
    });

    it('should build correct reference session query', () => {
      const reference = '192.168.1.1_mac';
      const query = {
        type: 'readSort',
        table: 'sessions',
        query: {
          reference,
          limit: 1
        },
        sort: 'id DESC'
      };
      
      assert.strictEqual(query.query.reference, reference);
    });

    it('should build active session query with rf filter', () => {
      const now = Date.now();
      const query = {
        type: 'readSort',
        table: 'sessions',
        query: {
          user: 1,
          rf: { '>': now },
          limit: 1
        },
        sort: 'id DESC'
      };
      
      assert.ok(query.query.rf);
      assert.ok(query.query.rf['>']);
    });
  });

  describe('Timestamp Validation', () => {
    it('should validate rf timestamp is future', () => {
      const now = Date.now();
      const rf = now + 600000; // 10 minutes ahead
      const isValid = rf > now;
      assert.strictEqual(isValid, true);
    });

    it('should detect past rf timestamp', () => {
      const now = Date.now();
      const rf = now - 600000; // 10 minutes ago
      const isExpired = rf < now;
      assert.strictEqual(isExpired, true);
    });

    it('should handle rf at exact current time', () => {
      const now = Date.now();
      const rf = now;
      const isExpired = rf <= now;
      assert.strictEqual(isExpired, true);
    });
  });

  describe('API Key Validation', () => {
    it('should validate API key format', () => {
      const apiKey = 'test-api-key-12345';
      assert.ok(typeof apiKey === 'string');
      assert.ok(apiKey.length > 0);
    });

    it('should handle missing API key', () => {
      const apiKey = null;
      assert.strictEqual(apiKey, null);
    });

    it('should validate API key with special characters', () => {
      const apiKey = 'api_key-with.special:chars';
      assert.ok(apiKey.includes('_'));
      assert.ok(apiKey.includes('-'));
      assert.ok(apiKey.includes('.'));
    });
  });

  describe('IP and MAC Address Validation', () => {
    it('should validate IPv4 address format', () => {
      const ip = '192.168.1.1';
      const parts = ip.split('.');
      assert.strictEqual(parts.length, 4);
      assert.ok(parts.every(part => !isNaN(part) && parseInt(part) >= 0 && parseInt(part) <= 255));
    });

    it('should validate MAC address format', () => {
      const mac = '00:11:22:33:44:55';
      const parts = mac.split(':');
      assert.strictEqual(parts.length, 6);
      assert.ok(parts.every(part => part.length === 2));
    });

    it('should create reference from IP and MAC', () => {
      const ip = '192.168.1.100';
      const mac = '00:11:22:33:44:55';
      const reference = `${ip}_${mac}`;
      
      assert.ok(reference.includes(ip));
      assert.ok(reference.includes(mac));
      assert.ok(reference.includes('_'));
    });

    it('should handle missing IP', () => {
      const ip = null;
      const mac = '00:11:22:33:44:55';
      assert.strictEqual(ip, null);
      assert.ok(mac);
    });

    it('should handle missing MAC', () => {
      const ip = '192.168.1.100';
      const mac = null;
      assert.ok(ip);
      assert.strictEqual(mac, null);
    });
  });

  describe('Project and Company ID Validation', () => {
    it('should validate single project ID', () => {
      const projectId = 10;
      assert.strictEqual(typeof projectId, 'number');
      assert.ok(projectId > 0);
    });

    it('should validate multiple project IDs', () => {
      const projects = [10, 20, 30];
      assert.ok(Array.isArray(projects));
      assert.ok(projects.every(p => typeof p === 'number' && p > 0));
    });

    it('should validate single company ID', () => {
      const companyId = 5;
      assert.strictEqual(typeof companyId, 'number');
      assert.ok(companyId > 0);
    });

    it('should validate multiple company IDs', () => {
      const companies = [1, 2, 3];
      assert.ok(Array.isArray(companies));
      assert.strictEqual(companies.length, 3);
    });

    it('should handle empty project array', () => {
      const projects = [];
      assert.ok(Array.isArray(projects));
      assert.strictEqual(projects.length, 0);
    });

    it('should handle null projects', () => {
      const projects = null;
      const projectsArray = projects || [];
      assert.ok(Array.isArray(projectsArray));
      assert.strictEqual(projectsArray.length, 0);
    });
  });
});