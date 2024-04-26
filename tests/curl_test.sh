#!/bin/bash

curl -v -D- -X "POST" \
  -H "Authorization: Bearer $(cat .env | grep -oP 'API_TOKEN="\K.*?(?=")')" \
  -H "Content-Type: multipart/form-data" \
  -F "version=canary" \
  -F "system=windows" \
  -F "count=2" \
  -F "hashes[0]=$(sha256sum tests/data/sar.dll | cut -d ' ' -f 1)" \
  -F "hashes[1]=$(sha256sum tests/data/sar.pdb | cut -d ' ' -f 1)" \
  -F "files[0]=@tests/data/sar.dll" \
  -F "files[1]=@tests/data/sar.pdb" \
  "http://127.0.0.1:8080/api/v1/upload"
