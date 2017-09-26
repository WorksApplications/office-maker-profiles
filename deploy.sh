cat config.json
echo "okay? [yes/no]"

read answer
if test "$answer" != "yes" ; then
    echo "bye"
    exit 1
fi

rm -rf tmp
mkdir tmp
cp config.json functions/common/config.json
node op/deploy.js
