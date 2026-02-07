'use strict';

const test = function(req, res) {
  const method = req.method;
  return res({
      status: 200,
      result: { message: `you sucessfully made a ping with method ${method}` }
  })

}

module.exports = {
  get: test,
  post: test,
  patch: test,
  delete: test
}