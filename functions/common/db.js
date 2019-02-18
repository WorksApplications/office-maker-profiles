const AWS = require('aws-sdk');
const options = require('./db-config.js');
const documentClient = new AWS.DynamoDB.DocumentClient(options.options);
const dynamoUtil = require('./dynamo-util.js');
const searchHelper = require('./search-helper.js');
const log = require('./log.js');

function getProfile(userId) {
  return dynamoUtil.get(documentClient, {
    TableName: options.tableNames.profiles,
    Key: {
      userId: userId
    }
  }).then(data => {
    return data.Item;
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
  const mail = searchHelper.normalize(profile.mail || '') || null;
  const normalizedMailBeforeAt = searchHelper.normalize((profile.mail || '').split('@')[0]) || null;
  const normalizedMailBeforeUnderscore = searchHelper.normalize((profile.mail || '').split('_')[0]) || null;
  const normalizedMailBeforeDot = searchHelper.normalize((profile.mail || '').split('.')[0]) || null;
  const normalizedPost = searchHelper.normalize(profile.post) || null;
  const normalizedPostArray = (profile.post || '').split(' ').map(searchHelper.normalize) || null;
  const normalizedOrganization = searchHelper.normalize(profile.organization) || null;
  const extensionPhone = profile.extensionPhone || null;
  const cellPhone = searchHelper.normalize(profile.cellPhone || '') || null;

  const keys = {};
  ([normalizedName1,
    normalizedName2,
    normalizedRuby1,
    normalizedRuby2,
    employeeId,
    mail,
    normalizedMailBeforeAt,
    normalizedMailBeforeUnderscore,
    normalizedPost,
    extensionPhone,
    cellPhone,
  ].concat(normalizedPostArray)).filter(key => {
    return !!key;
  }).forEach(key => {
    keys[key] = true;
  });
  return Object.keys(keys);
}

function putProfileAndMakeIndex(profile) {
  return putProfile(profile).then(_ => {
    profile = dynamoUtil.deleteEmptyOrNull(profile);
    return putKeysIntoSearchHelpTable(profile);
  });
}

function putKeysIntoSearchHelpTable(profile) {
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
  return strictBatchWrite(options.tableNames.profilesSearchHelp, requests);
}

function putKeysIntoPostTable(postName) {
  let keys = searchHelper.normalize(postName).split(' ').filter(key => {
    return !key.endsWith('.');
  }).filter(key => {
    return key.length > 1;
  });
  keys = Array.from(new Set(keys));
  const nodes = postName.split('\n');
  const name1 = nodes[0] ? nodes[0] : undefined;
  const name2 = nodes[1] ? nodes[1] : undefined;
  const name3 = nodes[2] ? nodes[2] : undefined;
  const name4 = nodes[3] ? nodes[3] : undefined;
  const searchRecords = keys.map(key => {
    return {
      key: key,
      name: postName,
      name1: name1,
      name2: name2,
      name3: name3,
      name4: name4
    };
  });
  const requests = searchRecords.map(record => {
    return {
      PutRequest: {
        Item: record
      }
    };
  });
  // console.log(JSON.stringify(requests, null, 2));
  return strictBatchWrite(options.tableNames.profilesPosts, requests);
}

function strictBatchWrite(tableName, requests) {
  return dynamoUtil.batchWrite(documentClient, {
    RequestItems: {
      [tableName]: requests
    }
  }).then(data => {
    if (data.UnprocessedItems[tableName]) {
      const count = data.UnprocessedItems[tableName].length;
      const error = new Error('something is unprocessed: ' + count);
      error.name = 'BatchWriteError';
      return Promise.reject(error);
    } else {
      return data;
    }
  });
}


function putProfile(profile) {
  profile = dynamoUtil.deleteEmptyOrNull(profile);
  return dynamoUtil.put(documentClient, {
    TableName: options.tableNames.profiles,
    Item: dynamoUtil.deleteEmptyOrNull(profile)
  });
}

//TODO this is the same as PUT for now
const patchProfile = function(profile) {
  profile = convertProfileBeforeSave(profile);
  profile = dynamoUtil.deleteEmptyOrNull(profile);
  return putProfile(profile);
};

function deleteProfile(userId) {
  return dynamoUtil.delete(documentClient, {
    TableName: options.tableNames.profiles,
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
      [options.tableNames.profiles]: {
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
      profiles: data.Responses[options.tableNames.profiles],
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
    log('NormalizedQueries:', normalizedQ);
    return dynamoUtil.query(documentClient, {
      TableName: options.tableNames.profilesSearchHelp,
      KeyConditionExpression: '#key = :key',
      ExpressionAttributeNames: {
        "#key": "key"
      },
      ExpressionAttributeValues: {
        ":key": normalizedQ
      }
    }).then(data => {
      return data.Items;
    });
  });
  return searchProfilesByAnd(searches, limit);
}

function searchProfilesByAnd(searches, limit) {
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
    console.log('users to be searched:', userIds.length);
    userIds.length = Math.min(userIds.length, 100);
    return findProfileByUserIds(userIds, limit).then(res => {
      log('got ' + res.profiles.length, 'took ' + (Date.now() - start) + 'ms');
      return res;
    });
  });
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

function findPostByQuery(q) {
  const qs = makeQueries(q);
  const searches = qs.map(q => {
    const normalizedQ = searchHelper.normalize(q);
    return dynamoUtil.query(documentClient, {
      TableName: options.tableNames.profilesPosts,
      KeyConditionExpression: '#key = :key',
      ExpressionAttributeNames: {
        "#key": "key"
      },
      ExpressionAttributeValues: {
        ":key": normalizedQ
      }
    }).then(data => {
      return data.Items;
    });
  });
  return searchPostsByAnd(searches).then(posts => {
    return {
      posts: posts
    };
  });
}

function searchPostsByAnd(searches) {
  return Promise.all(searches).then(recordsList => {
    const count = {};
    recordsList.forEach((records, keyIndex) => {
      records.forEach(record => {
        if (keyIndex === 0 || count[record.name] === keyIndex) {
          count[record.name] = keyIndex + 1;
        }
      });
    });
    var names = Object.keys(count).filter(name => count[name] === recordsList.length);
    return names.map(name => {
      name: name
    });
  });
}


module.exports = {
  getProfile: getProfile,
  putProfileAndMakeIndex: putProfileAndMakeIndex,
  putKeysIntoPostTable: putKeysIntoPostTable,
  patchProfile: patchProfile,
  deleteProfile: deleteProfile,
  findProfileByUserIds: findProfileByUserIds,
  findProfileByQuery: findProfileByQuery,
  findPostByQuery: findPostByQuery
};
