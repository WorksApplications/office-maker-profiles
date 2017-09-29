const fs = require('fs');
const configJsonFile = __dirname + '/config.json';
const config = JSON.parse(fs.readFileSync(configJsonFile, 'utf8'));

const options = process.env.EXEC_MODE === 'test' ? {
  region: 'ap-northeast-1',
  endpoint: 'http://localhost:4569'
} : {
  region: 'ap-northeast-1'
};

const alias = config.tableAlias;

const tableNames = {
  profiles: alias + 'profiles',
  profilesPosts: alias + 'profilesPosts',
  profilesSearchHelp: alias + 'profilesSearchHelp'
};

console.log(tableNames);

module.exports = {
  options: options,
  tableNames: tableNames
};
