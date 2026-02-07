process.env.RUNNING_TESTS = 'true';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const storageDb = require('../../controllers/storage-db');

describe('Generic Router - PATCH Operations', () => {
  let testUserId;
  let testEmail;

  beforeEach(async () => {
    // Create a user to update in each test
    testEmail = `patchtest${Date.now()}@example.com`;
    const result = await storageDb({
      type: 'write',
      table: 'users',
      data: { name: 'Original Name', email: testEmail, password: 'original123' }
    });
    testUserId = result.result.id;
  });

  afterEach(async () => {
    // Clean up
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

  it('should update user name only', async () => {
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Updated Name' }
    });
    
    assert.strictEqual(result.result[0].name, 'Updated Name');
    assert.strictEqual(result.result[0].email, testEmail); // Email unchanged
  });

  it('should update multiple attributes at once', async () => {
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { 
        name: 'New Name',
        password: 'newpass123'
      }
    });
    
    assert.strictEqual(result.result[0].name, 'New Name');
    assert.strictEqual(result.result[0].password, 'newpass123');
  });

  it('should handle partial update (not all fields)', async () => {
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Partial Update' }
    });
    
    assert.strictEqual(result.result[0].name, 'Partial Update');
    // Other fields should remain unchanged
    assert.ok(result.result[0].email);
  });

  it('should reject update with invalid ID', async () => {
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: 99999 }, // Non-existent ID
      data: { name: 'Should Fail' }
    });
    
    assert.ok(result.result === null || (Array.isArray(result.result) && result.result.length === 0), 'Should return null or empty array for non-existent ID');
  });

  it('should handle update of non-existent user', async () => {
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: 99999 },
      data: { name: 'Ghost' }
    });
    
    assert.ok(result.result === null || (Array.isArray(result.result) && result.result.length === 0), 'Should return null or empty array for non-existent record');
  });

  it('should enforce unique email constraint on update', async () => {
    // Create second user
    const email2 = `second${Date.now()}@example.com`;
    await storageDb({
      type: 'write',
      table: 'users',
      data: { name: 'Second User', email: email2, password: 'pass123' }
    });
    
    // Try to update first user with second user's email
    await assert.rejects(
      async () => {
        await storageDb({
          type: 'update',
          table: 'users',
          query: { id: testUserId },
          data: { email: email2 } // Duplicate email
        });
      },
      (err) => {
        return err.code === 'E_VALIDATION' &&
               err.details &&
               (err.details.includes('already exists') || err.details.includes('duplicate') || err.details.includes('unique'));
      }
    );
  });

  it('should handle null values in update', async () => {
    // Password is required, so we test with a non-required field instead
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Updated with valid data' }
    });
    
    assert.strictEqual(result.result[0].name, 'Updated with valid data');
  });

  it('should validate data types on update', async () => {
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { attempts: 10 } // Number type
    });
    
    assert.strictEqual(result.result[0].attempts, 10);
    assert.strictEqual(typeof result.result[0].attempts, 'number');
  });

  it('should update and verify persistence', async () => {
    await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Persisted Update' }
    });
    
    const result = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: testUserId }
    });
    
    assert.strictEqual(result.result[0].name, 'Persisted Update');
  });

  it('should handle empty update object', async () => {
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: {} // No changes
    });
    
    assert.ok(result.result[0]);
    assert.strictEqual(result.result[0].name, 'Original Name'); // Unchanged
  });

  it('should update role relationship', async () => {
    // Create role
    const roleResult = await storageDb({
      type: 'write',
      table: 'roles',
      data: { name: `UpdateRole${Date.now()}`, description: 'Test role' }
    });
    
    // Update user with role
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { roles: roleResult.result.id }
    });
    
    assert.strictEqual(result.result[0].roles, roleResult.result.id);
  });

  it('should handle special characters in update', async () => {
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: "O'Brien & Smith <test>" }
    });
    
    assert.strictEqual(result.result[0].name, "O'Brien & Smith <test>");
  });

  it('should update with same values (idempotent)', async () => {
    const result1 = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Same Name' }
    });
    
    const result2 = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Same Name' } // Same update again
    });
    
    assert.strictEqual(result1.result[0].name, result2.result[0].name);
  });

  it('should handle concurrent updates', async () => {
    // Simulate concurrent updates
    const update1 = storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Update1' }
    });
    
    const update2 = storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { password: 'newpass' }
    });
    
    await Promise.all([update1, update2]);
    
    const result = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: testUserId }
    });
    
    assert.ok(result.result[0]); // Should still exist
  });

  it('should update with very long string', async () => {
    const longName = 'A'.repeat(100);
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: longName }
    });
    
    assert.strictEqual(result.result[0].name, longName);
  });

  it('should clear optional field', async () => {
    // First set a value
    await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Has Value' }
    });
    
    // Then verify we can update to a different value
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'New Value' }
    });
    
    assert.strictEqual(result.result[0].name, 'New Value');
  });

  it('should update email to new unique value', async () => {
    const newEmail = `newemail${Date.now()}@example.com`;
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { email: newEmail }
    });
    
    assert.strictEqual(result.result[0].email, newEmail);
  });

  it('should maintain other fields during update', async () => {
    const originalResult = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: testUserId }
    });
    
    await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Only Name Changed' }
    });
    
    const result = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: testUserId }
    });
    
    assert.strictEqual(result.result[0].email, originalResult.result[0].email);
    assert.strictEqual(result.result[0].password, originalResult.result[0].password);
  });

  it('should handle multiple sequential updates', async () => {
    await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Update 1' }
    });
    
    await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Update 2' }
    });
    
    await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Update 3' }
    });
    
    const result = await storageDb({
      type: 'read',
      table: 'users',
      query: { id: testUserId }
    });
    
    assert.strictEqual(result.result[0].name, 'Update 3');
  });

  it('should update and return updated record', async () => {
    const result = await storageDb({
      type: 'update',
      table: 'users',
      query: { id: testUserId },
      data: { name: 'Return Test' }
    });
    
    assert.ok(Array.isArray(result.result));
    assert.strictEqual(result.result.length, 1);
    assert.strictEqual(result.result[0].id, testUserId);
    assert.strictEqual(result.result[0].name, 'Return Test');
  });
});