# CONFIGURATION

## Overview

The WORM API uses environment variables and configuration files to manage application settings, database connections, security parameters, and deployment options. This document covers all configuration aspects for both local and production environments.

---

## Environment Variables

Environment variables are stored in a `.env` file at the project root. The API uses these variables for database connections, security keys, and application settings.

### Creating the .env File

```bash
# Copy the development template
cp .env_dev .env

# Edit with your settings
nano .env
```

### Required Environment Variables

#### Database Configuration

```bash
# PostgreSQL Connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=worm_api
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Database Pool Settings (optional)
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
```

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_HOST` | string | localhost | PostgreSQL server hostname |
| `DB_PORT` | integer | 5432 | PostgreSQL server port |
| `DB_NAME` | string | - | Database name |
| `DB_USER` | string | - | Database username |
| `DB_PASSWORD` | string | - | Database password |
| `DB_POOL_MIN` | integer | 2 | Minimum pool connections |
| `DB_POOL_MAX` | integer | 10 | Maximum pool connections |
| `DB_POOL_IDLE_TIMEOUT` | integer | 30000 | Idle timeout (ms) |

#### Redis Configuration

```bash
# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Redis Settings (optional)
REDIS_TTL=3600
REDIS_CONNECT_TIMEOUT=5000
```

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_HOST` | string | localhost | Redis server hostname |
| `REDIS_PORT` | integer | 6379 | Redis server port |
| `REDIS_PASSWORD` | string | - | Redis password (if enabled) |
| `REDIS_DB` | integer | 0 | Redis database number |
| `REDIS_TTL` | integer | 3600 | Default TTL for cached data (seconds) |
| `REDIS_CONNECT_TIMEOUT` | integer | 5000 | Connection timeout (ms) |

#### JWT & Security

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRY=60

# Encryption Keys
ENCRYPTION_KEY=your-aes-256-encryption-key-32-chars
```

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `JWT_SECRET` | string | - | Secret key for JWT signing (min 32 chars) |
| `JWT_EXPIRY` | integer | 60 | Token expiry time (minutes) |
| `ENCRYPTION_KEY` | string | - | AES-256 encryption key (32 chars) |

**Security Note**: Generate strong random keys:
```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Application Settings

```bash
# Application Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# CORS Settings
CORS_ORIGIN=http://localhost:4200
CORS_CREDENTIALS=true
```

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | integer | 3000 | Server port |
| `NODE_ENV` | string | development | Environment: `development`, `production`, `test` |
| `LOG_LEVEL` | string | info | Logging level: `error`, `warn`, `info`, `debug` |
| `CORS_ORIGIN` | string | * | Allowed CORS origins (comma-separated) |
| `CORS_CREDENTIALS` | boolean | true | Allow credentials in CORS |

#### Email Configuration (Optional)

```bash
# Email Settings (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@example.com
```

| Variable | Type | Description |
|----------|------|-------------|
| `SMTP_HOST` | string | SMTP server hostname |
| `SMTP_PORT` | integer | SMTP server port |
| `SMTP_SECURE` | boolean | Use TLS/SSL |
| `SMTP_USER` | string | SMTP username |
| `SMTP_PASSWORD` | string | SMTP password |
| `EMAIL_FROM` | string | Default sender email |

**Note**: Email functionality is currently placeholder in the code. See [`utils/util-auth.js`](utils/util-auth.js:440) for implementation points.

---

## Configuration Files

### constants.js

Location: [`config/constants.js`](config/constants.js:1)

Application-wide constants and settings.

```javascript
module.exports = {
  // JWT token expiry in minutes
  TOKEN_EXPIRY_MINUTES: 60,
  
  // AWS Lambda function URL (for serverless deployment)
  FUNCTION_URL: 'https://mylambdafunction.whatever/<FunctionName>',
  
  // Session cache TTL (seconds)
  SESSION_CACHE_TTL: 3600,
  
  // Password rules
  PASSWORD_MIN_LENGTH: 15,
  PASSWORD_MIN_UPPERCASE: 2,
  PASSWORD_MIN_LOWERCASE: 2,
  PASSWORD_MIN_NUMBERS: 2,
  PASSWORD_MIN_SPECIAL: 2,
  
  // Brute force protection
  ATTEMPTS_5MIN_BLOCK: 3,
  ATTEMPTS_30MIN_BLOCK: 6,
  ATTEMPTS_INACTIVATE: 9,
  
  // Access code settings
  CODE_EXPIRY_MINUTES: 5,
  
  // Password history lookback
  PASSWORD_HISTORY_LOOKBACK: 5
};
```

**Customization**:
- Modify token expiry based on security requirements
- Adjust password complexity rules for your organization
- Configure brute force thresholds

---

### database.js

Location: [`config/database.js`](config/database.js:1)

Database connection configuration using Waterline ORM.

```javascript
require('dotenv').config();

module.exports = {
  adapters: {
    'sails-postgresql': require('sails-postgresql')
  },
  
  connections: {
    postgresql: {
      adapter: 'sails-postgresql',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      
      // Connection pool settings
      pool: {
        min: parseInt(process.env.DB_POOL_MIN) || 2,
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000
      },
      
      // SSL settings (for production)
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      
      // Query settings
      charset: 'utf8',
      collation: 'utf8_general_ci'
    }
  },
  
  defaults: {
    migrate: 'safe' // Options: 'safe', 'alter', 'drop'
  }
};
```

**Migration Modes**:
- `safe`: Never auto-migrate (production)
- `alter`: Auto-migrate, preserve data (development)
- `drop`: Drop and recreate tables (dangerous!)

**SSL Configuration for Production**:
```javascript
ssl: {
  rejectUnauthorized: true,
  ca: fs.readFileSync('/path/to/ca-certificate.crt').toString(),
  key: fs.readFileSync('/path/to/client-key.pem').toString(),
  cert: fs.readFileSync('/path/to/client-cert.pem').toString()
}
```

---

### permissions.js

Location: [`config/permissions.js`](config/permissions.js:1)

Role-based access control configuration. See [`PERMISSIONS.md`](PERMISSIONS.md) for detailed documentation.

```javascript
module.exports = {
  whitelist: [
    '/letmein/signin',
    '/letmein/gen-code',
    '/letmein/validate-code',
    '/ping'
  ],
  
  permissions: {
    1: {
      name: 'admin',
      permissions: {
        users: ['read', 'write', 'delete', 'read_sensitive'],
        roles: ['read', 'write', 'delete'],
        sessions: ['read', 'delete'],
        authorization_codes: ['read', 'delete'],
        password_history: ['read', 'delete'],
        permitted_devices: ['read', 'write', 'delete']
      }
    },
    2: {
      name: 'user',
      permissions: {
        users: ['read', 'write'],
        roles: ['read'],
        sessions: [],
        authorization_codes: [],
        password_history: [],
        permitted_devices: ['read', 'write']
      }
    }
  }
};
```

---

## Local vs Production Settings

### Development Environment

**File**: `.env`

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Local database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=worm_api_dev

# Local Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Development keys (not secure)
JWT_SECRET=dev-secret-key-not-for-production
ENCRYPTION_KEY=dev-encryption-key-not-secure

# CORS - allow all origins
CORS_ORIGIN=*
```

**Characteristics**:
- Verbose logging (`debug` level)
- Local database and Redis
- Permissive CORS
- Less strict security (for testing)
- Hot-reload enabled

**Starting the Server**:
```bash
npm run dev
# or
node api/local.js
```

---

### Production Environment

**File**: `.env` (on production server)

```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn

# Production database (managed)
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_NAME=worm_api_production
DB_USER=prod_user
DB_PASSWORD=very-secure-password
DB_POOL_MIN=5
DB_POOL_MAX=20

# Production Redis (ElastiCache or managed)
REDIS_HOST=prod-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=secure-redis-password

# Strong production keys
JWT_SECRET=9f4b2e8c7d1a5f3e9b8c6d4a2f7e5b3c8d6a4f2e7b5c3d9a6f4e2b7d5c3a9f6e
ENCRYPTION_KEY=a7f3e9b5d2c8f4e6b3d9a5f2e8c7b4d6a3f9e5c2b8d7a4f6e3c9b5d2a8f7e4c

# Restrictive CORS
CORS_ORIGIN=https://app.example.com,https://admin.example.com
CORS_CREDENTIALS=true

# Email (production SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@example.com
```

**Characteristics**:
- Minimal logging (`warn` or `error`)
- Managed database and Redis
- Strict CORS policy
- Strong encryption keys
- SSL/TLS enabled
- Monitoring and alerting configured

**Starting the Server**:
```bash
npm start
# or with PM2
pm2 start api/local.js --name worm-api
```

---

### Test Environment

**File**: `.env.test`

```bash
NODE_ENV=test
PORT=3001
LOG_LEVEL=error

# Test database (separate from dev)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=worm_api_test

# Test Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# Test keys
JWT_SECRET=test-secret-key
ENCRYPTION_KEY=test-encryption-key-32-chars!!

# Disable email in tests
SMTP_HOST=
```

**Running Tests**:
```bash
npm test
```

---

## Security Configuration

### Helmet Middleware

The API uses Helmet to set secure HTTP headers. Configuration in [`api/api.js`](api/api.js:1):

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true
}));
```

### CORS Configuration

```javascript
const cors = require('cors');

const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-access-token'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
```

### Rate Limiting (Recommended)

While not currently implemented, here's a recommended configuration:

```javascript
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

// Stricter limit for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts'
});

app.use('/generic', apiLimiter);
app.use('/letmein', authLimiter);
```

---

## AWS Lambda Configuration

### Lambda Deployment Settings

**File**: [`config/constants.js`](config/constants.js:3)

```javascript
FUNCTION_URL: 'https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/<function-name>'
```

### Lambda Environment Variables

Configure in AWS Lambda Console or `serverless.yml`:

```yaml
provider:
  name: aws
  runtime: nodejs14.x
  stage: production
  region: us-east-1
  
  environment:
    NODE_ENV: production
    DB_HOST: ${env:DB_HOST}
    