process.env.REGION = 'ap-northeast-1';
process.env.TABLE_PREFIX = 'test-';
process.env.IS_OFFLINE = 'true';
process.env.DB_ENDPOINT = 'http://localhost:8000';

const AWS = require('aws-sdk');
const db = require('../functions/common/db.js');
const dynamoUtil = require('../functions/common/dynamo-util.js');
const options = require('../functions/common/db-config.js');
const documentClient = new AWS.DynamoDB.DocumentClient(options.options);

const profilesGet = require('../functions/profiles/get.js');
const profilesPut = require('../functions/profiles/put.js');
const profilesDelete = require('../functions/profiles/delete.js');
const profilesQuery = require('../functions/profiles/query.js');

describe('Profile Lambda', () => {
  beforeEach(() => {
    return db.putProfileAndMakeIndex({
      userId: 'yamada_t@example.com',
      picture: null,
      name: '山田 太郎',
      ruby: 'やまだ たろう',
      employeeId: '1234',
      organization: 'Example Co., Ltd.',
      post: 'Tech',
      rank: 'Manager',
      cellPhone: '080-XXX-4567',
      extensionPhone: 'XXXXX',
      mail: 'yamada_t@example.com',
      workplace: null
    }).then(_ => db.putProfileAndMakeIndex({
      userId: 'yamada_s@example.com',
      picture: null, // be sure to allow empty string
      name: '山田 Saburo',
      ruby: 'やまだ さぶろう',
      employeeId: '1235',
      organization: 'Example Co., Ltd.',
      post: 'Sales and Tech',
      rank: 'Assistant',
      cellPhone: '080-XXX-5678',
      extensionPhone: 'XXXXX',
      mail: 'yamada_s@example.com',
      workplace: null // be sure to allow empty string
    }));
  });

  describe('GET /profiles', () => {
    it('should search profiles by userId', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "userId": "not_exist@example.com"
        }
      }, {}).then(assertProfileLength(0));
    });
    it('should search profiles by userId', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "userId": "yamada_t@example.com"
        }
      }, {}).then(assertProfileLength(1)).then(res => {
        var profile = JSON.parse(res.body).profiles[0];
        if (!profile) {
          return Promise.reject("unexpected empty user");
        }
        Object.keys(profile).forEach(key => {
          if (key.indexOf('normalized') === 0) {
            throw new Error('normalized field found: ' + key);
          }
        });
        return Promise.resolve();
      });
    });
    it('should search multiple profiles by userId', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "userId": "yamada_t@example.com,yamada_s@example.com"
        }
      }, {}).then(assertProfileLength(2));
    });
    it('should search profiles by q', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "not_exist"
        }
      }, {}).then(assertProfileLength(0));
    });
    it('should search profiles by q (match to name)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "山田"
        }
      }, {}).then(assertProfileLength(2));
    });
    it('should search profiles by q (match to name)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "太郎"
        }
      }, {}).then(assertProfileLength(1));
    });
    it('should search profiles by q (match to name, case sensitive)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "saburo"
        }
      }, {}).then(assertProfileLength(1));
    });
    it('should search profiles by q (match to ruby)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "やまだ"
        }
      }, {}).then(assertProfileLength(2));
    });
    it('should search profiles by q (match to ruby)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "たろう"
        }
      }, {}).then(assertProfileLength(1));
    });
    it('should search profiles by q (match to mail before @)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "yamada_t"
        }
      }, {}).then(assertProfileLength(1));
    });
    it('should search profiles by q (match to mail before _)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "yamada"
        }
      }, {}).then(assertProfileLength(2));
    });
    it('should search profiles by q (match to employeeId)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "1234"
        }
      }, {}).then(assertProfileLength(1));
    });
    it('should search profiles by q (match to employeeId)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "123"
        }
      }, {}).then(assertProfileLength(0));
    });
    it('should search profiles by q (match to post)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "Tech"
        }
      }, {}).then(assertProfileLength(1));
    });
    it('should search profiles by q (match to quoted post)', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "\"Sales and Tech\""
        }
      }, {}).then(assertProfileLength(1));
    });
    it('should support search by AND', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "太郎　やまだ"
        }
      }, {}).then(assertProfileLength(1));
    });
    it('should support double-quotation', () => {
      return handlerToPromise(profilesQuery.handler)({
        "queryStringParameters": {
          "q": "\"やまだ やまもと\""
        }
      }, {}).then(assertProfileLength(0));
    });
  });
  describe('GET /profiles/{userId}', () => {
    it('returns 200 if profile exists', () => {
      return handlerToPromise(profilesGet.handler)({
        "pathParameters": {
          "userId": "yamada_t@example.com"
        }
      }, {}).then(assertStatus(200)).then(res => {
        var profile = JSON.parse(res.body);
        Object.keys(profile).forEach(key => {
          if (key.indexOf('normalized') === 0) {
            throw new Error('normalized field found: ' + key);
          }
        });
        return Promise.resolve();
      });
    });
    it('returns 404 if profile does not exist', () => {
      return handlerToPromise(profilesGet.handler)({
        "pathParameters": {
          "userId": "not_exist@example.com"
        }
      }, {}).then(assertStatus(404));
    });
  });
  describe('PUT /profiles/{userId}', () => {
    it('returns 200 if data is valid', () => {
      return handlerToPromise(profilesPut.handler)({
        "pathParameters": {
          "userId": "test@example.com"
        },
        "body": JSON.stringify({
          "userId": "test@example.com",
          "name": "テスト"
        })
      }, {}).then(assertStatus(200)).then(assertProfileLengthInDB(3));;
    });
    it('still returns 200 if data contains empty string', () => {
      return handlerToPromise(profilesPut.handler)({
        "pathParameters": {
          "userId": "test@example.com"
        },
        "body": JSON.stringify({
          "userId": "test@example.com",
          "name": "テスト",
          "picture": "",
          "extensionPhone": ""
        })
      }, {}).then(assertStatus(200)).then(assertProfileLengthInDB(3));
    });
  });
  describe('DELETE /profiles/{userId}', () => {
    it('delete profile correctly', () => {
      return handlerToPromise(profilesDelete.handler)({
        "pathParameters": {
          "userId": "mock@example.com"
        }
      }, {}).then(assertStatus(200)).then(assertProfileLengthInDB(1));
    });
    it('does not matter if user is not there', () => {
      return handlerToPromise(profilesDelete.handler)({
        "pathParameters": {
          "userId": "not_exist@example.com"
        }
      }, {}).then(assertStatus(200));
    });
  });
});

function assertProfileLength(expect) {
  return result => {
    if (result.statusCode !== 200) {
      throw `Expected statusCode 200 but got ${result.statusCode}: ${JSON.stringify(result)}`;
    }
    var profiles = JSON.parse(result.body).profiles;
    if (profiles.length !== expect) {
      throw `Expected profile length ${expect} but got ${profiles.length}`;
    }
    return Promise.resolve(result);
  };
}

function assertPostLength(expect) {
  return result => {
    if (result.statusCode !== 200) {
      throw `Expected statusCode 200 but got ${result.statusCode}: ${JSON.stringify(result)}`;
    }
    var posts = JSON.parse(result.body).posts;
    if (posts.length !== expect) {
      throw `Expected profile length ${expect} but got ${posts.length}`;
    }
    return Promise.resolve(result);
  };
}

function assertProfileLengthInDB(expect) {
  return result => {
    return dynamoUtil.scan(documentClient, {
      TableName: options.tableNames.profiles
    }).then(data => {
      if (data.Items.length !== expect) {
        `Expected profile length ${expect} but got ${data.Items.length}`;
      }
      return Promise.resolve(result);
    });
  };
}

function assertStatus(expect) {
  return result => {
    if (result.statusCode !== expect) {
      throw `Expected statusCode ${expect} but got ${result.statusCode}: ${JSON.stringify(result)}`;
    }
    return Promise.resolve(result);
  };
}

function handlerToPromise(handler) {
  return function(event, context) {
    return new Promise((resolve, reject) => {
      handler(event, context, function(e, data) {
        if (e) {
          reject(e);
        } else {
          resolve(data);
        }
      });
    });
  };
}
