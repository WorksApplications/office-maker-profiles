var db = require('../common/db.js');
var lambdaUtil = require('../common/lambda-util.js');

exports.handler = (event, context, callback) => {
  console.log('event:', JSON.stringify(event, null, 2));
  var profile = JSON.parse(event.body);
  console.log('profile:', JSON.stringify(profile, null, 2));
  db.putProfileAndMakeIndex(profile).then(_ => {
    lambdaUtil.send(callback, 200);
  }).catch(e => {
    console.log('error:', e);
    lambdaUtil.send(callback, 500, {
      message: e.message
    });
  });
};
