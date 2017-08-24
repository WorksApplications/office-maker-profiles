var fs = require('fs');
var childProcess = require('child_process');
var Path = require('path');
var AWS = require('aws-sdk');
var yaml = require('js-yaml');

var project = JSON.parse(fs.readFileSync('./project.json', 'utf8'));

var cloudformation = new AWS.CloudFormation({
  region: project.region
});
var s3 = new AWS.S3({
  region: project.region
});

var templateFile = Path.resolve('./functions/template.yml');
var outputTemplateFile = Path.resolve('./functions/template_out.yml');
var funcDir = Path.resolve('./functions');

rmdir(funcDir + '/node_modules').then(_ => {
  return generateSwaggerYml(project.accountId, project.region).then(_ => {
    return npmInstall(funcDir, true).then(_ => {
      return cloudFormationPackage(funcDir, templateFile, outputTemplateFile, project.s3Bucket).then(_ => {
        var s = fs.readFileSync(outputTemplateFile, 'utf8');
        fs.writeFileSync(outputTemplateFile, s);
        return cloudFormationDeploy(funcDir, outputTemplateFile, project.stackName);
      });
    });
  }).then(_ => {
    return npmInstall(funcDir, false);
  });
}).then(result => {
  result && console.log(result);
}).catch(e => {
  console.log(e);
  process.exit(1);
});

function generateSwaggerYml(accountId, region) {
  if (fs.existsSync('./swagger-template.yml')) {
    var replacedText = fs.readFileSync('./swagger-template.yml', 'utf8')
      .replace(/__ACCOUNT_ID__/g, accountId)
      .replace(/__REGION__/g, region);
    fs.writeFileSync('./swagger.yml', replacedText);
  }
  return Promise.resolve();
}

function npmInstall(cwd, prod) {
  return new Promise((resolve, reject) => {
    childProcess.exec('npm install' + (prod ? ' --production' : ''), {
      cwd: cwd
    }, function(e) {
      if (e) {
        reject(e);
      } else {
        resolve();
      }
    });
  });
}

function cloudFormationPackage(funcDir, templateFile, outputTemplateFile, s3Bucket) {
  return spawnCommand(funcDir, 'aws', [
    'cloudformation',
    'package',
    '--template-file',
    templateFile,
    '--output-template-file',
    outputTemplateFile,
    '--s3-bucket',
    s3Bucket
  ]);
}

function cloudFormationDeploy(funcDir, templateFile, stackName) {
  return spawnCommand(funcDir, 'aws', [
    'cloudformation',
    'deploy',
    '--template-file',
    templateFile,
    '--stack-name',
    stackName,
    '--capabilities',
    'CAPABILITY_IAM'
  ]);
}

function spawnCommand(cwd, command, args) {
  console.log('cwd:', cwd);
  console.log('exec:', command + ' ' + args.join(' '));
  return new Promise((resolve, reject) => {
    childProcess.spawn(command, (args || []), {
      cwd: cwd,
      stdio: 'inherit'
    }).on('close', code => {
      if (code) {
        reject('exited with code ' + code);
      } else {
        resolve();
      }
    });
  });
}

function rmdir(path) {
  return new Promise((resolve, reject) => {
    childProcess.exec('rm -r ' + path, {
      cwd: '.'
    }, function(e) {
      if (e) {
        reject(e);
      } else {
        resolve();
      }
    });
  });
}

function toPromise(object, method) {
  return function(params) {
    return new Promise((resolve, reject) => {
      object[method](params, function(e, data) {
        if (e) {
          reject(e);
        } else {
          resolve(data);
        }
      });
    });
  };
}
