const crypto = require('crypto');

function generateResetCode() {
  return crypto.randomBytes(3).toString('hex');
}

module.exports = { generateResetCode };