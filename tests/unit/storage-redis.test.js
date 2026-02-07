'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { MockRedis } = require('../helpers/test-helpers');

describe('storage-redis', () => {
  let mockRedis;

  beforeEach(() => {
    mockRedis = new MockRedis();
  });

  afterEach(() => {
    mockRedis.clear();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      await mockRedis.set('test-key', 'test-value');
      const value = await mockRedis.get('test-key');
      
      assert.strictEqual(value, 'test-value');
    });

    it('should return null for non-existent key', async () => {
      const value = await mockRedis.get('non-existent');
      
      assert.strictEqual(value, null);
    });

    it('should delete a key', async () => {
      await mockRedis.set('test-key', 'test-value');
      const deleted = await mockRedis.del('test-key');
      const value = await mockRedis.get('test-key');
      
      assert.strictEqual(deleted, 1);
      assert.strictEqual(value, null);
    });

    it('should return 0 when deleting non-existent key', async () => {
      const deleted = await mockRedis.del('non-existent');
      
      assert.strictEqual(deleted, 0);
    });
  });

  describe('Key Existence', () => {
    it('should check if key exists', async () => {
      await mockRedis.set('test-key', 'value');
      const exists = await mockRedis.exists('test-key');
      
      assert.strictEqual(exists, 1);
    });

    it('should return 0 for non-existent key', async () => {
      const exists = await mockRedis.exists('non-existent');
      
      assert.strictEqual(exists, 0);
    });
  });

  describe('Key Patterns', () => {
    it('should find keys by pattern', async () => {
      await mockRedis.set('user:1', 'Alice');
      await mockRedis.set('user:2', 'Bob');
      await mockRedis.set('session:1', 'data');
      
      const userKeys = await mockRedis.keys('user:*');
      
      assert.strictEqual(userKeys.length, 2);
      assert.ok(userKeys.includes('user:1'));
      assert.ok(userKeys.includes('user:2'));
    });

    it('should return empty array when no keys match', async () => {
      const keys = await mockRedis.keys('non-existent:*');
      
      assert.strictEqual(keys.length, 0);
    });

    it('should match all keys with *', async () => {
      await mockRedis.set('key1', 'value1');
      await mockRedis.set('key2', 'value2');
      await mockRedis.set('key3', 'value3');
      
      const allKeys = await mockRedis.keys('*');
      
      assert.strictEqual(allKeys.length, 3);
    });
  });

  describe('Data Types', () => {
    it('should store and retrieve strings', async () => {
      await mockRedis.set('string-key', 'hello world');
      const value = await mockRedis.get('string-key');
      
      assert.strictEqual(value, 'hello world');
    });

    it('should store and retrieve numbers', async () => {
      await mockRedis.set('number-key', '12345');
      const value = await mockRedis.get('number-key');
      
      assert.strictEqual(value, '12345');
    });

    it('should handle empty strings', async () => {
      await mockRedis.set('empty-key', '');
      const value = await mockRedis.get('empty-key');
      
      assert.strictEqual(value, '');
    });
  });

  describe('JSON Serialization', () => {
    it('should handle JSON objects', async () => {
      const data = { user: 'john', age: 30 };
      await mockRedis.set('json-key', JSON.stringify(data));
      const value = await mockRedis.get('json-key');
      const parsed = JSON.parse(value);
      
      assert.deepStrictEqual(parsed, data);
    });

    it('should handle JSON arrays', async () => {
      const data = [1, 2, 3, 4, 5];
      await mockRedis.set('array-key', JSON.stringify(data));
      const value = await mockRedis.get('array-key');
      const parsed = JSON.parse(value);
      
      assert.deepStrictEqual(parsed, data);
    });
  });

  describe('Expiry (TTL)', () => {
    it('should set key with expiry', async () => {
      await mockRedis.set('temp-key', 'temp-value', { EX: 1 });
      const value = await mockRedis.get('temp-key');
      
      assert.strictEqual(value, 'temp-value');
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const expiredValue = await mockRedis.get('temp-key');
      assert.strictEqual(expiredValue, null);
    });

    it('should not expire key without TTL', async () => {
      await mockRedis.set('permanent-key', 'permanent-value');
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const value = await mockRedis.get('permanent-key');
      assert.strictEqual(value, 'permanent-value');
    });
  });

  describe('Multiple Keys', () => {
    it('should handle multiple keys independently', async () => {
      await mockRedis.set('key1', 'value1');
      await mockRedis.set('key2', 'value2');
      await mockRedis.set('key3', 'value3');
      
      const value1 = await mockRedis.get('key1');
      const value2 = await mockRedis.get('key2');
      const value3 = await mockRedis.get('key3');
      
      assert.strictEqual(value1, 'value1');
      assert.strictEqual(value2, 'value2');
      assert.strictEqual(value3, 'value3');
    });

    it('should overwrite existing keys', async () => {
      await mockRedis.set('key', 'old-value');
      await mockRedis.set('key', 'new-value');
      
      const value = await mockRedis.get('key');
      
      assert.strictEqual(value, 'new-value');
    });
  });

  describe('Clear Operation', () => {
    it('should clear all keys', async () => {
      await mockRedis.set('key1', 'value1');
      await mockRedis.set('key2', 'value2');
      await mockRedis.set('key3', 'value3');
      
      mockRedis.clear();
      
      const keys = await mockRedis.keys('*');
      assert.strictEqual(keys.length, 0);
    });

    it('should allow new operations after clear', async () => {
      await mockRedis.set('old-key', 'old-value');
      mockRedis.clear();
      
      await mockRedis.set('new-key', 'new-value');
      const value = await mockRedis.get('new-key');
      
      assert.strictEqual(value, 'new-value');
    });
  });

  describe('Prefix Handling', () => {
    it('should support key prefixes', async () => {
      const prefix = 'test_';
      await mockRedis.set(prefix + 'key', 'value');
      
      const value = await mockRedis.get(prefix + 'key');
      
      assert.strictEqual(value, 'value');
    });

    it('should find keys with prefix pattern', async () => {
      await mockRedis.set('test_key1', 'value1');
      await mockRedis.set('test_key2', 'value2');
      await mockRedis.set('prod_key1', 'value3');
      
      const testKeys = await mockRedis.keys('test_*');
      
      assert.strictEqual(testKeys.length, 2);
    });
  });

  describe('Cache Patterns', () => {
    it('should implement cache-aside pattern', async () => {
      const cacheKey = 'user:123';
      
      // Check cache
      let cachedValue = await mockRedis.get(cacheKey);
      
      if (!cachedValue) {
        // Simulate database fetch
        const dbValue = { id: 123, name: 'John Doe' };
        await mockRedis.set(cacheKey, JSON.stringify(dbValue));
        cachedValue = JSON.stringify(dbValue);
      }
      
      const user = JSON.parse(cachedValue);
      
      assert.strictEqual(user.id, 123);
      assert.strictEqual(user.name, 'John Doe');
    });

    it('should invalidate cache on update', async () => {
      const cacheKey = 'user:123';
      
      // Set initial cache
      await mockRedis.set(cacheKey, JSON.stringify({ id: 123, name: 'John' }));
      
      // Simulate update - invalidate cache
      await mockRedis.del(cacheKey);
      
      const cachedValue = await mockRedis.get(cacheKey);
      
      assert.strictEqual(cachedValue, null);
    });
  });

  describe('Session Storage', () => {
    it('should store session data', async () => {
      const sessionId = 'session:abc123';
      const sessionData = {
        userId: 1,
        expiresAt: Date.now() + 3600000
      };
      
      await mockRedis.set(sessionId, JSON.stringify(sessionData));
      const stored = await mockRedis.get(sessionId);
      const parsed = JSON.parse(stored);
      
      assert.strictEqual(parsed.userId, 1);
      assert.ok(parsed.expiresAt);
    });

    it('should cleanup expired sessions', async () => {
      await mockRedis.set('session:1', 'data1', { EX: 1 });
      await mockRedis.set('session:2', 'data2');
      
      // Wait for first session to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const session1 = await mockRedis.get('session:1');
      const session2 = await mockRedis.get('session:2');
      
      assert.strictEqual(session1, null);
      assert.strictEqual(session2, 'data2');
    });
  });
});