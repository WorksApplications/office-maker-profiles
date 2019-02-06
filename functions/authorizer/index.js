var jwt = require('jsonwebtoken');
var fs = require('fs');
var publicKey = process.env.PUBLIC_KEY || fs.readFileSync(__dirname + '/pubkey.pem', 'utf8');
var sourceIp = require('../../config.json').sourceIp;

function getSelf(token) {
  if (!token) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    jwt.verify(token, publicKey, {
      algorithms: ['RS256', 'RS384', 'RS512', 'HS256', 'HS256', 'HS512', 'ES256', 'ES384', 'ES512']
    }, function(e, user) {
      if (e) {
        reject(e);
      } else {
        resolve(user);
      }
    });
  });
}

exports.getSelf = getSelf; // for test
exports.handler = (event, context, callback) => {
  console.log(event, context);
  event.headers = event.headers || {};
  var token = (event.authorizationToken || '').split('Bearer ')[1];
  getSelf(token).catch(e => {
    console.log(e);
    return null;
  }).then(user => {
    if (user && user.role.toLowerCase() === 'admin') {
      callback(null, {
        principalId: user.userId,
        policyDocument: {
          Version: '2012-10-17',
          Statement: [{
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn
          }]
        },
        context: user
      });
    } else if (user && (user.role.toLowerCase() === 'general' || user.role.toLowerCase() === 'guest')) {
      callback(null, {
        principalId: user.userId,
        policyDocument: {
          Version: '2012-10-17',
          Statement: [{
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn
              .replace('/POST/', '/GET/')
              .replace('/PUT/', '/GET/')
              .replace('/PATCH/', '/GET/')
              .replace('/DELETE/', '/GET/')
          }]
        },
        context: user
      });
    } else {
      callback(null, {
        principalId: 'guest',
        policyDocument: {
          Version: '2012-10-17',
          Statement: [{
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Condition: {
              IpAddress: {
                "aws:SourceIp": sourceIp
              }
            },
            Resource: event.methodArn
              .replace('/POST/', '/GET/')
              .replace('/PUT/', '/GET/')
              .replace('/PATCH/', '/GET/')
              .replace('/DELETE/', '/GET/')
          }]
        },
        context: user
      });
    }
  }).catch(_ => {
    callback('Unauthorized');
  });
}
