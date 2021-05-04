#!/usr/bin/env bash

#
# JWT Encoder Bash Script
#

secret='LzdWGpAToQ1DqYuzHxE6YOqi7G3X2yvNBot9mCXfx5k'

# Static header fields.
header='{
  "alg": "HS256",
  "typ": "JWT"
}'

payload='{
  "sub": "1234567890",
  "name": "John Doe",
  "iat": 1516239022, 
  "nbf" : 161623932, 
  "exp" : 1616239042
}'

base64_encode()
{
    declare input=${1:-$(</dev/stdin)}
    # Use `tr` to URL encode the output from base64.
    printf '%s' "${input}" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n'
}

json() {
    declare input=${1:-$(</dev/stdin)}
    printf '%s' "${input}" | jq -c .
}

hmacsha256_sign()
{
    declare input=${1:-$(</dev/stdin)}
    printf '%s' "${input}" | openssl dgst -binary -sha256 -hmac "${secret}"
}

header_base64=$(echo "${header}" | json | base64_encode)
payload_base64=$(echo "${payload}" | json | base64_encode)

header_payload=$(echo "${header_base64}.${payload_base64}")
signature=$(echo "${header_payload}" | hmacsha256_sign | base64_encode)

echo "${header_payload}.${signature}"