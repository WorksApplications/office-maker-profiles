function exec(method) {
  return function(dynamoDbOrDocumentClient, params) {
    return new Promise((resolve, reject) => {
      console.log(dynamoDbOrDocumentClient);
      dynamoDbOrDocumentClient[method](params, function(e, data) {
        if (e) {
          reject(e);
        } else {
          resolve(data);
        }
      });
    });
  };
}

function deleteEmptyOrNull(object) {
  object = Object.assign({}, object);
  Object.keys(object).forEach(key => {
    if (object[key] === "" || object[key] === null) {
      delete object[key];
    }
  });
  return object;
}

module.exports = {
  deleteEmptyOrNull: deleteEmptyOrNull,
  get: exec('get'),
  put: exec('put'),
  delete: exec('delete'),
  scan: exec('scan'),
  batchGet: exec('batchGet'),
  batchWrite: exec('batchWrite'),
  query: exec('query'),
  createTable: exec('createTable')
};
