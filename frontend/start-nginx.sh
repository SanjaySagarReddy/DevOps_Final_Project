#!/bin/sh
set -eu

: "${API_UPSTREAM:=backend:8000}"
export API_UPSTREAM
envsubst '${API_UPSTREAM}' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf
exec nginx -c /tmp/nginx.conf -g 'daemon off;'
