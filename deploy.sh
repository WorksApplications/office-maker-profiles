cat config.json
echo "okay? [yes/no]"

read answer
case $answer in
    yes)
        rm -rf tmp
        mkdir tmp
        cp config.json functions/common/config.json
        node op/deploy.js
        ;;
    *)
        echo "bye"
        ;;
esac
