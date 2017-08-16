module.exports =
  process.env.EXEC_MODE === 'test' ? function() {} : console.log;
