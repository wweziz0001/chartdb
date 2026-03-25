#!/bin/sh
set -eu

export API_UPSTREAM="${API_UPSTREAM:-api:4010}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-}"
export OPENAI_API_ENDPOINT="${OPENAI_API_ENDPOINT:-}"
export LLM_MODEL_NAME="${LLM_MODEL_NAME:-}"
export API_BASE_URL="${API_BASE_URL:-}"
export HIDE_CHARTDB_CLOUD="${HIDE_CHARTDB_CLOUD:-true}"
export DISABLE_ANALYTICS="${DISABLE_ANALYTICS:-true}"

envsubst '${OPENAI_API_KEY} ${OPENAI_API_ENDPOINT} ${LLM_MODEL_NAME} ${API_UPSTREAM} ${API_BASE_URL} ${HIDE_CHARTDB_CLOUD} ${DISABLE_ANALYTICS}' \
    < /etc/nginx/conf.d/default.conf.template \
    > /etc/nginx/conf.d/default.conf

nginx -g "daemon off;"
