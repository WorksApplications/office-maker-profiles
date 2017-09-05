const AWS = require('aws-sdk');
const options = require('./db-options.js');
const documentClient = new AWS.DynamoDB.DocumentClient(options);
const dynamoUtil = require('./dynamo-util.js');
const searchHelper = require('./search-helper.js');
const log = require('./log.js');

function getProfile(userId) {
  return dynamoUtil.get(documentClient, {
    TableName: "profiles",
    Key: {
      userId: userId
    }
  }).then(data => {
    return Promise.resolve(data.Item);
  });
}

function makeKeys(profile) {
  const normalizedName = searchHelper.normalize(profile.name);
  const normalizedNameArray = normalizedName.split(' ');
  const normalizedName1 = normalizedNameArray[0] || null;
  const normalizedName2 = normalizedNameArray[normalizedNameArray.length - 1] || null;

  const normalizedRuby = searchHelper.normalize(profile.ruby);
  const normalizedRubyArray = normalizedRuby.split(' ');
  const normalizedRuby1 = normalizedRubyArray[0] || null;
  const normalizedRuby2 = normalizedRubyArray[normalizedRubyArray.length - 1] || null;

  const employeeId = profile.employeeId || null;
  const mail = profile.mail || null;
  const normalizedMailBeforeAt = (mail || '').split('@')[0] || null;
  const normalizedMailBeforeUnderscore = (mail || '').split('_')[0] || null;
  const normalizedPost = searchHelper.normalize(profile.post) || null;
  const normalizedOrganization = searchHelper.normalize(profile.organization) || null;

  const keys = {};
  [normalizedName1,
    normalizedName2,
    normalizedRuby1,
    normalizedRuby2,
    employeeId,
    mail,
    normalizedMailBeforeAt,
    normalizedMailBeforeUnderscore,
    normalizedPost
  ].filter(key => {
    return !!key;
  }).forEach(key => {
    keys[key] = true;
  });
  return Object.keys(keys);
}

function putProfileAndMakeIndex(profile) {

  return putProfile(profile).then(_ => {
    profile = dynamoUtil.deleteEmptyOrNull(profile);
    const searchRecords = makeKeys(profile).map(key => {
      return {
        key: key,
        userId: profile.userId,
      };
    });
    const requests = searchRecords.map(record => {
      return {
        PutRequest: {
          Item: record
        }
      };
    });
    return dynamoUtil.batchWrite(documentClient, {
      RequestItems: {
        'profilesSearchHelp': requests
      }
    }).then(data => {
      if (data.UnprocessedItems['profilesSearchHelp']) {
        const count = data.UnprocessedItems['profilesSearchHelp'].length;
        const error = new Error('something is unprocessed: ' + count);
        error.name = 'BatchWriteError';
        return Promise.reject(error);
      } else {
        return Promise.resolve(data);
      }
    });
  });
}

function putProfile(profile) {
  profile = dynamoUtil.deleteEmptyOrNull(profile);
  return dynamoUtil.put(documentClient, {
    TableName: "profiles",
    Item: dynamoUtil.deleteEmptyOrNull(profile)
  });
}

//TODO
const patchProfile = function(profile) {
  profile = convertProfileBeforeSave(profile);
  profile = dynamoUtil.deleteEmptyOrNull(profile);
  return putProfile(profile);
};

function deleteProfile(userId) {
  return dynamoUtil.delete(documentClient, {
    TableName: "profiles",
    Key: {
      userId: userId
    }
  });
}

function findProfileByUserIds(userIds, limit, exclusiveStartKey) {
  if (userIds.length === 0) {
    return Promise.resolve({
      profiles: []
    });
  }
  return dynamoUtil.batchGet(documentClient, {
    RequestItems: {
      'profiles': {
        Keys: userIds.map(userId => {
          return {
            userId: userId
          };
        })
      }
    },
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey ? JSON.parse(exclusiveStartKey) : undefined
  }).then(data => {
    return Promise.resolve({
      profiles: data.Responses['profiles'],
      lastEvaluatedKey: JSON.stringify(data.LastEvaluatedKey)
    });
  });
}

function deleteExtraFields(profile) {
  if (!profile) {
    return null;
  }
  profile = Object.assign({}, profile);
  delete profile.key;
  return profile;
}

function findProfileByQuery(q, limit, exclusiveStartKey) {
  const qs = makeQueries(q);
  log('Queries:', qs);
  const searches = qs.map(q => {
    const normalizedQ = searchHelper.normalize(q);
    return dynamoUtil.query(documentClient, {
      TableName: 'profilesSearchHelp',
      KeyConditionExpression: '#key = :key',
      ExpressionAttributeNames: {
        "#key": "key"
      },
      ExpressionAttributeValues: {
        ":key": normalizedQ
      }
    }).then(data => {
      return Promise.resolve(data.Items);
    });
  });
  return searchByAnd(searches, limit);
}

function makeQueries(q) {
  q = decodeQuery(q);
  if (q[0] === '"' && q[q.length - 1] === '"') {
    return [q.substring(1, q.length - 1)];
  } else {
    return searchHelper.normalizeSpace(q).split(' ');
  }
}

function decodeQuery(q) {
  try {
    return decodeURIComponent(q);
  } catch (e) {
    return q;
  }
}

function findPostByQuery(q, limit, exclusiveStartKey) {
  const qs = makeQueries(q);
  const searches = qs.map(q => {
    const normalizedQ = searchHelper.normalize(q);
    return dynamoUtil.query(documentClient, {
      TableName: 'profilesPosts',
      KeyConditionExpression: '#key = :key',
      ExpressionAttributeNames: {
        "#key": "key"
      },
      ExpressionAttributeValues: {
        ":key": normalizedQ
      }
    }).then(data => {
      return Promise.resolve(data.Items);
    });
  });
  return searchByAnd(searches, limit);
}

function searchByAnd(searches, limit) {
  const start = Date.now();
  return Promise.all(searches).then(recordsList => {
    const count = {};
    recordsList.forEach((records, keyIndex) => {
      records.forEach(record => {
        if (keyIndex === 0 || count[record.userId] === keyIndex) {
          count[record.userId] = keyIndex + 1;
        }
      });
    });
    var userIds = Object.keys(count).filter(userId => count[userId] === recordsList.length);
    return findProfileByUserIds(userIds, limit).then(res => {
      log('got ' + res.profiles.length, 'took ' + (Date.now() - start) + 'ms');
      return res;
    });
  });
}

module.exports = {
  getProfile: getProfile,
  putProfileAndMakeIndex: putProfileAndMakeIndex,
  patchProfile: patchProfile,
  deleteProfile: deleteProfile,
  findProfileByUserIds: findProfileByUserIds,
  findProfileByQuery: findProfileByQuery,
  findPostByQuery: findPostByQuery
};
