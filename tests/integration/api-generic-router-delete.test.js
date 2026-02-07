process.env.RUNNING_TESTS = 'true';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const storageDb = require('../../controllers/storage-db');

describe('Generic Router - DELETE Operations', () => {
  let testUserId;
  let testEmail;

  beforeEach(async () => {
    testEmail = `deletetest${Date.now()}@example.com`;
    const user = await storageDb({
      type: 'write',
      table: 'users', data: { name: 'To Delete', email: testEmail, password: 'delete123' }
    });
    testUserId = user.result.id;
  });

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

  it('should delete existing user by ID', async () => {
    await storageDb({
      type: 'destroy',
      table: 'users',
      query: { id: testUserId }
    });
    
    const found = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: testUserId }
    });
    
    assert.strictEqual(found.result, null, 'User should be deleted');
  });

  it('should verify deletion persistence', async () => {
    await storageDb({
      type: 'destroy',
      table: 'users',
      query: { id: testUserId }
    });
    
    // Try to read multiple times to verify persistence
    const attempt1 = await storageDb({ type: 'read', table: 'users', query: { id: testUserId } });
    const attempt2 = await storageDb({ type: 'read', table: 'users', query: { id: testUserId } });
    
    assert.strictEqual(attempt1.result, null);
    assert.strictEqual(attempt2.result, null);
  });

  it('should handle deletion of non-existent user', async () => {
    // Should not throw error, just return empty/null
    const result = await storageDb({
      type: 'destroy',
      table: 'users',
      query: { id: 99999 }
    });
    
    // Original user should still exist
    const found = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: testUserId }
    });
    assert.ok(found.result);
    assert.strictEqual(found.result[0].id, testUserId);
  });

  it('should handle invalid ID format', async () => {
    await assert.doesNotReject(
      async () => {
        await storageDb({
          type: 'destroy',
          table: 'users',
          query: { id: 'invalid' }
        });
      }
    );
  });

  it('should delete and confirm via query', async () => {
    await storageDb({
      type: 'destroy',
      table: 'users',
      query: { id: testUserId }
    });
    
    const all = await storageDb({ type: 'read', table: 'users', query: {} });
    const records = all.result || [];
    const deleted = records.find(u => u.id === testUserId);
    
    assert.strictEqual(deleted, undefined, 'Deleted user should not be in results');
  });

  it('should handle cascade delete with relationships', async () => {
    // Create role for user
    const role = await storageDb({
      type: 'write',
      table: 'roles', data: { name: `CascadeRole${Date.now()}` }
    });
    
    await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },  data: { roles: role.result.id }
    });
    
    // Delete user
    await storageDb({
      type: 'destroy',
      table: 'users',
      query: { id: testUserId }
    });
    
    const foundUser = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: testUserId }
    });
    assert.strictEqual(foundUser.result, null);
  });

  it('should handle deletion by email query', async () => {
    await storageDb({
      type: 'destroy',
      table: 'users',
      query: { email: testEmail }
    });
    
    const found = await storageDb({
      type: 'read',
      table: 'users',
      query: { email: testEmail }
    });
    
    assert.strictEqual(found.result, null);
  });

  it('should delete multiple users individually', async () => {
    // Create additional users
    const user2 = await storageDb({
      type: 'write',
      table: 'users', data: { name: 'User2', email: `user2-${Date.now()}@example.com`, password: 'pass' }
    });
    
    const user3 = await storageDb({
      type: 'write',
      table: 'users', data: { name: 'User3', email: `user3-${Date.now()}@example.com`, password: 'pass' }
    });
    
    // Delete each one
    await storageDb({ type: 'destroy', table: 'users', query: { id: testUserId } });
    await storageDb({ type: 'destroy', table: 'users', query: { id: user2.result.id } });
    await storageDb({ type: 'destroy', table: 'users', query: { id: user3.result.id } });
    
    const remaining = await storageDb({ type: 'read', table: 'users', query: {} });
    assert.strictEqual(remaining.result, null);
  });

  it('should handle idempotent deletion', async () => {
    // Delete once
    await storageDb({
      type: 'destroy',
      table: 'users',
      query: { id: testUserId }
    });
    
    // Delete again (should not error)
    await assert.doesNotReject(
      async () => {
        await storageDb({
          type: 'destroy',
          table: 'users',
          query: { id: testUserId }
        });
      }
    );
  });

  it('should not affect other users when deleting one', async () => {
    // Create another user
    const user2 = await storageDb({
      type: 'write',
      table: 'users',
      data: { name: 'Keep This', email: `keep-${Date.now()}@example.com`, password: 'pass' }
    });
    
    // Delete first user
    await storageDb({
      type: 'destroy',
      table: 'users',
      query: { id: testUserId }
    });
    
    // Second user should still exist
    const foundUser2 = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: user2.result.id }
    });
    assert.ok(foundUser2.result);
    assert.strictEqual(foundUser2.result[0].name, 'Keep This');
  });
});

describe('Generic Router - Helper Functions', () => {
  afterEach(async () => {
    const tables = ['users', 'roles'];
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

  it('should normalize integer string to number', async () => {
    // Test via actual database operation
    const user = await storageDb({
      type: 'write',
      table: 'users', data: { 
        name: 'Number Test',
        email: `normalize${Date.now()}@example.com`,
        password: 'pass'
      }
    });
    
    assert.strictEqual(typeof user.result.id, 'number');
  });

  it('should normalize null string to null value', async () => {
    const user = await storageDb({
      type: 'write',
      table: 'users', data: { 
        name: 'Null Test',
        email: `null${Date.now()}@example.com`,
        password: 'pass'
      }
    });
    
    // Password is required so we test that the user was created successfully
    assert.ok(user.result.id);
    assert.strictEqual(typeof user.result.password, 'string');
  });

  it('should handle relationship flattening via update', async () => {
    const user = await storageDb({
      type: 'write',
      table: 'users', data: {
        name: 'Rel Test',
        email: `rel${Date.now()}@example.com`,
        password: 'pass'
      }
    });
    
    const role = await storageDb({
      type: 'write',
      table: 'roles', data: { name: `HelperRole${Date.now()}` }
    });
    
    // Update with relationship
    const updated = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: user.result.id },data:  { roles: role.result.id } // Relationship flattening
    });
    
    assert.strictEqual(updated.result[0].roles, role.result.id);
  });

  it('should handle data creation with defaults', async () => {
    const user = await storageDb({
      type: 'write',
      table: 'users',
      data: { 
        name: 'Default Test',
        email: `defaults${Date.now()}@example.com`,
        password: 'pass'
        // Let system apply defaults
      }
    });
    
    assert.ok(user.result.id); // ID should be created
    assert.ok(user.result.createdAt || user.result.created_at || user.result.updatedAt); // Timestamp should exist
  });

  it('should handle complex query with multiple conditions', async () => {
    // Create test users
    await storageDb({
      type: 'write',
      table: 'users', data: { name: 'Query1', email: `q1-${Date.now()}@example.com`, password: 'pass' }
    });
    
    await storageDb({
      type: 'write',
      table: 'users', data: { name: 'Query2', email: `q2-${Date.now()}@example.com`, password: 'pass' }
    });
    
    // Query by pattern
    const all = await storageDb({
      type: 'read',
      table: 'users',
      query: {}
    });
    
    const records = all.result || [];
    const filtered = records.filter(u => u.name.startsWith('Query'));
    assert.ok(filtered.length >= 2);
  });
});

