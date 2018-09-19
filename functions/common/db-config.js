const fs = require('fs');
const configJsonFile = __dirname + '/config.json';
const config = JSON.parse(fs.readFileSync(configJsonFile, 'utf8'));

const options = /*process.env.EXEC_MODE === 'test'*/ true ? {
  
  //region: 'ap-northeast-1',
  //endpoint: 'http://localhost:4569'
  region: 'localhost',
  endpoint: 'http://localhost:8010'
} : {
  region: 'ap-northeast-1'
};
console.log('opt');
const prefix = config.tablePrefix;

const tableNames = {
  profiles: prefix + 'profiles',
  profilesPosts: prefix + 'profilesPosts',
  profilesSearchHelp: prefix + 'profilesSearchHelp'
};

console.log(tableNames);

module.exports = {
  options: options,
  tableNames: tableNames
};
