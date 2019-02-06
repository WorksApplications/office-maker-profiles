const jwt = require('jsonwebtoken');
const fs = require('fs');
const privateKey = process.env.PRIVATE_KEY || fs.readFileSync(__dirname + '/private.pem', 'utf8');
const index = require('./index.js');
const guest = require('./guest.js');

signAndEnsureItPasses(guest, privateKey).then(token => {
  console.log(token);
  fs.writeFileSync('./guest-token.txt', token);
}).catch(e => {
  console.error(e);
  process.exit(1);
});

function signAndEnsureItPasses(user, privateKey) {
  return sign(user, privateKey).then(token => {
    return index.getSelf(token).then(user_ => {
      delete user_.iat;
      delete user_.exp;
      if (JSON.stringify(user) === JSON.stringify(user_)) {
        return token;
      } else {
        console.error(user);
        console.error(user_);
        return Promise.reject('could not restore');
      }
    });
  });
}

function sign(user, privateKey) {
  return new Promise((resolve, reject) => {
    jwt.sign(user, privateKey, {
      algorithm: 'RS256',
      expiresIn: '360 days'
    }, function(e, token) {
      if (e) {
        reject(e);
      } else {
        resolve(token);
      }
    });
  });
}
