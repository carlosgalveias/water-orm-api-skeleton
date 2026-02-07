// MUST be at top
process.env.RUNNING_TESTS = 'true';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const storageDb = require('../../controllers/storage-db');

describe('Generic Router - POST Operations', () => {
  afterEach(async () => {
    const tables = ['users', 'roles', 'sessions'];
    for (const table of tables) {
      try {
        const result = await storageDb({ type: 'read', table, query: {} });
        const records = result.result;
        if (records && Array.isArray(records)) {
          for (const record of records) {
            await storageDb({ type: 'destroy', table, query: { id: record.id } });
          }
        }
      } catch (e) {}
    }
  });

  it('should create a single user with attributes', async () => {
    const email = `test${Date.now()}@example.com`;
    const result = await storageDb({
      type: 'write',
      table: 'users',
      data: { name: 'Test User', email, password: 'test123' }
    });
    assert.ok(result.result.id, 'Should assign ID');
    assert.strictEqual(result.result.name, 'Test User');
  });

  it('should create user and verify persistence', async () => {
    const email = `test${Date.now()}@example.com`;
    const created = await storageDb({
      type: 'write',
      table: 'users',
      data: { name: 'Persist Test', email, password: 'test123' }
    });
    const found = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: created.result.id }
    });
    assert.strictEqual(found.result[0].id, created.result.id);
  });

  it('should handle bulk creation of multiple users', async () => {
    const users = [
      { name: 'User1', email: `user1-${Date.now()}@example.com`, password: 'pass1' },
      { name: 'User2', email: `user2-${Date.now()}@example.com`, password: 'pass2' },
      { name: 'User3', email: `user3-${Date.now()}@example.com`, password: 'pass3' }
    ];
    const results = [];
    for (const user of users) {
      const result = await storageDb({ type: 'write', table: 'users', data: user });
      results.push(result.result);
    }
    assert.strictEqual(results.length, 3);
  });

  it('should reject creation without required password field', async () => {
    await assert.rejects(
      async () => {
        await storageDb({
          type: 'write',
          table: 'users',
          data: { name: 'No Password', email: `nopass${Date.now()}@example.com` }
        });
      },
      /validation|required|password/i
    );
  });

  it('should enforce unique email constraint', async () => {
    const email = `unique${Date.now()}@example.com`;
    await storageDb({
      type: 'write',
      table: 'users',
      data: { name: 'First', email, password: 'test123' }
    });
    await assert.rejects(
      async () => {
        await storageDb({
          type: 'write',
          table: 'users',
          data: { name: 'Second', email, password: 'test456' }
        });
      },
      /unique|duplicate|E11000/i
    );
  });

  it('should auto-generate ID on creation', async () => {
    const result = await storageDb({
      type: 'write',
      table: 'users',
      data: { 
        name: 'Auto ID',
        email: `autoid${Date.now()}@example.com`,
        password: 'test123'
      }
    });
    assert.ok(result.result.id, 'ID should be auto-generated');
    assert.strictEqual(typeof result.result.id, 'number');
  });

  it('should accept client-provided ID during creation', async () => {
    const result = await storageDb({
      type: 'write',
      table: 'users',
      data: { 
        id: 99999,
        name: 'Client ID',
        email: `clientid${Date.now()}@example.com`,
        password: 'test123'
      }
    });
    assert.strictEqual(result.result.id, 99999, 'Database accepts client-provided ID');
  });

  it('should handle creation with default values', async () => {
    const result = await storageDb({
      type: 'write',
      table: 'users',
      data: {
        name: 'Defaults',
        email: `defaults${Date.now()}@example.com`,
        password: 'test123'
      }
    });
    assert.ok(result.result.createdAt || result.result.created_at || result.result.updatedAt);
    assert.strictEqual(result.result.state, 'inactive');
  });

  it('should validate data types on creation', async () => {
    const result = await storageDb({
      type: 'write',
      table: 'users',
      data: { 
        name: 'Type Test',
        email: `typetest${Date.now()}@example.com`,
        password: 'test123',
        attempts: 5
      }
    });
    assert.ok(result.result.id);
    assert.strictEqual(typeof result.result.attempts, 'number');
  });

  it('should create role and assign to user', async () => {
    const role = await storageDb({
      type: 'write',
      table: 'roles',
      data: { name: `TestRole${Date.now()}`, description: 'Test Role' }
    });
    const user = await storageDb({
      type: 'write',
      table: 'users',
      data: {
        name: 'User With Role',
        email: `withrole${Date.now()}@example.com`,
        password: 'test123',
        roles: role.result.id
      }
    });
    assert.ok(user.result.id);
    assert.strictEqual(user.result.roles, role.result.id);
  });

  it('should handle empty POST request gracefully', async () => {
    await assert.rejects(
      async () => {
        await storageDb({
          type: 'write',
          table: 'users',
          data: {}
        });
      },
      /validation|required|password/i
    );
  });

  it('should create user with non-standard email format', async () => {
    const result = await storageDb({
      type: 'write',
      table: 'users',
      data: { 
        name: 'Non-standard Email',
        email: 'localuser',
        password: 'test123'
      }
    });
    assert.ok(result.result.id, 'Database accepts non-standard email formats');
    assert.strictEqual(result.result.email, 'localuser');
  });

  it('should handle special characters in name field', async () => {
    const result = await storageDb({
      type: 'write',
      table: 'users',
      data: { 
        name: "O'Brien-Smith (Test)",
        email: `special${Date.now()}@example.com`,
        password: 'test123'
      }
    });
    assert.ok(result.result.id);
    assert.strictEqual(result.result.name, "O'Brien-Smith (Test)");
  });

  it('should create and immediately read back', async () => {
    const email = `readback${Date.now()}@example.com`;
    const created = await storageDb({
      type: 'write',
      table: 'users',
      data: { name: 'Immediate Read', email, password: 'test123' }
    });
    const found = await storageDb({
      type: 'read',
      table: 'users',
      query: { email }
    });
    assert.strictEqual(found.result.length, 1);
    assert.strictEqual(found.result[0].id, created.result.id);
  });

  it('should maintain data integrity across multiple creates', async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      const result = await storageDb({
        type: 'write',
        table: 'users',
        data: { 
          name: `Integrity${i}`,
          email: `integrity${i}-${Date.now()}@example.com`,
          password: 'test123'
        }
      });
      results.push(result.result);
    }
    const all = await storageDb({ type: 'read', table: 'users', query: {} });
    assert.ok(all.result.length >= 5);
    const ids = results.map(r => r.id);
    const uniqueIds = [...new Set(ids)];
    assert.strictEqual(ids.length, uniqueIds.length);
  });
});
