var AWS = require('aws-sdk');
AWS.config.update({
  region: "ap-northeast-1"
});
var db = require('../functions/common/db.js');
const options = require('../functions/common/db-options.js');
const documentClient = new AWS.DynamoDB.DocumentClient(options);
const dynamoUtil = require('../functions/common/dynamo-util.js');

function scanPosts() {
  return dynamoUtil.scan(documentClient, {
    TableName: "profiles",
    ProjectionExpression: "post"
  }).then(data => {
    return data.Items;
  });
}

scanPosts().then(items => {
  const posts = items.map(item => item.post);
  const names = new Set(posts);
  Array.from(names.values()).map(postName => {
    return () => db.putKeysIntoPostTable(postName);
  }).reduce((memo, f) => {
    return memo.then(_ => f());
  }, Promise.resolve());
});
