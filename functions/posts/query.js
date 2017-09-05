var db = require('../common/db.js');
var lambdaUtil = require('../common/lambda-util.js');
var headers = require('../common/headers.js');
var log = require('../common/log.js');

exports.handler = (event, context, callback) => {
  var q = event.queryStringParameters.q || undefined;
  var limit = event.queryStringParameters.limit;
  var exclusiveStartKey = event.queryStringParameters.exclusiveStartKey;
  log('Query:', q);

  db.findPostByQuery(q, limit, exclusiveStartKey).then(result => {
    lambdaUtil.send(callback, 200, result);
  }).catch(e => {
    lambdaUtil.send(callback, 500, {
      message: e.message
    });
  });
};
