const AWS = require('aws-sdk');
const options = require('../common/db-options.js');
const documentClient = new AWS.DynamoDB.DocumentClient(options);
const dynamoUtil = require('../common/dynamo-util.js');
const log = require('../common/log.js');

exports.handler = () => {
  putAndDelete('profiles', {
    userId: 'scaledown@worksap.co.jp'
  }, {
    userId: 'scaledown@worksap.co.jp'
  }).then(_ => {
    return putAndDelete('profilesPosts', {
      key: 'scaledown',
      name: 'scaledown'
    }, {
      key: 'scaledown',
      name: 'scaledown'
    });
  }).then(_ => {
    return putAndDelete('profilesSearchHelp', {
      key: 'scaledown',
      userId: 'scaledown'
    }, {
      key: 'scaledown',
      userId: 'scaledown'
    });
  }).then(_ => {
    console.log('done.');
  });
};

function putAndDelete(tableName, putItem, deleteKey) {
  return dynamoUtil.put(documentClient, {
    TableName: tableName,
    Item: putItem,
  }).catch(e => {
    console.log(e);
  }).then(_ => {
    return dynamoUtil.delete(documentClient, {
      TableName: tableName,
      Key: deleteKey
    });
  }).catch(e => {
    console.log(e);
  });
}
