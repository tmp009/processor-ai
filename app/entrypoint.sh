#!/usr/bin/env bash

set -eEuo pipefail

case "${1}" in
  "start")
    exec node index.mjs
  ;;
  "hang")
    tail -f /dev/null
  ;;
esac
