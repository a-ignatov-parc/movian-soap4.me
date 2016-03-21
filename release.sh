#!/usr/bin/env bash

npm install
npm version ${1:-patch}

rm -rf ./out
./node_modules/.bin/gulp --production

PACKAGE_VERSION=$(node -p -e "require('./package.json').version")
RELEASE_PATH="./releases/$PACKAGE_VERSION"

mkdir -p $RELEASE_PATH
zip -r -X -j "$RELEASE_PATH/plugin.zip" ./out

git push origin master
git push --tags
