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
  profile.normalizedName1 = normalizedNameArray[0] || '???';
  profile.normalizedName2 = normalizedNameArray[normalizedNameArray.length - 1] || '???';

  var normalizedRuby = searchHelper.normalize(profile.ruby);
  var normalizedRubyArray = normalizedRuby.split(' ');
  profile.normalizedRuby = normalizedRuby;
  profile.normalizedRuby1 = normalizedRubyArray[0] || '???';
  profile.normalizedRuby2 = normalizedRubyArray[normalizedRubyArray.length - 1] || '???';

  profile.employeeId = profile.employeeId || '???';
  profile.mail = profile.mail || '???';
  profile.normalizedMailBeforeAt = (profile.mail || '').split('@')[0] || '???';
  profile.normalizedMailBeforeUnderscore = (profile.mail || '').split('_')[0] || '???';
  profile.normalizedPost = searchHelper.normalize(profile.post) || '???';
  profile.normalizedOrganization = searchHelper.normalize(profile.organization) || '???';
  return profile;
}

// function putProfile(profile) {
//   profile = convertProfileBeforeSave(profile);
//   profile = dynamoUtil.emptyToNull(profile);
//   return dynamoUtil.put(documentClient, {
//     TableName: "profiles",
//     Item: dynamoUtil.emptyToNull(profile)
//   });
// }

function putProfile(originalProfile) {
  var profile = convertProfileBeforeSave(originalProfile);
  profile = dynamoUtil.emptyToNull(profile);

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
  ].forEach(key => {
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
    Item: dynamoUtil.emptyToNull(originalProfile)
  }).then(_ => {
    //TODO batch
    return searchRecords.reduce((p, record) => {
      return p.then(_ => {
        return dynamoUtil.put(documentClient, {
          TableName: "profilesSearchHelp",
          Item: record
        });
      });
    }, Promise.resolve());
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
  var qs;
  if (q[0] === '"' && q[q.length - 1] === '"') {
    qs = [q.substring(1, q.length - 1)];
  } else {
    qs = searchHelper.normalizeSpace(q).split(' ');
  }
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

  var start = Date.now();
  return Promise.all(searches).then(recordsList => {
    var dict = {};
    var count = {};
    recordsList.forEach(records => {
      records.forEach(record => {
        dict[record.userId] = true;
        count[record.userId] = (count[record.userId] || 0) + 1;
      });
    });
    var userIds = Object.keys(dict);
    return findProfileByUserIds(userIds, limit).then(res => {
      log('got ' + res.profiles.length, 'took ' + (Date.now() - start) + 'ms');
      res.profiles = res.profiles.sort((a, b) => {
        return count[b.userId] - count[a.userId];
      });
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
  findProfileByQuery: findProfileByQuery
};
