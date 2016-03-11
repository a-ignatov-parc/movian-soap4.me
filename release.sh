#!/usr/bin/env bash

rm -rf ./out
npm install
npm version ${1:-patch}
./node_modules/.bin/gulp --production
zip -r -X -j ./releases/plugin.zip ./out
