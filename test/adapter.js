
const after = require('../after.js');

module.exports = {
  resolved: safe(after.resolve),
  rejected: safe(after.reject),
  deferred: safe(after.deferred)
}

function safe(f) {
  return function (arg1, arg2) {
    try {
      return f(arg1, arg2)
    } catch (err) {
      return err;
    }
  }
}
