var AWS = require('aws-sdk');
var options = require('./db-options.js');
var documentClient = new AWS.DynamoDB.DocumentClient(options);
var dynamoUtil = require('./dynamo-util.js');
var searchHelper = require('./search-helper.js');
var log = require('./log.js');

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

function convertProfileBeforeSave(profile) {
  profile = Object.assign({}, profile);

  var normalizedName = searchHelper.normalize(profile.name);
  var normalizedNameArray = normalizedName.split(' ');
  profile.normalizedName = normalizedName;
  profile.normalizedName1 = normalizedNameArray[0] || null;
  profile.normalizedName2 = normalizedNameArray[normalizedNameArray.length - 1] || null;

  var normalizedRuby = searchHelper.normalize(profile.ruby);
  var normalizedRubyArray = normalizedRuby.split(' ');
  profile.normalizedRuby = normalizedRuby;
  profile.normalizedRuby1 = normalizedRubyArray[0] || null;
  profile.normalizedRuby2 = normalizedRubyArray[normalizedRubyArray.length - 1] || null;

  profile.employeeId = profile.employeeId || null;
  profile.mail = profile.mail || null;
  profile.normalizedMailBeforeAt = (profile.mail || '').split('@')[0] || null;
  profile.normalizedMailBeforeUnderscore = (profile.mail || '').split('_')[0] || null;
  profile.normalizedPost = searchHelper.normalize(profile.post) || null;
  profile.normalizedOrganization = searchHelper.normalize(profile.organization) || null;
  return profile;
}

// function putProfile(profile) {
//   profile = convertProfileBeforeSave(profile);
//   profile = dynamoUtil.deleteEmptyOrNull(profile);
//   return dynamoUtil.put(documentClient, {
//     TableName: "profiles",
//     Item: dynamoUtil.deleteEmptyOrNull(profile)
//   });
// }

function putProfile(originalProfile) {
  var profile = convertProfileBeforeSave(originalProfile);
  profile = dynamoUtil.deleteEmptyOrNull(profile);

  var keys = {};
  [
    profile.normalizedName1,
    profile.normalizedName2,
    profile.normalizedRuby1,
    profile.normalizedRuby2,
    profile.employeeId,
    profile.mail,
    profile.normalizedMailBeforeAt,
    profile.normalizedMailBeforeUnderscore,
    profile.normalizedPost
  ].filter(key => {
    return !!key;
  }).forEach(key => {
    keys[key] = true;
  });

  var searchRecords = Object.keys(keys).map(key => {
    return {
      key: key,
      userId: profile.userId,
    };
  });
  return dynamoUtil.put(documentClient, {
    TableName: "profiles",
    Item: dynamoUtil.deleteEmptyOrNull(originalProfile)
  }).then(_ => {
    var requests = searchRecords.map(record => {
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
        var count = data.UnprocessedItems['profilesSearchHelp'].length;
        var error = new Error('something is unprocessed: ' + count);
        error.name = 'BatchWriteError';
        return Promise.reject(error);
      } else {
        return Promise.resolve(data);
      }
    });
  });
}

var patchProfile = putProfile;

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
  var searches = qs.map(q => {
    var normalizedQ = searchHelper.normalize(q);
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
  var searches = qs.map(q => {
    var normalizedQ = searchHelper.normalize(q);
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
  var start = Date.now();
  return Promise.all(searches).then(recordsList => {
    var count = {};
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
  putProfile: putProfile,
  patchProfile: patchProfile,
  deleteProfile: deleteProfile,
  findProfileByUserIds: findProfileByUserIds,
  findProfileByQuery: findProfileByQuery,
  findPostByQuery: findPostByQuery
};
