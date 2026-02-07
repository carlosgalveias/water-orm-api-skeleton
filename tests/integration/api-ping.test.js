'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createMockRequest, createMockResponse } = require('../helpers/test-helpers');

describe('API - Ping Endpoint', () => {
  let ping;

  it('should load ping router', () => {
    ping = require('../../routers/ping');
    assert.ok(ping);
  });

  describe('GET /ping', () => {
    it('should return success message', () => {
      const req = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      
      ping.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.message);
      assert.ok(response.data.message.includes('ping'));
      assert.ok(response.data.message.includes('GET'));
    });

    it('should include method in message', () => {
      const req = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      
      ping.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.ok(response.data.message.toLowerCase().includes('get'));
    });
  });

  describe('POST /ping', () => {
    it('should return success message', () => {
      const req = createMockRequest({ method: 'POST' });
      const mockRes = createMockResponse();
      
      ping.post(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.message);
      assert.ok(response.data.message.includes('POST'));
    });
  });

  describe('PATCH /ping', () => {
    it('should return success message', () => {
      const req = createMockRequest({ method: 'PATCH' });
      const mockRes = createMockResponse();
      
      ping.patch(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.message);
      assert.ok(response.data.message.includes('PATCH'));
    });
  });

  describe('DELETE /ping', () => {
    it('should return success message', () => {
      const req = createMockRequest({ method: 'DELETE' });
      const mockRes = createMockResponse();
      
      ping.delete(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
      assert.ok(response.data.message);
      assert.ok(response.data.message.includes('DELETE'));
    });
  });

  describe('Response Format', () => {
    it('should return consistent response structure', () => {
      const req = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      
      ping.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.ok(response.statusCode);
      assert.ok(response.data);
      assert.ok(typeof response.data === 'object');
    });

    it('should return message as string', () => {
      const req = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      
      ping.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(typeof response.data.message, 'string');
    });
  });

  describe('Health Check', () => {
    it('should serve as basic health check', () => {
      const req = createMockRequest({ method: 'GET' });
      const mockRes = createMockResponse();
      
      ping.get(req, mockRes);
      const response = mockRes.getResponse();
      
      // If we get a 200, the API is responsive
      assert.strictEqual(response.statusCode, 200);
    });

    it('should work without authentication', () => {
      const req = createMockRequest({
        method: 'GET',
        isAuthenticated: false
      });
      const mockRes = createMockResponse();
      
      ping.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
    });

    it('should work without headers', () => {
      const req = createMockRequest({
        method: 'GET',
        headers: {}
      });
      const mockRes = createMockResponse();
      
      ping.get(req, mockRes);
      const response = mockRes.getResponse();
      
      assert.strictEqual(response.statusCode, 200);
    });
  });

  describe('All HTTP Methods', () => {
    const methods = ['get', 'post', 'patch', 'delete'];

    methods.forEach(method => {
      it(`should handle ${method.toUpperCase()} requests`, () => {
        const req = createMockRequest({ method: method.toUpperCase() });
        const mockRes = createMockResponse();
        
        ping[method](req, mockRes);
        const response = mockRes.getResponse();
        
        assert.strictEqual(response.statusCode, 200);
        assert.ok(response.data.message);
      });
    });
  });
});