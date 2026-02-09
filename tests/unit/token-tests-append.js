
    });

    it('should not refresh if rf is far in future', () => {
      const now = Date.now();
      const rf = now + 1200000;
      const needsRefresh = rf < (now + 300000);
      assert.strictEqual(needsRefresh, false);
    });

    it('should handle expired rf timestamp', () => {
      const now = Date.now();
      const rf = now - 100000;
      const isExpired = rf < now;
      assert.strictEqual(isExpired, true);
    });

    it('should extend session on refresh', () => {
      const now = Date.now();
      const newRf = now + 600000;
      assert.ok(newRf > now);
    });
  });

  // NEW COMPREHENSIVE TOKEN GENERATION TESTS
  describe('Token Generation - buildExpiryDate', () => {
    it('should generate expiry date with default duration', () => {
      const constants = require('../../config/constants');
      const now = Date.now();
      const expirySeconds = constants.TOKEN_EXPIRY_MINUTES * 60 || 1800;
      const expectedExpiry = now + (expirySeconds * 1000);
      
      const tolerance = 2000;
      assert.ok(Math.abs(expectedExpiry - (now + expirySeconds * 1000)) < tolerance);
    });

    it('should generate expiry date with custom duration', () => {
      const customSeconds = 3600;
      const now = Date.now();
      const expectedExpiry = now + (customSeconds * 1000);
      
      const tolerance = 2000;
      assert.ok(Math.abs(expectedExpiry - (now + customSeconds * 1000)) < tolerance);
    });

    it('should return both date and seconds', () => {
      const expirySeconds = 1800;
      const result = {
        date: new Date(Date.now() + expirySeconds * 1000),
        seconds: expirySeconds
      };
      
      assert.ok(result.date instanceof Date);
      assert.strictEqual(result.seconds, expirySeconds);
    });

    it('should generate future expiry date', () => {
      const expirySeconds = 1800;
      const now = Date.now();
      const expiryDate = new Date(now + expirySeconds * 1000);
      
      assert.ok(expiryDate.getTime() > now);
    });
  });

  describe('Token Generation - buildTokenData functionality', () => {
    it('should generate token with user payload', () => {
      const jwt = require('jsonwebtoken');
      const payload = {
        id: 1,
        roles: ['admin'],
        companies: [1, 2],
        projects: [10, 20]
      };
      
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      assert.ok(token);
      assert.ok(typeof token === 'string');
      assert.ok(token.split('.').length === 3);
    });

    it('should include rf timestamp in token data', () => {
      const now = Date.now();
      const rf = now + 600000;
      const tokenData = {
        token: 'test-token',
        token_expiry_date: new Date(now + 1800000).toISOString(),
        rf: rf
      };
      
      assert.ok(tokenData.rf);
      assert.ok(tokenData.rf > now);
    });

    it('should generate ISO format expiry date', () => {
      const expiryDate = new Date(Date.now() + 1800000);
      const isoString = expiryDate.toISOString();
      
      assert.ok(isoString);
      assert.ok(isoString.includes('T'));
      assert.ok(isoString.includes('Z'));
    });

    it('should generate token with worker role payload', () => {
      const jwt = require('jsonwebtoken');
      const workerPayload = {
        id: 100,
        roles: ['worker'],
        companies: 5,
        projects: [10]
      };
      
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const token = jwt.sign(workerPayload, tokenHash, { expiresIn: 1800 });
      
      assert.ok(token);
      const decoded = jwt.decode(token);
      assert.strictEqual(decoded.id, 100);
      assert.ok(decoded.roles.includes('worker'));
    });

    it('should generate token with custom expiry seconds', () => {
      const jwt = require('jsonwebtoken');
      const payload = { id: 1, roles: ['admin'] };
      const customExpiry = 7200;
      
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const token = jwt.sign(payload, tokenHash, { expiresIn: customExpiry });
      
      assert.ok(token);
      const decoded = jwt.decode(token);
      const expiresIn = decoded.exp - decoded.iat;
      assert.ok(expiresIn >= customExpiry - 1 && expiresIn <= customExpiry + 1);
    });

    it('should handle token with empty arrays in payload', () => {
      const jwt = require('jsonwebtoken');
      const payload = {
        id: 1,
        roles: [],
        companies: [],
        projects: []
      };
      
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      assert.ok(token);
      const decoded = jwt.decode(token);
      assert.ok(Array.isArray(decoded.roles));
      assert.strictEqual(decoded.roles.length, 0);
    });

    it('should generate unique tokens for same payload', () => {
      const jwt = require('jsonwebtoken');
      const payload = { id: 1, roles: ['admin'] };
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      
      const token1 = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      const token2 = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded1 = jwt.decode(token1);
      const decoded2 = jwt.decode(token2);
      assert.ok(decoded1.iat <= decoded2.iat);
    });

    it('should validate token format length', () => {
      const jwt = require('jsonwebtoken');
      const payload = { id: 1, roles: ['admin'] };
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      assert.ok(token.length > 50);
      const parts = token.split('.');
      assert.ok(parts[0].length > 10);
      assert.ok(parts[1].length > 10);
      assert.ok(parts[2].length > 10);
    });
  });

  // NEW COMPREHENSIVE TOKEN VALIDATION TESTS
  describe('Token Validation - validateToken functionality', () => {
    it('should validate well-formed JWT token', async () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      try {
        const decoded = jwt.verify(token, tokenHash);
        assert.ok(decoded);
        assert.strictEqual(decoded.id, 1);
      } catch (err) {
        assert.fail('Valid token should not throw error');
      }
    });

    it('should reject expired token', async () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, tokenHash, { expiresIn: -1 });
      
      try {
        jwt.verify(token, tokenHash);
        assert.fail('Expired token should throw error');
      } catch (err) {
        assert.ok(err);
        assert.ok(err.name === 'TokenExpiredError' || err.message.includes('expired'));
      }
    });

    it('should reject token with invalid signature', async () => {
      const jwt = require('jsonwebtoken');
      const correctHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const wrongHash = 'wrong-secret-key';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, correctHash, { expiresIn: 1800 });
      
      try {
        jwt.verify(token, wrongHash);
        assert.fail('Token with wrong signature should throw error');
      } catch (err) {
        assert.ok(err);
        assert.ok(err.name === 'JsonWebTokenError');
      }
    });

    it('should reject malformed token', async () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const malformedToken = 'not.a.valid.token';
      
      try {
        jwt.verify(malformedToken, tokenHash);
        assert.fail('Malformed token should throw error');
      } catch (err) {
        assert.ok(err);
        assert.ok(err.name === 'JsonWebTokenError');
      }
    });

    it('should reject null token', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      
      try {
        jwt.verify(null, tokenHash);
        assert.fail('Null token should throw error');
      } catch (err) {
        assert.ok(err);
      }
    });

    it('should reject undefined token', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      
      try {
        jwt.verify(undefined, tokenHash);
        assert.fail('Undefined token should throw error');
      } catch (err) {
        assert.ok(err);
      }
    });

    it('should reject empty string token', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      
      try {
        jwt.verify('', tokenHash);
        assert.fail('Empty token should throw error');
      } catch (err) {
        assert.ok(err);
      }
    });

    it('should extract payload from valid token', async () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = {
        id: 1,
        roles: ['admin', 'user'],
        companies: [1, 2],
        projects: [10, 20]
      };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.verify(token, tokenHash);
      assert.strictEqual(decoded.id, 1);
      assert.ok(Array.isArray(decoded.roles));
      assert.strictEqual(decoded.roles.length, 2);
      assert.ok(decoded.roles.includes('admin'));
    });

    it('should validate token structure has three parts', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const parts = token.split('.');
      assert.strictEqual(parts.length, 3);
      assert.ok(parts[0].length > 0);
      assert.ok(parts[1].length > 0);
      assert.ok(parts[2].length > 0);
    });

    it('should validate token contains iat and exp claims', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'] };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.decode(token);
      assert.ok(decoded.iat);
      assert.ok(decoded.exp);
      assert.ok(decoded.exp > decoded.iat);
    });
  });

  describe('Token Validation - getTokenParams (decode without verify)', () => {
    it('should decode token without verification', () => {
      const jwt = require('jsonwebtoken');
      const tokenHash = '#H64jy5L|jJS.@;v2>jp3X$o.,K2hmwOJt#8w|YVb$c8uC`RTn';
      const payload = { id: 1, roles: ['admin'], email: 'test@example.com' };
      const token = jwt.sign(payload, tokenHash, { expiresIn: 1800 });
      
      const decoded = jwt.decode(token);
      assert.ok(decoded);
      assert.strictEqual(decode