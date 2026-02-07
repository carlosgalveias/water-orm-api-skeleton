# API REFERENCE

## Overview

The WORM API provides RESTful endpoints following JSON:API conventions. All endpoints (except authentication and health check) require JWT authentication via the `x-access-token` header.

**Base URL**: `http://localhost:PORT` (local) or `https://your-api-gateway-url` (Lambda)

**API Version**: 1.0

---

## Authentication

All API requests (except `/letmein/*` and `/ping`) require authentication using JWT tokens.

### Headers

```http
x-access-token: <your-jwt-token>
Content-Type: application/json
```

---

## Authentication Endpoints

### Sign In

Authenticate a user and receive a JWT token.

**Endpoint**: `POST /letmein/signin`

**Authentication Required**: No

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!@#",
  "device_uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `password` | string | Yes | User's password (15+ chars, 2+ uppercase, 2+ lowercase, 2+ numbers, 2+ special chars) |
| `device_uuid` | string | Yes | Unique device identifier (UUID format) |
| `code` | string | No | Access code for unknown device verification |
| `addDevice` | boolean | No | If true, add device to permitted devices after code validation |

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "data": {
      "encrypted": "hex-encoded-encrypted-data",
      "iv": "hex-encoded-iv",
      "salt": "hex-encoded-salt",
      "authTag": "hex-encoded-auth-tag"
    }
  }
}
```

The encrypted data contains:
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "full_name": "John Doe",
    "roles": 2,
    "state": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "key": "encryption-key-for-decryption"
}
```

**Error Responses**:

**401 - Invalid Credentials**:
```json
{
  "status": 401,
  "result": {
    "status": 401,
    "error": "Invalid Username or Password"
  }
}
```

**401 - User Not Found**:
```json
{
  "status": 401,
  "result": {
    "status": 401,
    "error": "User not found"
  }
}
```

**401 - User Blocked (5 minutes)**:
```json
{
  "status": 401,
  "result": {
    "status": 401,
    "error": "User blocked until 2024-01-01 12:05:00"
  }
}
```

**401 - User Blocked (30 minutes)**:
```json
{
  "status": 401,
  "result": {
    "status": 401,
    "error": "User blocked until 2024-01-01 12:30:00"
  }
}
```

**401 - Access Code Required**:
```json
{
  "status": 401,
  "result": {
    "status": 401,
    "error": "Access Code Required"
  }
}
```

**401 - Invalid Access Code**:
```json
{
  "status": 401,
  "result": {
    "status": 401,
    "error": "Invalid Access Code"
  }
}
```

**Device Verification Flow**:

1. **First Login from Unknown Device**: User receives `Access Code Required` error
2. **System Generates Code**: A 6-character code (e.g., `A3F2-D4E-B1C9-B`) is generated and emailed
3. **User Provides Code**: Include `code` field in next sign-in request
4. **Optional Device Whitelisting**: Set `addDevice: true` to remember the device

**Implementation**: [`routers/letmein.js`](routers/letmein.js:1), [`utils/util-auth.js`](utils/util-auth.js:707)

---

### Sign Out

Invalidate the current user's session.

**Endpoint**: `POST /letmein/signout`

**Authentication Required**: Yes

**Request Body**: Empty

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "message": "Successfully signed out"
  }
}
```

**Implementation**: [`utils/util-auth.js`](utils/util-auth.js:829)

---

### Change Password

Change the user's password with validation against password history.

**Endpoint**: `POST /letmein/change-password`

**Authentication Required**: Yes

**Request Body**:
```json
{
  "userId": 1,
  "oldPassword": "OldSecurePassword123!@#",
  "newPassword": "NewSecurePassword456$%^",
  "lookback": 5
}
```

**Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | integer | Yes | User ID |
| `oldPassword` | string | Yes | Current password |
| `newPassword` | string | Yes | New password (must meet complexity rules) |
| `lookback` | integer | No | Number of previous passwords to check (default: 5) |

**Password Rules**:
- Minimum 15 characters
- At least 2 uppercase letters
- At least 2 lowercase letters
- At least 2 numbers
- At least 2 special characters: `~ ! @ # $ € % ^ & * ( ) - _ + = { } [ ] | \ / : ; " ' < > , . ?`

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "message": "Password changed successfully"
  }
}
```

**Error Responses**:

**400 - Password Reused**:
```json
{
  "status": 400,
  "result": {
    "error": "Password has been used recently"
  }
}
```

**400 - Invalid Password Rules**:
```json
{
  "status": 400,
  "result": {
    "error": "Password does not meet complexity requirements"
  }
}
```

**Implementation**: [`utils/util-auth.js`](utils/util-auth.js:368)

---

### Generate Access Code

Generate an access code for password reset or device verification.

**Endpoint**: `POST /letmein/gen-code`

**Authentication Required**: No (for password reset) / Yes (for device verification)

**Request Body**:
```json
{
  "email": "user@example.com",
  "type": "password"
}
```

**Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `type` | string | Yes | Code type: `password` or `device` |

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "message": "Access code sent to email"
  }
}
```

**Code Format**:
- **Password Reset**: `XXXX-XXX-XXXX-A` (ends with -A)
- **Device Verification**: `XXXX-XXX-XXXX-B` (ends with -B)

**Implementation**: [`utils/util-auth.js`](utils/util-auth.js:229)

---

### Validate Access Code

Validate an access code without performing an action.

**Endpoint**: `POST /letmein/validate-code`

**Authentication Required**: No

**Request Body**:
```json
{
  "userId": 1,
  "code": "A3F2-D4E-B1C9-A",
  "type": "password"
}
```

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "valid": true
  }
}
```

**Error Response** (401):
```json
{
  "status": 401,
  "result": {
    "valid": false
  }
}
```

**Implementation**: [`utils/util-auth.js`](utils/util-auth.js:270)

---

## Generic CRUD Endpoints

The Generic Router provides automatic CRUD operations for all database models. These endpoints follow RESTful conventions and JSON:API specifications.

**Base Path**: `/generic/:model`

**Available Models**:
- `users`
- `roles`
- `sessions`
- `authorization_codes`
- `password_history`
- `permitted_devices`

---

### List Resources

Retrieve a list of resources with filtering, sorting, and pagination.

**Endpoint**: `GET /generic/:model`

**Authentication Required**: Yes

**Query Parameters**:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `limit` | integer | Maximum number of results (default: 50) | `?limit=10` |
| `skip` | integer | Number of results to skip (pagination) | `?skip=20` |
| `sort` | string | Sort field and direction | `?sort=name ASC` |
| `populate` | string | Relationships to expand | `?populate=roles` |
| `[field]` | any | Filter by field value | `?state=active` |
| `[field][operator]` | any | Filter with operator | `?createdAt[>=]=2024-01-01` |

**Filter Operators**:
- `<` - Less than
- `<=` - Less than or equal
- `>` - Greater than
- `>=` - Greater than or equal
- `!` - Not equal
- `contains` - String contains
- `startsWith` - String starts with
- `endsWith` - String ends with

**Example Requests**:

```http
GET /generic/users?state=active&limit=10
GET /generic/users?populate=roles
GET /generic/users?name[contains]=John&sort=createdAt DESC
GET /generic/users?createdAt[>=]=2024-01-01&createdAt[<]=2024-12-31
```

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "data": [
      {
        "id": 1,
        "email": "user@example.com",
        "name": "John Doe",
        "full_name": "John Doe",
        "state": "active",
        "roles": {
          "id": 2,
          "name": "user",
          "description": "Standard User"
        },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "count": 1,
      "limit": 10,
      "skip": 0
    }
  }
}
```

**Note**: Results are automatically filtered based on user permissions. Users may only see data they have access to based on their role configuration.

**Implementation**: [`routers/generic.js`](routers/generic.js:1)

---

### Get Single Resource

Retrieve a single resource by ID.

**Endpoint**: `GET /generic/:model/:id`

**Authentication Required**: Yes

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Model name |
| `id` | integer | Resource ID |

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `populate` | string | Relationships to expand |

**Example Request**:
```http
GET /generic/users/1?populate=roles
```

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "data": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "full_name": "John Doe",
      "state": "active",
      "roles": {
        "id": 2,
        "name": "user",
        "description": "Standard User"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Response** (404):
```json
{
  "status": 404,
  "result": {
    "error": "Resource not found"
  }
}
```

---

### Create Resource

Create a new resource.

**Endpoint**: `POST /generic/:model`

**Authentication Required**: Yes

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "name": "Jane Smith",
  "password": "SecurePassword123!@#",
  "full_name": "Jane Smith",
  "state": "active",
  "roles": 2
}
```

**Success Response** (201):
```json
{
  "status": 201,
  "result": {
    "data": {
      "id": 2,
      "email": "newuser@example.com",
      "name": "Jane Smith",
      "full_name": "Jane Smith",
      "state": "active",
      "roles": 2,
      "attempts": 0,
      "createdAt": "2024-01-02T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    }
  }
}
```

**Error Response** (400):
```json
{
  "status": 400,
  "result": {
    "error": "Validation error",
    "details": {
      "email": "Email already exists"
    }
  }
}
```

---

### Update Resource

Update an existing resource.

**Endpoint**: `PATCH /generic/:model/:id`

**Authentication Required**: Yes

**Request Body** (partial update):
```json
{
  "full_name": "Jane Doe Smith",
  "state": "inactive"
}
```

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "data": {
      "id": 2,
      "email": "newuser@example.com",
      "name": "Jane Smith",
      "full_name": "Jane Doe Smith",
      "state": "inactive",
      "roles": 2,
      "attempts": 0,
      "createdAt": "2024-01-02T00:00:00.000Z",
      "updatedAt": "2024-01-02T10:30:00.000Z"
    }
  }
}
```

**Error Response** (404):
```json
{
  "status": 404,
  "result": {
    "error": "Resource not found"
  }
}
```

**Error Response** (403):
```json
{
  "status": 403,
  "result": {
    "error": "Permission denied"
  }
}
```

---

### Delete Resource

Delete an existing resource.

**Endpoint**: `DELETE /generic/:model/:id`

**Authentication Required**: Yes

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Model name |
| `id` | integer | Resource ID |

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "message": "Resource deleted successfully"
  }
}
```

**Error Response** (404):
```json
{
  "status": 404,
  "result": {
    "error": "Resource not found"
  }
}
```

**Error Response** (403):
```json
{
  "status": 403,
  "result": {
    "error": "Permission denied"
  }
}
```

---

## Health Check Endpoint

### Ping

Check if the API is running.

**Endpoint**: `GET /ping`

**Authentication Required**: No

**Success Response** (200):
```json
{
  "status": 200,
  "result": {
    "message": "pong",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Implementation**: [`routers/ping.js`](routers/ping.js:1)

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "status": <http-status-code>,
  "result": {
    "error": "<error-message>",
    "details": {} // optional additional information
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request format or validation error |
| `401` | Unauthorized | Missing or invalid authentication token |
| `403` | Forbidden | Valid token but insufficient permissions |
| `404` | Not Found | Resource not found |
| `500` | Internal Server Error | Server-side error |

---

## Query Parameters Reference

### Filtering

**Exact Match**:
```http
GET /generic/users?state=active
GET /generic/users?email=user@example.com
```

**Comparison Operators**:
```http
GET /generic/users?attempts[>=]=3
GET /generic/users?createdAt[<]=2024-01-01
GET /generic/users?id[!]=1
```

**String Operators**:
```http
GET /generic/users?name[contains]=John
GET /generic/users?email[startsWith]=admin
GET /generic/users?email[endsWith]=@example.com
```

**Multiple Filters** (AND logic):
```http
GET /generic/users?state=active&attempts[<]=3&name[contains]=Smith
```

### Sorting

**Ascending**:
```http
GET /generic/users?sort=name ASC
```

**Descending**:
```http
GET /generic/users?sort=createdAt DESC
```

**Multiple Fields**:
```http
GET /generic/users?sort=state ASC,name ASC
```

### Pagination

**Using limit and skip**:
```http
GET /generic/users?limit=20&skip=0  // Page 1
GET /generic/users?limit=20&skip=20 // Page 2
GET /generic/users?limit=20&skip=40 // Page 3
```

**Default Values**:
- `limit`: 50
- `skip`: 0

### Relationship Population

**Single Relationship**:
```http
GET /generic/users?populate=roles
```

**Multiple Relationships**:
```http
GET /generic/users?populate=roles,sessions
```

**With ID**:
```http
GET /generic/users/1?populate=roles
```

---

## Request Headers

### Required Headers

All authenticated requests must include:

```http
x-access-token: <your-jwt-token>
Content-Type: application/json
```

### Optional Headers

```http
Accept: application/json
User-Agent: YourApp/1.0
```

---

## Response Format

All responses follow JSON:API conventions with a consistent structure:

### Success Response Structure

```json
{
  "status": <http-status-code>,
  "result": {
    "data": <resource-or-array-of-resources>,
    "meta": {
      "count": <number>,
      "limit": <number>,
      "skip": <number>
    }
  }
}
```

### Error Response Structure

```json
{
  "status": <http-status-code>,
  "result": {
    "error": "<error-message>",
    "details": {
      // optional field-specific errors
    }
  }
}
```

---

## Rate Limiting

Currently, the API does not implement rate limiting at the application level. However, the brute force protection mechanism limits authentication attempts:

- **3 failed attempts**: 5-minute lockout
- **6 failed attempts**: 30-minute lockout
- **9 failed attempts**: Account inactivation (requires administrator intervention)

---

## CORS Configuration

The API supports Cross-Origin Resource Sharing (CORS) for browser-based applications. Ensure your client application is configured to send credentials:

```javascript
fetch('http://localhost:3000/generic/users', {
  method: 'GET',
  headers: {
    'x-access-token': token,
    'Content-Type': 'application/json'
  },
  credentials: 'include'
});
```

---

## Example API Workflows

### Complete Authentication Flow

1. **Sign In**:
```bash
curl -X POST http://localhost:3000/letmein/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!@#",
    "device_uuid": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

2. **Decrypt Response** (use the key returned):
```javascript
const decrypted = await aes_256_gcm_decrypt(key, encryptedData);
const { user, token } = decrypted;
```

3. **Use Token for Requests**:
```bash
curl -X GET http://localhost:3000/generic/users \
  -H "x-access-token: <your-jwt-token>" \
  -H "Content-Type: application/json"
```

### Create and Update Resource

1. **Create User**:
```bash
curl -X POST http://localhost:3000/generic/users \
  -H "x-access-token: <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "name": "New User",
    "password": "SecurePassword123!@#",
    "full_name": "New User Full Name",
    "state": "active",
    "roles": 2
  }'
```

2. **Update User**:
```bash
curl -X PATCH http://localhost:3000/generic/users/2 \
  -H "x-access-token: <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Updated Full Name"
  }'
```

3. **Get Updated User**:
```bash
curl -X GET http://localhost:3000/generic/users/2?populate=roles \
  -H "x-access-token: <your-jwt-token>" \
  -H "Content-Type: application/json"
```

### Password Reset Flow

1. **Request Reset Code**:
```bash
curl -X POST http://localhost:3000/letmein/gen-code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "type": "password"
  }'
```

2. **User Receives Email** with code like `A3F2-D4E-B1C9-A`

3. **Change Password**:
```bash
curl -X POST http://localhost:3000/letmein/change-password \
  -H "x-access-token: <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "oldPassword": "OldPassword123!@#",
    "newPassword": "NewPassword456$%^"
  }'
```

---

## Best Practices

### Authentication
- Always use HTTPS in production
- Store JWT tokens securely (not in localStorage for web apps)
- Implement token refresh mechanism
- Handle 401 errors by redirecting to login

### API Requests
- Always include proper Content-Type headers
- Use query parameters for filtering and pagination
- Populate relationships only when needed
- Handle errors gracefully with user-friendly messages

### Performance
- Use pagination for large datasets (`limit` and `skip`)
- Minimize relationship population
- Cache responses when appropriate
- Use appropriate HTTP methods (GET for reads, POST for creates, etc.)

### Security
- Never log or expose JWT tokens
- Validate all input on client side before sending
- Handle sensitive data appropriately
- Implement CSRF protection for web applications

---

## See Also

- [`AUTHENTICATION.md`](AUTHENTICATION.md) - Detailed authentication flows
- [`PERMISSIONS.md`](PERMISSIONS.md) - Role-based access control
- [`DATABASE.md`](DATABASE.md) - Data models and relationships
- [`SECURITY.md`](SECURITY.md) - Security best practices