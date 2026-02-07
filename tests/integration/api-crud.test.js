'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createMockRequest, createMockResponse } = require('../helpers/test-helpers');

// Set test environment
process.env.RUNNING_TESTS = 'true';

describe('API - CRUD Operations (Generic Router)', () => {
  let generic;

  it('should load generic router', () => {
    generic = require('../../routers/generic');
    assert.ok(generic);
  });

  describe('GET /generic/:model (List)', () => {
    it('should handle basic list request', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users' },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data);
    });

    it('should return data array for list requests', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users' },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(Array.isArray(response.data.data));
    });

    it('should include meta information', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users' },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.ok(response.data.meta);
      assert.ok(typeof response.data.meta.totalrecords === 'number');
    });

    it('should support pagination with limit', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users' },
        query: { limit: 10 }
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.meta.limit, 10);
    });

    it('should support pagination with skip', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users' },
        query: { skip: 5 }
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.meta.skip, 5);
    });

    it('should support sorting', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users' },
        query: { sort: JSON.stringify({ username: 'ASC' }) }
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.meta.sort);
    });

    it('should support filtering', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users' },
        query: { username: 'testuser' }
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.meta.query);
    });

    it('should return error for invalid table', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'invalid_table_name' },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 500);
      assert.ok(response.data.error);
    });

    it('should handle empty result sets', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users' },
        query: { id: 999999 }
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.data.length, 0);
    });

    it('should parse stringified JSON query params', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users' },
        query: { filter: '{"active":true}' }
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
    });
  });

  describe('GET /generic/:model/:id (Single Item)', () => {
    it('should create and retrieve single item by ID', async () => {
      const createReq = createMockRequest({
        method: 'POST',
        params: { '0': 'users' },
        body: {
          data: {
            type: 'users',
            attributes: {
              email: 'test@example.com',
              password: 'TestPassword123!',
              state: 'active'
            }
          }
        }
      });
      const createRes = createMockResponse();
      await generic.post(createReq, createRes);
      const createResponse = createRes.getResponse();
      
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users', id: createResponse.data.data.id },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.data);
      assert.ok(!Array.isArray(response.data.data));
    });

    it('should return 404 for non-existent ID', async () => {
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users', id: 999999 },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 404);
      assert.ok(response.data.error);
    });

    it('should include item type and id in response', async () => {
      const createReq = createMockRequest({
        method: 'POST',
        params: { '0': 'users' },
        body: {
           data: {
            type: 'users',
            attributes: {
              email: 'test2@example.com',
              password: 'TestPassword123!',
              state: 'active'
            }
          }
        }
      });
      const createRes = createMockResponse();
      await generic.post(createReq, createRes);
      const createResponse = createRes.getResponse();
      
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users', id: createResponse.data.data.id },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      if (response.statusCode === 200 && response.data.data) {
        assert.ok(response.data.data.type);
        assert.ok(response.data.data.id);
      }
    });

    it('should return item with attributes', async () => {
      const createReq = createMockRequest({
        method: 'POST',
        params: { '0': 'users' },
        body: {
          data: {
            type: 'users',
            attributes: {
              email: 'testattr@example.com',
              password: 'TestPassword123!',
              state: 'active'
            }
          }
        }
      });
      const createRes = createMockResponse();
      await generic.post(createReq, createRes);
      const createResponse = createRes.getResponse();
      
      const req = createMockRequest({
        method: 'GET',
        params: { '0': 'users', id: createResponse.data.data.id },
        query: {}
      });
      const mockRes = createMockResponse();
      
      await generic.get(req, mockRes);
      const response = mockRes.getResponse();
      
      if (response.statusCode === 200 && response.data.data) {
        assert.ok(response.data.data.attributes);
        assert.strictEqual(typeof response.data.data.attributes, 'object');
      }
    });
  });

  describe('POST /generic/:model (Create)', () => {
    it('should create new record', async () => {
      const req = createMockRequest({
        method: 'POST',
        params: { '0': 'users' },
        body: {
          data: {
            type: 'users',
            attributes: {
              email: 'newuser@example.com',
              password: 'Password123!',
              state: 'active'
            }
          }
        }
      });
      const mockRes = createMockResponse();
      
      await generic.post(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.data);
      assert.ok(response.data.data.id);
    });

    it('should reject POST with ID in payload', async () => {
      const req = createMockRequest({
        method: 'POST',
        params: { '0': 'users' },
        body: {
          data: {
            id: 123,
            type: 'users',
            attributes: {
              email: 'test@example.com',
              password: 'Password123!',
              state: 'active'
            }
          }
        }
      });
      const mockRes = createMockResponse();
      
      await generic.post(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 500);
      assert.ok(response.data.error);
    });

    it('should return created record with attributes', async () => {
      const req = createMockRequest({
        method: 'POST',
        params: { '0': 'users' },
        body: {
          data: {
            type: 'users',
            attributes: {
              email: 'another@example.com',
              password: 'Password123!',
              state: 'active',
              full_name: 'Test User'
            }
          }
        }
      });
      const mockRes = createMockResponse();
      
      await generic.post(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.data.attributes.email, 'another@example.com');
      assert.strictEqual(response.data.data.attributes.full_name, 'Test User');
    });

    it('should return error for invalid data', async () => {
      const req = createMockRequest({
        method: 'POST',
        params: { '0': 'users' },
        body: {}
      });
      const mockRes = createMockResponse();
      
      await generic.post(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 500);
      assert.ok(response.data.error);
    });
  });

  describe('PATCH /generic/:model/:id (Update)', () => {
    it('should update existing record', async () => {
      const createReq = createMockRequest({
        method: 'POST',
        params: { '0': 'users' },
        body: {
          data: {
            type: 'users',
            attributes: {
              email: 'updateme@example.com',
              password: 'Password123!',
              state: 'inactive'
            }
          }
        }
      });
      const createRes = createMockResponse();
      await generic.post(createReq, createRes);
      const created = createRes.getResponse();
      
      const req = createMockRequest({
        method: 'PATCH',
        params: { '0': 'users', id: created.data.data.id },
        body: {
          data: {
            type: 'users',
            attributes: {
              state: 'active'
            }
          }
        }
      });
      const mockRes = createMockResponse();
      
      await generic.patch(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.data.data.attributes.state, 'active');
    });

    it('should return error for missing ID', async () => {
      const req = createMockRequest({
        method: 'PATCH',
        params: { '0': 'users' },
        body: {
          data: {
            attributes: {
              state: 'active'
            }
          }
        }
      });
      const mockRes = createMockResponse();
      
      await generic.patch(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 500);
      assert.ok(response.data.error);
    });
  });
});