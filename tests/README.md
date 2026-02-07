# Test Suite

Quick reference guide for the WORM API test suite.

## Quick Start

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test type
npm run test:unit
npm run test:integration
```

## Directory Structure

```
tests/
├── unit/              # Unit tests (270+ tests)
│   ├── util-encryption.test.js         # Encryption utilities (60+ tests)
│   ├── util-auth.test.js               # Authentication logic (50+ tests)
│   ├── util-session.test.js            # Session management (40+ tests)
│   ├── util-permission-middleware.test.js  # Authorization (35+ tests)
│   ├── storage-db.test.js              # Database operations (45+ tests)
│   └── storage-redis.test.js           # Cache operations (40+ tests)
├── integration/       # Integration tests (90+ tests)
│   ├── api-ping.test.js               # Health check endpoint (15+ tests)
│   ├── api-auth.test.js               # Authentication flow (45+ tests)
│   └── api-crud.test.js               # CRUD operations (30+ tests)
└── helpers/           # Test utilities
    └── test-helpers.js                # Mock objects and factories
```

## Test Files Overview

### Unit Tests

| File | Module | Tests | Description |
|------|--------|-------|-------------|
| [`util-encryption.test.js`](unit/util-encryption.test.js:1) | [`utils/util-encryption.js`](../utils/util-encryption.js:1) | 60+ | AES-256-GCM encryption, key derivation, format validation |
| [`util-auth.test.js`](unit/util-auth.test.js:1) | [`utils/util-auth.js`](../utils/util-auth.js:1) | 50+ | Password hashing, validation, brute force protection, auth codes |
| [`util-session.test.js`](unit/util-session.test.js:1) | [`utils/util-session.js`](../utils/util-session.js:1) | 40+ | JWT tokens, session caching, expiry, device tracking |
| [`util-permission-middleware.test.js`](unit/util-permission-middleware.test.js:1) | [`utils/util-permission-middleware.js`](../utils/util-permission-middleware.js:1) | 35+ | CRUD authorization, field filtering, role-based access |
| [`storage-db.test.js`](unit/storage-db.test.js:1) | [`controllers/storage-db.js`](../controllers/storage-db.js:1) | 45+ | Database CRUD, queries, timestamps, batch operations |
| [`storage-redis.test.js`](unit/storage-redis.test.js:1) | [`controllers/storage-redis.js`](../controllers/storage-redis.js:1) | 40+ | Cache operations, TTL, key patterns, session storage |

### Integration Tests

| File | Endpoint | Tests | Description |
|------|----------|-------|-------------|
| [`api-ping.test.js`](integration/api-ping.test.js:1) | `/ping` | 15+ | Health check endpoint, all HTTP methods |
| [`api-auth.test.js`](integration/api-auth.test.js:1) | `/letmein` | 45+ | Complete authentication workflow, device verification |
| [`api-crud.test.js`](integration/api-crud.test.js:1) | `/generic/:model` | 30+ | JSON:API CRUD operations, pagination, filtering |

### Test Helpers

[`helpers/test-helpers.js`](helpers/test-helpers.js:1) provides:
- **MockDatabase**: In-memory database simulator
- **MockRedis**: Redis cache simulator  
- **createMockRequest**: HTTP request mock factory
- **createMockResponse**: HTTP response mock factory
- **factories**: Test data generators

## Running Tests

### All Tests

```bash
npm test
```

### With Coverage

```bash
npm run test:coverage
```

### Watch Mode

```bash
npm run test:watch
```

### Specific Test Type

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

### Single Test File

```bash
node --test tests/unit/util-encryption.test.js
```

### Pattern Matching

```bash
node --test tests/unit/util-*.test.js
```

## Test Framework

This project uses **native Node.js testing tools**:

- **Test Runner**: `node:test` (built-in)
- **Assertions**: `node:assert` (built-in)
- **Coverage**: `--experimental-test-coverage` flag

No external test frameworks required!

## Quick Examples

### Basic Test Structure

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('Feature', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', async () => {
    const result = await myFunction();
    assert.ok(result);
  });
});
```

### Using Mocks

```javascript
const { MockDatabase, MockRedis } = require('./helpers/test-helpers');

describe('My Feature', () => {
  let mockDb;
  let mockRedis;

  beforeEach(() => {
    mockDb = new MockDatabase();
    mockRedis = new MockRedis();
  });

  afterEach(() => {
    mockDb.clear();
    mockRedis.clear();
  });

  it('should create record', async () => {
    const user = await mockDb.create('users', { name: 'Test' });
    assert.ok(user.id);
  });

  it('should cache data', async () => {
    await mockRedis.set('key', 'value');
    const value = await mockRedis.get('key');
    assert.strictEqual(value, 'value');
  });
});
```

## Adding New Tests

1. **Choose test type**: Unit or integration
2. **Create test file**: `*.test.js` in appropriate directory
3. **Import dependencies**:
   ```javascript
   const { describe, it, beforeEach, afterEach } = require('node:test');
   const assert = require('node:assert');
   ```
4. **Use helpers as needed**:
   ```javascript
   const { MockDatabase, MockRedis } = require('../helpers/test-helpers');
   ```
5. **Write descriptive tests**:
   ```javascript
   it('should reject passwords shorter than 8 characters', () => {
     // Test implementation
   });
   ```
6. **Run tests locally**:
   ```bash
   npm test
   ```

## Test Template

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

  describe('Feature Name', () => {
    it('should do something', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await myFunction(input);
      
      // Assert
      assert.ok(result);
    });

    it('should handle edge cases', async () => {
      await assert.rejects(
        () => myFunction(null),
        { message: /invalid input/i }
      );
    });
  });
});
```

## Best Practices

✅ **Use descriptive test names** - Explain what is being tested  
✅ **One assertion per test** - Focus on single behavior  
✅ **Clean up after tests** - Use `afterEach` for cleanup  
✅ **Test edge cases** - Don't just test happy paths  
✅ **Use async/await** - For asynchronous operations  
✅ **Mock external dependencies** - Keep tests isolated  

## Coverage Goals

| Component | Target |
|-----------|--------|
| Encryption | 95%+ |
| Authentication | 90%+ |
| Session Management | 90%+ |
| Permissions | 85%+ |
| Database Storage | 85%+ |
| Redis Storage | 85%+ |

## Troubleshooting

### Tests fail intermittently
- Ensure proper use of `async/await`
- Clear mocks in `afterEach` hooks
- Add explicit timeouts for time-sensitive tests

### Coverage not showing
- Use `npm run test:coverage` instead of `npm test`
- Ensure Node.js version supports coverage (v18+)

### Mocks not working
- Check that mocks are initialized in `beforeEach`
- Verify mocks are cleared in `afterEach`
- Import from correct path: `../helpers/test-helpers`

## Documentation

For comprehensive testing documentation, see:

📖 **[`docs/TESTING.md`](../docs/TESTING.md)** - Complete testing guide with:
- Detailed test descriptions
- Writing tests guide
- Test helper documentation
- Coverage analysis
- CI/CD integration
- Troubleshooting guide

## Additional Resources

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [Node.js Assert](https://nodejs.org/api/assert.html)
- [Project README](../README.md)

---

**Total Test Count**: 360+ tests  
**Test Framework**: Native Node.js (`node:test`)  
**No External Dependencies Required** ✅