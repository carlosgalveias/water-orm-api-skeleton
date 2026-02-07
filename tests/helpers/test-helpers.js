'use strict';

/**
 * Test Helpers for WORM API Test Suite
 * Provides mock objects, test data factories, and common utilities
 */

/**
 * Creates a mock Express request object
 */
function createMockRequest(options = {}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || {},
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    decoded: options.decoded || null,
    console: options.console || console,
    orm: options.orm || null,
    originip: options.originip || '127.0.0.1',
    isAuthenticated: options.isAuthenticated || false,
    needNewToken: options.needNewToken || false
  };
}

/**
 * Creates a mock Express response callback
 */
function createMockResponse() {
  const response = {
    statusCode: null,
    data: null,
    headers: {}
  };

  const mockRes = (result) => {
    response.statusCode = result.status;
    response.data = result.result;
    return response;
  };

  mockRes.getResponse = () => response;
  return mockRes;
}

/**
 * Mock Database Connection
 */
class MockDatabase {
  constructor() {
    this.data = new Map();
    this.idCounters = new Map();
  }

  async create(table, data) {
    if (!this.data.has(table)) {
      this.data.set(table, []);
      this.idCounters.set(table, 1);
    }
    
    // Use provided ID if it exists, otherwise auto-increment
    let id;
    if (data.id !== undefined) {
      id = data.id;
      // Update counter to be higher than this ID to avoid conflicts
      const currentCounter = this.idCounters.get(table);
      if (id >= currentCounter) {
        this.idCounters.set(table, id + 1);
      }
    } else {
      id = this.idCounters.get(table);
      this.idCounters.set(table, id + 1);
    }
    
    const record = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
    this.data.get(table).push(record);
    return record;
  }
  async find(table, query = {}) {
    if (!this.data.has(table)) {
      return [];
    }
    let records = this.data.get(table);
    
    if (Object.keys(query).length > 0) {
      records = records.filter(record => {
        return Object.entries(query).every(([key, value]) => {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Handle operators like >=, <=, $gt, $lt, etc.
            const operators = Object.keys(value);
            return operators.every(op => {
              if (op === '>=' || op === '$gte') return record[key] >= value[op];
              if (op === '<=' || op === '$lte') return record[key] <= value[op];
              if (op === '>' || op === '$gt') return record[key] > value[op];
              if (op === '<' || op === '$lt') return record[key] < value[op];
              if (op === '!=' || op === '$ne') return record[key] !== value[op];
              if (op === '$in') return Array.isArray(value[op]) && value[op].includes(record[key]);
              if (op === '$nin') return Array.isArray(value[op]) && !value[op].includes(record[key]);
              return record[key] === value[op];
            });
          }
          return record[key] === value;
        });
      });
    }
    
    return records;
  }

  async findOne(table, query) {
    const results = await this.find(table, query);
    return results.length > 0 ? results[0] : null;
  }

  async update(table, query, data) {
    const records = await this.find(table, query);
    records.forEach(record => {
      Object.assign(record, data, { updatedAt: new Date() });
    });
    return records;
  }

  async destroy(table, query) {
    if (!this.data.has(table)) {
      return [];
    }
    const records = await this.find(table, query);
    const remaining = this.data.get(table).filter(record => !records.includes(record));
    this.data.set(table, remaining);
    return records;
  }

  async count(table, query = {}) {
    const records = await this.find(table, query);
    return records.length;
  }

  clear(table = null) {
    if (table) {
      this.data.delete(table);
      this.idCounters.delete(table);
    } else {
      this.data.clear();
      this.idCounters.clear();
    }
  }
}

/**
 * Mock Redis Connection
 */
class MockRedis {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    if (this.store.has(key)) {
      return this.store.get(key);
    }
    return null;
  }

  async set(key, value, options = {}) {
    this.store.set(key, value);
    if (options.EX) {
      setTimeout(() => this.store.delete(key), options.EX * 1000);
    }
    return 'OK';
  }

  async del(key) {
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key) {
    return this.store.has(key) ? 1 : 0;
  }

  async keys(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }

  clear() {
    this.store.clear();
  }
}

/**
 * Test Data Factories
 */
const factories = {
  user: (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    password: 'hashedPassword123',
    state: 'active',
    attempts: 0,
    lastattempt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),

  session: (overrides = {}) => ({
    id: 1,
    user: 1,
    token: 'test-token-123',
    token_expiry_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    rf: Date.now() + 600000,
    createdAt: new Date(),
    ...overrides
  }),

  role: (overrides = {}) => ({
    id: 1,
    name: 'admin',
    createdAt: new Date(),
    ...overrides
  }),

  authorizationCode: (overrides = {}) => ({
    id: 1,
    user: 1,
    code: 'XXXX-XXX-XXXX-A',
    expiry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    createdAt: new Date(),
    ...overrides
  }),

  permittedDevice: (overrides = {}) => ({
    id: 1,
    user: 1,
    device: 'device-uuid-123',
    createdAt: new Date(),
    ...overrides
  }),

  passwordHistory: (overrides = {}) => ({
    id: 1,
    user_id: 1,
    password: 'hashedOldPassword',
    createdAt: new Date(),
    ...overrides
  })
};

/**
 * Common Test Utilities
 */
const utils = {
  /**
   * Waits for a specified amount of time
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generates a random string
   */
  randomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Generates a valid test password
   */
  generateValidPassword: () => {
    return 'TestPassword123!@#';
  },

  /**
   * Creates a valid JWT-like token structure
   */
  createTestToken: (payload = {}) => {
    const defaultPayload = {
      id: 1,
      roles: ['admin'],
      companies: [],
      projects: []
    };
    return {
      payload: { ...defaultPayload, ...payload },
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature'
    };
  }
};

/**
 * Mock callFunction for testing
 */
function createMockCallFunction(mockDb) {
  return async (module, args, internal = false) => {
    if (module === 'storage-db') {
      const { type, table, query, data, sort, limit, skip } = args;
      
      switch (type) {
        case 'read':
          return await mockDb.find(table, query);
        case 'readSort':
          let results = await mockDb.find(table, query);
          if (limit) results = results.slice(skip || 0, (skip || 0) + limit);
          return results;
        case 'write':
          return await mockDb.create(table, data);
        case 'update':
          return await mockDb.update(table, query, data);
        case 'destroy':
          // Handle both query and data params (source code uses both patterns)
          const destroyQuery = query || data || {};
          return await mockDb.destroy(table, destroyQuery);
        case 'count':
          return await mockDb.count(table, query);
        default:
          throw new Error(`Unknown type: ${type}`);
      }
    }
    throw new Error(`Unknown module: ${module}`);
  };
}

module.exports = {
  createMockRequest,
  createMockResponse,
  MockDatabase,
  MockRedis,
  factories,
  utils,
  createMockCallFunction
};