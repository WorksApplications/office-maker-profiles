var headers = require('./headers.js');

function send(callback, statusCode, data) {
  callback(null, {
    statusCode: statusCode,
    headers: headers,
    body: data ? JSON.stringify(data) : ''
  });
}

module.exports = {
  send: send
};
