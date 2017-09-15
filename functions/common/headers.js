const fs = require('fs');

const configJsonFile = __dirname + '/config.json';
const config = JSON.parse(fs.readFileSync(configJsonFile, 'utf8'));

module.exports = {
  'Access-Control-Allow-Origin': config.accessControlAllowOrigin,
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};
