#!/usr/bin/env bash

rm -rf ./out
npm install
npm version ${1:-patch}
./node_modules/.bin/gulp --production
mkdir -p ./releases
zip -r -X -j ./releases/plugin.zip ./out
