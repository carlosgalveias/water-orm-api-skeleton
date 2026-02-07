'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { MockDatabase } = require('../helpers/test-helpers');

describe('storage-db', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = new MockDatabase();
  });

  describe('CRUD Operations', () => {
    it('should create a record', async () => {
      const data = { name: 'Test User', email: 'test@example.com' };
      const result = await mockDb.create('users', data);
      
      assert.ok(result.id);
      assert.strictEqual(result.name, 'Test User');
      assert.strictEqual(result.email, 'test@example.com');
    });

    it('should read records', async () => {
      await mockDb.create('users', { name: 'User 1' });
      await mockDb.create('users', { name: 'User 2' });
      
      const results = await mockDb.find('users', {});
      
      assert.strictEqual(results.length, 2);
    });

    it('should read records with query', async () => {
      await mockDb.create('users', { name: 'Alice', state: 'active' });
      await mockDb.create('users', { name: 'Bob', state: 'inactive' });
      
      const results = await mockDb.find('users', { state: 'active' });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Alice');
    });

    it('should update a record', async () => {
      const created = await mockDb.create('users', { name: 'Old Name' });
      const updated = await mockDb.update('users', { id: created.id }, { name: 'New Name' });
      
      assert.strictEqual(updated[0].name, 'New Name');
    });

    it('should delete a record', async () => {
      const created = await mockDb.create('users', { name: 'To Delete' });
      await mockDb.destroy('users', { id: created.id });
      
      const results = await mockDb.find('users', { id: created.id });
      
      assert.strictEqual(results.length, 0);
    });

    it('should count records', async () => {
      await mockDb.create('users', { name: 'User 1' });
      await mockDb.create('users', { name: 'User 2' });
      await mockDb.create('users', { name: 'User 3' });
      
      const count = await mockDb.count('users', {});
      
      assert.strictEqual(count, 3);
    });
  });

  describe('Query Operations', () => {
    it('should find records by ID', async () => {
      const created = await mockDb.create('users', { name: 'Test' });
      const found = await mockDb.findOne('users', { id: created.id });
      
      assert.ok(found);
      assert.strictEqual(found.id, created.id);
    });

    it('should return null when record not found', async () => {
      const found = await mockDb.findOne('users', { id: 9999 });
      
      assert.strictEqual(found, null);
    });

    it('should support complex queries', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25 });
      await mockDb.create('users', { name: 'Bob', age: 30 });
      await mockDb.create('users', { name: 'Charlie', age: 35 });
      
      const results = await mockDb.find('users', { age: 30 });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Bob');
    });

    it('should support operator queries (>=)', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25 });
      await mockDb.create('users', { name: 'Bob', age: 30 });
      await mockDb.create('users', { name: 'Charlie', age: 35 });
      
      const results = await mockDb.find('users', { age: { '>=': 30 } });
      
      assert.strictEqual(results.length, 2);
    });

    it('should support operator queries (<=)', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25 });
      await mockDb.create('users', { name: 'Bob', age: 30 });
      
      const results = await mockDb.find('users', { age: { '<=': 25 } });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Alice');
    });

    it('should support $gt operator', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25 });
      await mockDb.create('users', { name: 'Bob', age: 30 });
      await mockDb.create('users', { name: 'Charlie', age: 35 });
      
      const results = await mockDb.find('users', { age: { $gt: 30 } });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Charlie');
    });

    it('should support $lt operator', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25 });
      await mockDb.create('users', { name: 'Bob', age: 30 });
      await mockDb.create('users', { name: 'Charlie', age: 35 });
      
      const results = await mockDb.find('users', { age: { $lt: 30 } });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Alice');
    });

    it('should support $gte operator', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25 });
      await mockDb.create('users', { name: 'Bob', age: 30 });
      await mockDb.create('users', { name: 'Charlie', age: 35 });
      
      const results = await mockDb.find('users', { age: { $gte: 30 } });
      
      assert.strictEqual(results.length, 2);
    });

    it('should support $lte operator', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25 });
      await mockDb.create('users', { name: 'Bob', age: 30 });
      await mockDb.create('users', { name: 'Charlie', age: 35 });
      
      const results = await mockDb.find('users', { age: { $lte: 30 } });
      
      assert.strictEqual(results.length, 2);
    });

    it('should support $ne operator', async () => {
      await mockDb.create('users', { name: 'Alice', state: 'active' });
      await mockDb.create('users', { name: 'Bob', state: 'inactive' });
      await mockDb.create('users', { name: 'Charlie', state: 'active' });
      
      const results = await mockDb.find('users', { state: { $ne: 'active' } });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Bob');
    });

    it('should support $in operator', async () => {
      await mockDb.create('users', { name: 'Alice', role: 'admin' });
      await mockDb.create('users', { name: 'Bob', role: 'user' });
      await mockDb.create('users', { name: 'Charlie', role: 'moderator' });
      
      const results = await mockDb.find('users', { role: { $in: ['admin', 'moderator'] } });
      
      assert.strictEqual(results.length, 2);
    });

    it('should support $nin operator', async () => {
      await mockDb.create('users', { name: 'Alice', role: 'admin' });
      await mockDb.create('users', { name: 'Bob', role: 'user' });
      await mockDb.create('users', { name: 'Charlie', role: 'moderator' });
      
      const results = await mockDb.find('users', { role: { $nin: ['admin', 'moderator'] } });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Bob');
    });

    it('should support nested where clauses', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25, state: 'active' });
      await mockDb.create('users', { name: 'Bob', age: 30, state: 'inactive' });
      await mockDb.create('users', { name: 'Charlie', age: 35, state: 'active' });
      
      const results = await mockDb.find('users', {
        age: { $gte: 30 },
        state: 'active'
      });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Charlie');
    });

    it('should support combined operators', async () => {
      await mockDb.create('users', { name: 'Alice', age: 20 });
      await mockDb.create('users', { name: 'Bob', age: 25 });
      await mockDb.create('users', { name: 'Charlie', age: 30 });
      await mockDb.create('users', { name: 'Dave', age: 35 });
      
      const results = await mockDb.find('users', {
        age: { $gte: 25, $lte: 30 }
      });
      
      assert.strictEqual(results.length, 2);
    });
  });

  describe('Timestamps', () => {
    it('should add createdAt timestamp', async () => {
      const result = await mockDb.create('users', { name: 'Test' });
      
      assert.ok(result.createdAt);
      assert.ok(result.createdAt instanceof Date);
    });

    it('should add updatedAt timestamp', async () => {
      const result = await mockDb.create('users', { name: 'Test' });
      
      assert.ok(result.updatedAt);
      assert.ok(result.updatedAt instanceof Date);
    });

    it('should update updatedAt on modification', async () => {
      const created = await mockDb.create('users', { name: 'Test' });
      const originalUpdatedAt = created.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await mockDb.update('users', { id: created.id }, { name: 'Updated' });
      
      assert.ok(updated[0].updatedAt > originalUpdatedAt);
    });
  });

  describe('Auto-increment ID', () => {
    it('should assign sequential IDs', async () => {
      const first = await mockDb.create('users', { name: 'First' });
      const second = await mockDb.create('users', { name: 'Second' });
      const third = await mockDb.create('users', { name: 'Third' });
      
      assert.strictEqual(first.id, 1);
      assert.strictEqual(second.id, 2);
      assert.strictEqual(third.id, 3);
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple creates', async () => {
      await mockDb.create('users', { name: 'User 1' });
      await mockDb.create('users', { name: 'User 2' });
      await mockDb.create('users', { name: 'User 3' });
      
      const all = await mockDb.find('users', {});
      
      assert.strictEqual(all.length, 3);
    });

    it('should handle multiple updates', async () => {
      await mockDb.create('users', { name: 'User 1', state: 'inactive' });
      await mockDb.create('users', { name: 'User 2', state: 'inactive' });
      
      await mockDb.update('users', { state: 'inactive' }, { state: 'active' });
      
      const active = await mockDb.find('users', { state: 'active' });
      
      assert.strictEqual(active.length, 2);
    });

    it('should handle multiple deletes', async () => {
      await mockDb.create('users', { name: 'User 1', state: 'temp' });
      await mockDb.create('users', { name: 'User 2', state: 'temp' });
      await mockDb.create('users', { name: 'User 3', state: 'permanent' });
      
      await mockDb.destroy('users', { state: 'temp' });
      
      const remaining = await mockDb.find('users', {});
      
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].state, 'permanent');
    });
  });

  describe('Table Isolation', () => {
    it('should keep tables separate', async () => {
      await mockDb.create('users', { name: 'User' });
      await mockDb.create('roles', { name: 'Admin' });
      
      const users = await mockDb.find('users', {});
      const roles = await mockDb.find('roles', {});
      
      assert.strictEqual(users.length, 1);
      assert.strictEqual(roles.length, 1);
    });

    it('should allow same IDs in different tables', async () => {
      const user = await mockDb.create('users', { name: 'User' });
      const role = await mockDb.create('roles', { name: 'Admin' });
      
      assert.strictEqual(user.id, 1);
      assert.strictEqual(role.id, 1);
    });
  });

  describe('Clear Operations', () => {
    it('should clear specific table', async () => {
      await mockDb.create('users', { name: 'User' });
      await mockDb.create('roles', { name: 'Admin' });
      
      mockDb.clear('users');
      
      const users = await mockDb.find('users', {});
      const roles = await mockDb.find('roles', {});
      
      assert.strictEqual(users.length, 0);
      assert.strictEqual(roles.length, 1);
    });

    it('should clear all tables', async () => {
      await mockDb.create('users', { name: 'User' });
      await mockDb.create('roles', { name: 'Admin' });
      
      mockDb.clear();
      
      const users = await mockDb.find('users', {});
      const roles = await mockDb.find('roles', {});
      
      assert.strictEqual(users.length, 0);
      assert.strictEqual(roles.length, 0);
    });

    it('should reset ID counter after clear', async () => {
      await mockDb.create('users', { name: 'User 1' });
      await mockDb.create('users', { name: 'User 2' });
      
      mockDb.clear();
      
      const newUser = await mockDb.create('users', { name: 'New User' });
      
      assert.strictEqual(newUser.id, 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle updates with empty data', async () => {
      const created = await mockDb.create('users', { name: 'Test' });
      const result = await mockDb.update('users', { id: created.id }, {});
      
      assert.ok(result);
      assert.strictEqual(result[0].name, 'Test');
    });

    it('should handle updates with non-existent IDs', async () => {
      const result = await mockDb.update('users', { id: 9999 }, { name: 'Updated' });
      
      assert.strictEqual(result.length, 0);
    });

    it('should handle destroy with non-existent IDs', async () => {
      const result = await mockDb.destroy('users', { id: 9999 });
      
      assert.strictEqual(result.length, 0);
    });

    it('should handle queries on empty tables', async () => {
      const results = await mockDb.find('users', { name: 'Nonexistent' });
      
      assert.strictEqual(results.length, 0);
    });

    it('should handle count on empty tables', async () => {
      const count = await mockDb.count('users', {});
      
      assert.strictEqual(count, 0);
    });

    it('should handle findOne with no match', async () => {
      await mockDb.create('users', { name: 'Test' });
      const result = await mockDb.findOne('users', { name: 'NoMatch' });
      
      assert.strictEqual(result, null);
    });
  });

  describe('Batch Operations - Extended', () => {
    it('should handle large batch creates', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(mockDb.create('users', { name: `User ${i}` }));
      }
      await Promise.all(promises);
      
      const count = await mockDb.count('users', {});
      
      assert.strictEqual(count, 100);
    });

    it('should maintain ID sequence with batch operations', async () => {
      const users = [];
      for (let i = 0; i < 10; i++) {
        users.push(await mockDb.create('users', { name: `User ${i}` }));
      }
      
      assert.strictEqual(users[0].id, 1);
      assert.strictEqual(users[9].id, 10);
    });

    it('should handle bulk updates correctly', async () => {
      for (let i = 0; i < 5; i++) {
        await mockDb.create('users', { name: `User ${i}`, status: 'pending' });
      }
      
      const updated = await mockDb.update('users', { status: 'pending' }, { status: 'approved' });
      
      assert.strictEqual(updated.length, 5);
      assert.ok(updated.every(u => u.status === 'approved'));
    });
  });

  describe('Pagination and Sorting', () => {
    it('should handle count with complex queries', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25, state: 'active' });
      await mockDb.create('users', { name: 'Bob', age: 30, state: 'inactive' });
      await mockDb.create('users', { name: 'Charlie', age: 35, state: 'active' });
      
      const count = await mockDb.count('users', { state: 'active' });
      
      assert.strictEqual(count, 2);
    });

    it('should handle queries with multiple conditions', async () => {
      await mockDb.create('users', { name: 'Alice', age: 25, role: 'admin', state: 'active' });
      await mockDb.create('users', { name: 'Bob', age: 30, role: 'user', state: 'active' });
      await mockDb.create('users', { name: 'Charlie', age: 35, role: 'admin', state: 'inactive' });
      
      const results = await mockDb.find('users', { role: 'admin', state: 'active' });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Alice');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent creates', async () => {
      const promises = [
        mockDb.create('users', { name: 'User 1' }),
        mockDb.create('users', { name: 'User 2' }),
        mockDb.create('users', { name: 'User 3' }),
      ];
      
      const results = await Promise.all(promises);
      
      assert.strictEqual(results.length, 3);
      assert.ok(results.every(r => r.id > 0));
    });

    it('should handle concurrent updates', async () => {
      const user1 = await mockDb.create('users', { name: 'User 1', count: 0 });
      const user2 = await mockDb.create('users', { name: 'User 2', count: 0 });
      
      await Promise.all([
        mockDb.update('users', { id: user1.id }, { count: 1 }),
        mockDb.update('users', { id: user2.id }, { count: 2 }),
      ]);
      
      const updated1 = await mockDb.findOne('users', { id: user1.id });
      const updated2 = await mockDb.findOne('users', { id: user2.id });
      
      assert.strictEqual(updated1.count, 1);
      assert.strictEqual(updated2.count, 2);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all fields on update', async () => {
      const created = await mockDb.create('users', {
        name: 'Test',
        email: 'test@example.com',
        age: 25
      });
      
      const updated = await mockDb.update('users', { id: created.id }, { age: 26 });
      
      assert.strictEqual(updated[0].name, 'Test');
      assert.strictEqual(updated[0].email, 'test@example.com');
      assert.strictEqual(updated[0].age, 26);
    });

    it('should maintain timestamps through operations', async () => {
      const created = await mockDb.create('users', { name: 'Test' });
      
      assert.ok(created.createdAt instanceof Date);
      assert.ok(created.updatedAt instanceof Date);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      const updated = await mockDb.update('users', { id: created.id }, { name: 'Updated' });
      
      assert.ok(updated[0].updatedAt.getTime() >= created.updatedAt.getTime());
      assert.strictEqual(updated[0].createdAt.getTime(), created.createdAt.getTime());
    });

    it('should not modify original data object', async () => {
      const originalData = { name: 'Test', email: 'test@example.com' };
      const dataCopy = { ...originalData };
      
      await mockDb.create('users', originalData);
      
      assert.deepStrictEqual(originalData, dataCopy);
    });
  });

  describe('Query Edge Cases', () => {
    it('should handle queries with null values', async () => {
      await mockDb.create('users', { name: 'Alice', manager: null });
      await mockDb.create('users', { name: 'Bob', manager: 'Charlie' });
      
      const results = await mockDb.find('users', { manager: null });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Alice');
    });

    it('should handle queries with boolean values', async () => {
      await mockDb.create('users', { name: 'Alice', active: true });
      await mockDb.create('users', { name: 'Bob', active: false });
      
      const results = await mockDb.find('users', { active: true });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Alice');
    });

    it('should handle queries with numeric zero', async () => {
      await mockDb.create('users', { name: 'Alice', score: 0 });
      await mockDb.create('users', { name: 'Bob', score: 10 });
      
      const results = await mockDb.find('users', { score: 0 });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Alice');
    });

    it('should handle empty string queries', async () => {
      await mockDb.create('users', { name: 'Alice', description: '' });
      await mockDb.create('users', { name: 'Bob', description: 'Some text' });
      
      const results = await mockDb.find('users', { description: '' });
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, 'Alice');
    });
  });
});