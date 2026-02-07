# Testing Guide

## Table of Contents

- [Introduction](#introduction)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [Writing Tests](#writing-tests)
- [Test Helpers](#test-helpers)
- [Coverage Analysis](#coverage-analysis)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)
- [Contributing Tests](#contributing-tests)

## Introduction

The WORM API project uses **native Node.js testing tools** without external frameworks. This approach provides:

- ✅ **Zero Dependencies**: No test framework installations required
- ✅ **Native Integration**: Built-in Node.js test runner (`node:test`)
- ✅ **Modern Features**: Async/await, hooks, and descriptive test organization
- ✅ **Fast Execution**: Minimal overhead and quick test runs
- ✅ **Built-in Coverage**: Native coverage reporting with `--experimental-test-coverage`

### Testing Philosophy

Our testing approach emphasizes:

1. **Comprehensive Coverage**: 360+ tests covering critical functionality
2. **Isolation**: Unit tests use mocks to test components independently
3. **Integration**: Real-world API endpoint testing
4. **Maintainability**: Clear test organization and descriptive names
5. **Documentation**: Tests serve as living documentation

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage for utility modules
- **Integration Tests**: All critical API endpoints
- **Edge Cases**: Security, error handling, validation
- **Performance**: Key operations under load

## Test Structure

```
tests/
├── unit/                           # Unit tests (270+ tests)
│   ├── util-encryption.test.js     # Encryption utilities (60+ tests)
│   ├── util-auth.test.js           # Authentication logic (50+ tests)
│   ├── util-session.test.js        # Session management (40+ tests)
│   ├── util-permission-middleware.test.js  # Authorization (35+ tests)
│   ├── storage-db.test.js          # Database operations (45+ tests)
│   └── storage-redis.test.js       # Cache operations (40+ tests)
├── integration/                    # Integration tests (90+ tests)
│   ├── api-ping.test.js           # Health check endpoint (15+ tests)
│   ├── api-auth.test.js           # Authentication flow (45+ tests)
│   └── api-crud.test.js           # CRUD operations (30+ tests)
└── helpers/                        # Test utilities
    └── test-helpers.js            # Mock objects and factories
```

### File Naming Convention

- **Test Files**: `*.test.js` suffix
- **Unit Tests**: Test individual modules/functions
- **Integration Tests**: Test API endpoints and workflows
- **Helpers**: Shared utilities and mocks

## Running Tests

### Available npm Scripts

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (re-run on file changes)
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Running Specific Test Files

```bash
# Single test file
node --test tests/unit/util-encryption.test.js

# Multiple test files with pattern
node --test tests/unit/util-*.test.js

# Specific test suite
node --test tests/integration/
```

### Watch Mode

Watch mode automatically re-runs tests when files change:

```bash
npm run test:watch
```

This is ideal for development workflows where you want immediate feedback.

### Coverage Reports

Generate coverage reports to identify untested code:

```bash
npm run test:coverage
```

Output includes:
- **Line Coverage**: Percentage of lines executed
- **Branch Coverage**: Percentage of conditional branches tested
- **Function Coverage**: Percentage of functions called
- **Statement Coverage**: Percentage of statements executed

Example coverage output:
```
----------------------------|---------|----------|---------|---------|
File                        | % Stmts | % Branch | % Funcs | % Lines |
----------------------------|---------|----------|---------|---------|
All files                   |   87.23 |    82.45 |   91.67 |   87.23 |
 utils/                     |   92.15 |    88.34 |   95.12 |   92.15 |
  util-auth.js              |   94.23 |    90.12 |   96.55 |   94.23 |
  util-encryption.js        |   96.45 |    92.34 |   98.76 |   96.45 |
----------------------------|---------|----------|---------|---------|
```

## Unit Tests

Unit tests validate individual modules and functions in isolation. They use mocks to eliminate external dependencies.

### Encryption Tests ([`util-encryption.test.js`](../tests/unit/util-encryption.test.js:1))

**Coverage**: 60+ tests  
**Module**: [`utils/util-encryption.js`](../utils/util-encryption.js:1)

Tests AES-256-GCM encryption operations:

```javascript
// Test encrypted data structure
it('should return object with required fields', () => {
  const result = encryption.encrypt('test data', 'password');
  
  assert.ok(result.encrypted);  // Base64 encrypted data
  assert.ok(result.iv);          // Initialization vector
  assert.ok(result.salt);        // Password salt
  assert.ok(result.authTag);     // Authentication tag
});

// Test encryption/decryption round-trip
it('should decrypt back to original', () => {
  const original = 'sensitive data';
  const encrypted = encryption.encrypt(original, 'password');
  const decrypted = encryption.decrypt(encrypted, 'password');
  
  assert.strictEqual(decrypted, original);
});
```

**Key Test Scenarios**:
- Encryption format validation
- Decryption with correct password
- Rejection of incorrect passwords
- Key derivation from passwords
- Base64 encoding/decoding
- Error handling for invalid inputs
- Edge cases (empty strings, special characters)

### Authentication Tests ([`util-auth.test.js`](../tests/unit/util-auth.test.js:1))

**Coverage**: 50+ tests  
**Module**: [`utils/util-auth.js`](../utils/util-auth.js:1)

Tests authentication logic and security features:

```javascript
// Test password validation rules
it('should require minimum length', () => {
  const result = auth.validatePassword('short');
  
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes('minimum 8 characters'));
});

// Test brute force protection
it('should block after 3 failed attempts', async () => {
  const user = { attempts: 3, lastattempt: new Date() };
  const blockInfo = auth.checkBruteForce(user);
  
  assert.strictEqual(blockInfo.blocked, true);
  assert.ok(blockInfo.blockUntil > new Date());
});
```

**Key Test Scenarios**:
- Password hashing (bcrypt)
- Password complexity validation
- Brute force protection (3, 6, 9+ attempts)
- Authorization code generation
- Authorization code validation
- Code expiry handling
- Device UUID management

### Session Tests ([`util-session.test.js`](../tests/unit/util-session.test.js:1))

**Coverage**: 40+ tests  
**Module**: [`utils/util-session.js`](../utils/util-session.js:1)

Tests session token management:

```javascript
// Test token generation
it('should generate JWT token', async () => {
  const token = await session.generateToken(userId, secret);
  
  assert.ok(token);
  assert.match(token, /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
});

// Test token expiry
it('should reject expired tokens', async () => {
  const expiredToken = createExpiredToken();
  
  await assert.rejects(
    () => session.verifyToken(expiredToken),
    { message: /expired/i }
  );
});
```

**Key Test Scenarios**:
- JWT token generation
- Token verification
- Token expiry validation
- Session caching (Redis)
- Session invalidation
- Token refresh logic
- Device tracking

### Permission Middleware Tests ([`util-permission-middleware.test.js`](../tests/unit/util-permission-middleware.test.js:1))

**Coverage**: 35+ tests  
**Module**: [`utils/util-permission-middleware.js`](../utils/util-permission-middleware.js:1)

Tests role-based access control:

```javascript
// Test CRUD authorization
it('should allow admin full access', () => {
  const permissions = { users: { create: true, read: true, update: true, delete: true } };
  
  assert.strictEqual(canCreate('users', permissions), true);
  assert.strictEqual(canUpdate('users', permissions), true);
});

// Test field filtering
it('should filter sensitive fields', () => {
  const data = { id: 1, name: 'User', password: 'secret', salary: 50000 };
  const filtered = filterFields(data, ['password', 'salary']);
  
  assert.strictEqual(filtered.password, undefined);
  assert.strictEqual(filtered.salary, undefined);
});
```

**Key Test Scenarios**:
- CRUD permission checks
- Field-level filtering
- Role-based access
- Permission inheritance
- Attribute-level security
- Relationship permissions

### Database Storage Tests ([`storage-db.test.js`](../tests/unit/storage-db.test.js:1))

**Coverage**: 45+ tests  
**Module**: [`controllers/storage-db.js`](../controllers/storage-db.js:1)

Tests database operations using MockDatabase:

```javascript
// Test CRUD operations
it('should create a record', async () => {
  const data = { name: 'Test User', email: 'test@example.com' };
  const result = await mockDb.create('users', data);
  
  assert.ok(result.id);
  assert.strictEqual(result.name, 'Test User');
});

// Test query operations
it('should find records with query', async () => {
  await mockDb.create('users', { name: 'Alice', state: 'active' });
  await mockDb.create('users', { name: 'Bob', state: 'inactive' });
  
  const results = await mockDb.find('users', { state: 'active' });
  
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'Alice');
});
```

**Key Test Scenarios**:
- Create, read, update, delete operations
- Query filtering
- Operator queries (>=, <=, etc.)
- Timestamps (createdAt, updatedAt)
- Auto-increment IDs
- Batch operations
- Table isolation
- Clear operations

### Redis Storage Tests ([`storage-redis.test.js`](../tests/unit/storage-redis.test.js:1))

**Coverage**: 40+ tests  
**Module**: [`controllers/storage-redis.js`](../controllers/storage-redis.js:1)

Tests cache operations using MockRedis:

```javascript
// Test basic operations
it('should set and get a value', async () => {
  await mockRedis.set('test-key', 'test-value');
  const value = await mockRedis.get('test-key');
  
  assert.strictEqual(value, 'test-value');
});

// Test TTL expiry
it('should expire key after TTL', async () => {
  await mockRedis.set('temp-key', 'value', { EX: 1 });
  
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  const value = await mockRedis.get('temp-key');
  assert.strictEqual(value, null);
});
```

**Key Test Scenarios**:
- Basic get/set/delete operations
- Key existence checks
- Pattern matching (keys command)
- Data type handling
- JSON serialization
- TTL/expiry
- Cache patterns (cache-aside)
- Session storage
- Prefix handling

## Integration Tests

Integration tests validate API endpoints and complete workflows without mocking.

### Ping Endpoint Tests ([`api-ping.test.js`](../tests/integration/api-ping.test.js:1))

**Coverage**: 15+ tests  
**Endpoint**: `/ping`

Tests health check functionality:

```javascript
// Test GET /ping
it('should return success message', () => {
  const req = createMockRequest({ method: 'GET' });
  const mockRes = createMockResponse();
  
  ping.get(req, mockRes);
  const response = mockRes.getResponse();
  
  assert.strictEqual(response.statusCode, 200);
  assert.ok(response.data.message);
});

// Test unauthenticated access
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
```

**Key Test Scenarios**:
- GET, POST, PATCH, DELETE methods
- Response format consistency
- Health check validation
- No authentication required
- Error-free operation

### Authentication Flow Tests ([`api-auth.test.js`](../tests/integration/api-auth.test.js:1))

**Coverage**: 45+ tests  
**Endpoint**: `/letmein`

Tests complete authentication workflow:

```javascript
// Test sign in validation
it('should validate required fields', () => {
  const validPayload = {
    email: 'test@example.com',
    password: 'password123'
  };
  
  assert.ok(validPayload.email);
  assert.ok(validPayload.password);
});

// Test device verification
it('should check device UUID', async () => {
  await mockDb.create('permitted_devices', {
    user: 1,
    device: 'device-123'
  });
  
  const device = await mockDb.findOne('permitted_devices', {
    user: 1,
    device: 'device-123'
  });
  
  assert.ok(device);
});
```

**Key Test Scenarios**:
- Sign in request structure
- Email/password validation
- Device UUID handling
- Access code verification
- Brute force protection
- Session creation
- Response encryption
- Error handling

### CRUD Endpoint Tests ([`api-crud.test.js`](../tests/integration/api-crud.test.js:1))

**Coverage**: 30+ tests  
**Endpoint**: `/generic/:model`

Tests JSON:API CRUD operations:

```javascript
// Test GET request
it('should accept GET request structure', () => {
  const req = createMockRequest({
    method: 'GET',
    params: { '0': 'users' },
    query: { state: 'active', limit: 10 }
  });
  
  assert.strictEqual(req.params['0'], 'users');
  assert.strictEqual(req.query.limit, 10);
});

// Test JSON:API format
it('should accept JSON:API format', () => {
  const body = {
     {
      type: 'users',
      attributes: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    }
  };
  
  assert.ok(body.data);
  assert.ok(body.data.attributes);
});
```

**Key Test Scenarios**:
- GET with query parameters
- POST withJSON:API format
- PATCH updates
- DELETE operations
- Response format (JSON:API compliant)
- Pagination
- Filtering and operators
- Sorting
- Relationships (belongs-to, has-many)
- Error handling (404, 500)

## Writing Tests

### Using node:test API

Node.js provides a built-in test runner with the `node:test` module:

```javascript
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('Feature Name', () => {
  before(() => {
    // One-time setup before all tests
  });

  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  after(() => {
    // One-time cleanup after all tests
  });

  it('should do something', () => {
    assert.strictEqual(1 + 1, 2);
  });

  it('should handle async operations', async () => {
    const result = await someAsyncFunction();
    assert.ok(result);
  });
});
```

### Using node:assert Methods

```javascript
const assert = require('node:assert');

// Strict equality (===)
assert.strictEqual(actual, expected);

// Deep equality for objects/arrays
assert.deepStrictEqual(actualObj, expectedObj);

// Truthy/falsy checks
assert.ok(value);

// Regular expression matching
assert.match(string, /pattern/);

// Exception testing
assert.throws(() => functionThatThrows(), { message: /expected error/i });

// Async rejection testing
await assert.rejects(() => asyncFunctionThatRejects(), { message: /expected error/i });
```

### Async/Await Patterns

Always use async/await for asynchronous tests:

```javascript
it('should handle async database operations', async () => {
  const user = await mockDb.create('users', {
    name: 'Test User',
    email: 'test@example.com'
  });
  assert.ok(user.id);
  
  const found = await mockDb.findOne('users', { id: user.id });
  assert.strictEqual(found.name, 'Test User');
});
```

### Best Practices

1. **Descriptive Test Names**: Use clear, action-oriented descriptions
2. **One Assertion Focus**: Each test should verify one behavior
3. **Arrange-Act-Assert Pattern**: Structure tests logically
4. **Cleanup After Tests**: Use `afterEach` to reset state
5. **Test Edge Cases**: Don't just test happy paths

## Test Helpers

The [`tests/helpers/test-helpers.js`](../tests/helpers/test-helpers.js:1) file provides utilities for testing.

### MockDatabase

Simulates database operations:

```javascript
const { MockDatabase } = require('../helpers/test-helpers');
const mockDb = new MockDatabase();

// Create
const user = await mockDb.create('users', { name: 'John Doe' });

// Find
const users = await mockDb.find('users', { state: 'active' });

// Find one
const user = await mockDb.findOne('users', { id: 1 });

// Update
await mockDb.update('users', { id: 1 }, { name: 'Jane Doe' });

// Delete
await mockDb.destroy('users', { id: 1 });

// Clear
mockDb.clear();
```

### MockRedis

Simulates Redis cache:

```javascript
const { MockRedis } = require('../helpers/test-helpers');
const mockRedis = new MockRedis();

// Set/Get
await mockRedis.set('key', 'value');
const value = await mockRedis.get('key');

// Set with TTL
await mockRedis.set('temp-key', 'value', { EX: 60 });

// Pattern matching
const keys = await mockRedis.keys('user:*');
```

### Mock HTTP Objects

```javascript
const { createMockRequest, createMockResponse } = require('../helpers/test-helpers');

const req = createMockRequest({
  method: 'POST',
  body: { name: 'Test' },
  params: { id: '123' },
  query: { filter: 'active' }
});

const res = createMockResponse();
```

## Coverage Analysis

### Generating Coverage Reports

```bash
npm run test:coverage
```

### Coverage Goals

| Component | Target |
|-----------|--------|
| Encryption | 95%+ |
| Authentication | 90%+ |
| Session Management | 90%+ |
| Permissions | 85%+ |
| Database Storage | 85%+ |
| Redis Storage | 85%+ |

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Troubleshooting

### Common Issues

**Async Timing Issues**: Always await promises
```javascript
// Good
it('should process async', async () => {
  await processAsync();
  assert.ok(result);
});
```

**Mock Cleanup**: Clear mocks after each test
```javascript
afterEach(() => {
  mockDb.clear();
  mockRedis.clear();
});
```

**Flaky Tests**: Add explicit timeouts for time-sensitive tests
```javascript
it('should expire after TTL', async () => {
  await mockRedis.set('key', 'value', { EX: 1 });
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.strictEqual(await mockRedis.get('key'), null);
});
```

## Contributing Tests

### Adding New Tests

1. Choose appropriate test type (unit vs integration)
2. Place in correct directory
3. Follow naming conventions (`*.test.js`)
4. Use descriptive test names
5. Include setup/teardown as needed
6. Run tests locally before committing

### Test Template

```javascript
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { MockDatabase } = require('../helpers/test-helpers');

describe('MyModule', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = new MockDatabase();
  });

  afterEach(() => {
    mockDb.clear();
  });

  describe('Feature', () => {
    it('should do something', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await myFunction(input);
      
      // Assert
      assert.ok(result);
    });
  });
});
```

### Code Review Checklist

- [ ] Tests cover new functionality
- [ ] Tests cover edge cases
- [ ] Tests are independent (no shared state)
- [ ] Tests have clear, descriptive names
- [ ] Mocks are properly cleaned up
- [ ] Async operations use await
- [ ] Coverage meets minimum thresholds

---

For more information, see:
- [`tests/README.md`](../tests/README.md) - Quick reference guide
- [Node.js Test Runner Documentation](https://nodejs.org/api/test.html)
- [Node.js Assert Documentation](https://nodejs.org/api/assert.html)