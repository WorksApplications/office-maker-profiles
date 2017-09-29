env=$1

set -eu

if [ -z $env ]; then
    echo "no environment was given"
    exit 1
fi

configFile="config.${env}.json"
cp ${configFile} functions/common/config.json

cat functions/common/config.json
echo "okay? [yes/no]"

read answer
if test "$answer" != "yes" ; then
    echo "bye"
    exit 1
fi

rm -rf tmp
mkdir tmp

node op/deploy.js
