
const options = {
  
  //region: 'ap-northeast-1',
  //endpoint: 'http://localhost:4569'
  region: process.env.REGION,
  endpoint: process.env.IS_OFFLINE !== 'true' ? undefined: process.env.DB_ENDPOINT,
};
console.log('opt');
const prefix = process.env.TABLE_PREFIX;

const tableNames = {
  profiles: prefix + 'profiles',
  profilesPosts: prefix + 'profilesPosts',
  profilesSearchHelp: prefix + 'profilesSearchHelp'
};


module.exports = {
  options: options,
  tableNames: tableNames
};
