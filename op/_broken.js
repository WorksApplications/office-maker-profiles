var find = require('find');
var fs = require('fs');
var childProcess = require('child_process');
var Path = require('path');
var AWS = require('aws-sdk');
var archiver = require('archiver');

var project = JSON.parse(fs.readFileSync('./project.json', 'utf8'));

var lambda = new AWS.Lambda({
  region: project.region
});
// var apigateway = new AWS.APIGateway({
//   region: project.region,
//   apiVersion: '2015-07-09'
// });

var funcDefs = [];


doUpload('.');

// ---------- functions ---------------


function doUpload(projectPath) {
  var zipFilePath = './dest/all.zip';
  if (fs.existsSync(projectPath + '/package.json')) {
    npmInstall(projectPath);
  }
  return makeZipFile(projectPath, zipFilePath).then(_ => {
    var s3Key = 'TODO';
    return uploadZip(project.s3Bucket, s3Key, zipFilePath);
  }).then(_ => {
    var funcName = 'TODO';
    return upload(projectPath, funcName, project.s3Bucket, s3Key);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}


function npmInstall(cwd) {
  console.log('Resolving dependencies...');
  childProcess.execSync('npm install', {
    cwd: cwd
  });
  console.log('done.');
}

function makeZipFile(targetDir, zipFileName) {
  return new Promise((resolve, reject) => {
    console.log('Zipping ' + targetDir + '...');
    var output = fs.createWriteStream(zipFileName);
    var archive = archiver('zip');
    output.on('close', function() {
      console.log(archive.pointer() + ' total bytes');
      console.log('done.');
      resolve();
    });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(targetDir, false);
    archive.finalize();
  });
}

function upload(projectPath, funcName, s3Bucket, s3Key) {
  console.log('Uploading...');
  var s3Key = 'TODO';
  return updateFunctionCode(funcName, s3Bucket, s3Key).then(_ => {
    var envJsonPath = projectPath + '/env.json';
    if (fs.existsSync(envJsonPath)) {
      console.log('found env.json');
      var envJson = JSON.parse(fs.readFileSync(envJsonPath, 'utf8'));
      return updateFunctionConfiguration(funcName, envJson);
    }
    return Promise.resolve();
  }).then(_ => {
    console.log('done.');
    return Promise.resolve();
  }).catch(e => {
    Promise.reject(e);
    // return createFunction(funcName, project.accountId, project.role, zipFileName).then(_ => {
    //   return addPermission(funcName, project.accountId, project.apiId, resource).then(_ => {
    //     console.log('done.');
    //     return Promise.resolve();
    //   });
    // });
  });
}

// function deleteFunction(funcName) {
//   return new Promise((resolve, reject) => {
//     lambda.deleteFunction({
//       FunctionName: funcName
//     }, function(e, data) {
//       if (e) {
//         if (e.statusCode == 404) {
//           resolve();
//         } else {
//           reject(e);
//         }
//       } else {
//         resolve();
//       }
//     });
//   });
// }

// function createFunction(funcName, accountId, role, zipFileName) {
//   return new Promise((resolve, reject) => {
//     lambda.createFunction({
//       FunctionName: funcName,
//       Role: `arn:aws:iam::${accountId}:role/${role}`,
//       Runtime: "nodejs6.10",
//       Handler: "index.handler",
//       Code: {
//         ZipFile: fs.readFileSync(`./dest/${funcName}.zip`)
//       }
//     }, function(e, data) {
//       if (e) {
//         reject(e)
//       } else {
//         resolve(data);
//       }
//     });
//   });
// }

function updateFunctionCode(funcName, s3Bucket, s3Key) {
  return new Promise((resolve, reject) => {
    lambda.updateFunctionCode({
      FunctionName: funcName,
      S3Bucket: s3Bucket,
      S3Key: s3Key,
    }, function(e, data) {
      if (e) {
        reject(e)
      } else {
        resolve(data);
      }
    });
  });
}

function updateFunctionConfiguration(funcName, env) {
  return new Promise((resolve, reject) => {
    lambda.updateFunctionConfiguration({
      FunctionName: funcName,
      Environment: {
        Variables: env
      },
    }, function(e, data) {
      if (e) {
        reject(e)
      } else {
        resolve(data);
      }
    });
  });
}

// function addPermission(funcName, accountId, apiId, resource) {
//   return new Promise((resolve, reject) => {
//     lambda.addPermission({
//       Action: "lambda:InvokeFunction",
//       FunctionName: funcName,
//       Principal: "apigateway.amazonaws.com",
//       SourceArn: `arn:aws:execute-api:${project.region}:${accountId}:${apiId}/*/${resource.method}${resource.path}`,
//       StatementId: "1"
//     }, function(e, data) {
//       if (e) {
//         reject(e)
//       } else {
//         resolve(data);
//       }
//     });
//   });
// }
