const copy = require('copy-dynamodb-table').copy;

const AWSConfig = {
  region: 'ap-northeast-1',
};

const sourceTableName = 'profiles';
const targetTableName = 'prod-profiles';

copy({
  config: AWSConfig,
  source: {
    tableName: sourceTableName,
  },
  destination: {
    tableName: targetTableName,
  },
  log: true,
  create: false,
}, (err, result) => {
  if (err) {
    console.err(err);
  }

  console.log(result);
});

