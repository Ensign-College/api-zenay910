#!/bin/bash
git pull
npm install
zip -r lambda-jose-function.zip .
sam deploy --guided