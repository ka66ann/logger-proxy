#!/usr/bin/env fish

if test -e lib
  rm -Rf lib
fi

mkdir -p lib
cp package.json lib/package.json

echo "Cleaned lib & copied fresh package.json"
