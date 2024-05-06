#!/bin/bash

curl -v -D- -X "POST" \
  -H "Authorization: Bearer $(cat .env | grep -oP 'API_TOKEN="\K.*?(?=")')" \
  -H "Content-Type: multipart/form-data" \
  -F "version=$(echo 1.13.0-pre5-0-g0b4c5d07 | awk -F- '{print $1}')-canary" \
  -F "sar_version=1.13.0-pre5-0-g0b4c5d07-canary" \
  -F "system=windows" \
  -F "commit=0b4c5d07376ed288fe1d2f18d36065c393474480" \
  -F "branch=master" \
  -F "count=2" \
  -F "hashes[0]=$(sha256sum tests/data/sar.dll | cut -d ' ' -f 1)" \
  -F "hashes[1]=$(sha256sum tests/data/sar.pdb | cut -d ' ' -f 1)" \
  -F "files[0]=@tests/data/sar.dll" \
  -F "files[1]=@tests/data/sar.pdb" \
  "http://127.0.0.1:8080/api/v1/upload"
