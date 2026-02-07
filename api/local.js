'use strict';

/**
 * ENVIRONMENT SETUP
 * =============================================================================
 */
process.env.RUNNING_LOCALLY = true;

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('../utils/util-session');
const permissionMiddleware = require('../utils/util-permission-middleware');

let environment = process.env.RUNNING_TESTS ? 'dev' : process.argv[2] || 'dev';
if (environment === 'test' || environment === '--') {
  process.env.RUNNING_TESTS = true;
  environment = 'dev';
}

const envFile = path.join(__dirname, '..', '.env_' + environment);
const destFile = path.join(__dirname, '..', '.env');

if (fs.existsSync(envFile)) {
  fs.copyFileSync(envFile, destFile);
  require('dotenv').config({ path: destFile });
}

// Loads the generic router/DB
const db = require(path.join(__dirname, '../routers', 'generic.js'));

/**
 * AUXILIARY FUNCTIONS
 * =============================================================================
 */

const getRouter = (component, id) => {
  const fileName = path.join(__dirname, '../routers', `${component}${id ? '-id' : ''}.js`);
  return fs.existsSync(fileName) ? require(fileName) : db;
};

// Standardized response handler to convert the internal callback style to a Promise
const processRoute = async (route, method, req) => {
  return new Promise((resolve, reject) => {
    try {
      route[method](req, async (ret) => {
        try {
          // 1. Filter response for specific roles
          if (ret.status === 200 && ret.result.data && req.decoded) {
            const { roles } = req.decoded;
            if (roles.includes('developer') || roles.includes('auditor')) {
              permissionMiddleware.filterResponse(req.decoded, ret.result);
            }
          }

          // 2. Handle specific model updates (e.g., users)
          if (ret.status === 200 && method === 'patch' && ret.result.data?.type === 'users') {
            await session.updateUserToken(ret.result.data);
          }

          // 3. Clean sensitive data
          if (ret.status === 200 && Array.isArray(ret.result.data) && ret.result.data[0]?.type === 'users') {
            ret.result.data.forEach(d => delete d.attributes?.password);
          }

          // 4. Handle Session Refresh
          if (ret.status === 200 && req.decoded && (!req.decoded.rf || req.decoded.rf < Date.now())) {
            if (typeof ret.result === 'object') {
              const newCreds = await session.refreshSession(req);
              ret.result.meta = { ...(ret.result.meta || {}), ...newCreds };
            }
          }

          // 5. Relogin flag
          if (req.needNewToken) ret.result.relogin = true;

          resolve(ret);
        } catch (err) {
          reject({ status: 500, message: err.message });
        }
      });
    } catch (ex) {
      reject({ status: 500, message: `Router execution failed: ${ex.message}` });
    }
  });
};

/**
 * MAIN APP INITIALIZATION
 * =============================================================================
 */
const initLocal = async function() {
  const app = express();
  const port = process.env.PORT || 8080;

  app.use(bodyParser.json({ limit: '100mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
  app.disable('x-powered-by');

  // CORS & Options Middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-access-token');
    res.header('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  const router = express.Router();

  // UNIVERSAL ROUTE HANDLER
  // Matches both /*model and /*model/:id
  router.all(['/*model/:id', '/*model'], async (req, res) => {
    try {
      req.orm = db;
      
      // 1. Permission Validation
      await permissionMiddleware.validate(req);

      // 2. ID Validation logic (for specific ID routes)
      if (req.params.id) {
        const id = parseInt(req.params.id);
        if (req.query.id && Array.isArray(req.query.id)) {
          if (!req.query.id.map(String).includes(String(id))) {
            throw { status: 404, message: 'Not Found' };
          }
          delete req.query.id;
        }
      }

      // 3. Resolve Component & Method
      const component = req.params.model[0].replace(/^\//, '').split('/')[0];
      const method = req.method.toLowerCase();
      const route = getRouter(component, req.params.id);

      // 4. Call Method
      const ret = await processRoute(route, method, req);

      // 5. Final Response (Handling Redirects vs Normal)
      if (ret.status >= 300 && ret.status <= 308 && ret.result.redirect) {
        return res.redirect(ret.status, ret.result.redirect);
      }

      return res.status(ret.status).send(ret.result);

    } catch (ex) {
      console.error('Route Error:', ex);
      res.status(ex.status || 500).send({
        success: false,
        message: ex.message || 'Internal Server Error'
      });
    }
  });

  app.use('/api', router);

  if (!process.env.RUNNING_TESTS) {
    app.listen(port, () => console.log(`Magic happens on port ${port}`));
  }
  
  return app;
};

// When run directly, start the server
if (require.main === module) {
  initLocal().catch(err => {
    console.error('Initialization Failed:', err);
    process.exit(1);
  });
}

// Export for testing
module.exports = { initLocal };