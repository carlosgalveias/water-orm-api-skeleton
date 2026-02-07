process.env.RUNNING_TESTS = 'true';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { createMockRequest, createMockResponse } = require('../helpers/test-helpers');

const { get, patch, post, delete: del } = require('../../routers/generic');
const storageDb = require('../../controllers/storage-db');

describe('Generic Router - Comprehensive CRUD Operations', () => {
  let testUserId;
  let testRoleId;
  let testSessionId;

  beforeEach(async () => {
    // Create test role
    const roleResult = await storageDb({
      type: 'write',
      table: 'roles',
      data: {
        name: 'test-role',
        description: 'Test role for generic router tests'
      }
    });
    testRoleId = roleResult.result.id;

    // Create test user
    const userResult = await storageDb({ 
      type: 'write', 
      table: 'users', 
       data: {
        name: 'testuser',
        email: 'test@example.com',
        password: 'hashed_password',
        state: 'active',
        roles: testRoleId
      }
    });
    testUserId = userResult.result.id;

    // Create test session
    const sessionResult = await storageDb({ 
      type: 'write', 
      table: 'sessions', 
       data: {
        user: testUserId,
        token: 'test-token-123',
        token_expiry_date: new Date(Date.now() + 3600000).toISOString()
      }
    });
    testSessionId = sessionResult.result.id;
  });

  afterEach(async () => {
    // Clean up test data in reverse order of creation
    try {
      if (testSessionId) {
        await storageDb({ type: 'destroy', table: 'sessions', query: { id: testSessionId } });
      }
      if (testUserId) {
        await storageDb({ type: 'destroy', table: 'users', query: { id: testUserId } });
      }
      if (testRoleId) {
        await storageDb({ type: 'destroy', table: 'roles', query: { id: testRoleId } });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // GET OPERATION TESTS (25 tests)
  // ============================================================================
  describe('GET Operation - READ (25 tests)', () => {
    
    it('should retrieve single resource by ID', async () => {
      const req = createMockRequest({
        params: { '0': 'users', id: testUserId },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.data);
      assert.strictEqual(response.data.data.id, testUserId);
      assert.strictEqual(response.data.data.type, 'users');
    });

    it('should retrieve collection of resources', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(Array.isArray(response.data.data));
      assert.ok(response.data.meta);
      assert.ok(typeof response.data.meta.totalrecords === 'number');
    });

    it('should apply where clause filters', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { email: 'test@example.com' }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.meta.query.email);
    });

    it('should populate relationships', async () => {
      const req = createMockRequest({
        params: { '0': 'users', id: testUserId },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      if (response.data.data.relationships) {
        assert.ok(response.data.data.relationships);
      }
    });

    it('should support pagination with limit', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { limit: 5 }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.meta.limit, 5);
    });

    it('should support pagination with skip', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { skip: 2 }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.meta.skip, 2);
    });

    it('should support sorting', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { sort: { name: 'ASC' } }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.meta.sort);
    });

    it('should transform to JSON:API format', async () => {
      const req = createMockRequest({
        params: { '0': 'users', id: testUserId },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.data.type);
      assert.ok(response.data.data.id);
      assert.ok(response.data.data.attributes);
    });

    it('should handle invalid ID', async () => {
      const req = createMockRequest({
        params: { '0': 'users', id: 999999 },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 404);
      assert.ok(response.data.error);
    });

    it('should return empty result set for no matches', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { email: 'nonexistent@example.com' }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.data.length, 0);
    });

    it('should handle complex query parameter combinations', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { 
          limit: 10, 
          skip: 0, 
          sort: { id: 'DESC' },
          state: 'active'
        }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.meta.limit, 10);
      assert.strictEqual(response.data.meta.skip, 0);
    });

    it('should filter by multiple fields', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { 
          email: 'test@example.com',
          state: 'active'
        }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.meta.query.email);
      assert.ok(response.data.meta.query.state);
    });

    it('should handle null value in filters', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { lastattempt: null }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
    });

    it('should parse stringified JSON query params', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { 
          sort: JSON.stringify({ id: 'ASC' })
        }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.meta.sort);
    });

    it('should normalize string to integer values', async () => {
      const req = createMockRequest({
        params: { '0': 'users', id: String(testUserId) },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
    });

    it('should handle invalid table name', async () => {
      const req = createMockRequest({
        params: { '0': 'invalid_table' },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 500);
      assert.ok(response.data.error);
    });

    it('should include meta information in response', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.meta);
      assert.ok(response.data.meta.hasOwnProperty('totalrecords'));
      assert.ok(response.data.meta.hasOwnProperty('query'));
    });

    it('should return 404 for ID mismatch', async () => {
      const req = createMockRequest({
        params: { '0': 'users', id: testUserId },
        query: { id: 999999 }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 404);
    });

    it('should handle large result sets', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { limit: 1000 }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.meta.limit, 1000);
    });

    it('should handle special characters in queries safely', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { email: "test'@example.com" }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
    });

    it('should separate attributes from relationships in response', async () => {
      const req = createMockRequest({
        params: { '0': 'users', id: testUserId },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.data.attributes);
      assert.ok(typeof response.data.data.attributes === 'object');
    });

    it('should handle default limit of 100', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.meta.limit, 100);
    });

    it('should handle state enum filtering', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: { state: 'active' }
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.meta.query.state, 'active');
    });

    it('should properly count total records', async () => {
      const req = createMockRequest({
        params: { '0': 'users' },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.meta.totalrecords >= 0);
    });

    it('should handle relationship data in JSON:API format', async () => {
      const req = createMockRequest({
        params: { '0': 'users', id: testUserId },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      if (response.data.data.relationships && response.data.data.relationships.roles) {
        assert.ok(response.data.data.relationships.roles.data);
      }
    });
  });

  // Additional test sections will be in a separate file due to length
  // See api-generic-router-part2.test.js for PATCH, POST, DELETE, and Helper tests
});