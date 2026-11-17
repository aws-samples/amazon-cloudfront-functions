## Network call: authorizer with identity headers

**CloudFront Functions event type: viewer request**

This function moves the "Lambda authorizer with context" pattern to the edge. It POSTs the viewer context (IP, URI, method, and the `Authorization` and `User-Agent` headers) to an authorizer with one `cf.fetch` call. The authorizer answers `{ "allow": true|false, "headers": { ... } }`. On `allow: true` the function copies the allowed identity headers onto the request and forwards it; on anything else it answers `403` itself, and the request never reaches the origin.

Why a network call: the decision needs data the function does not have (a user directory, a policy store, a session database). The identity travels with the decision in one answer, so the origin gets identity headers it can trust.

The function deletes viewer-supplied `x-tenant` and `x-role` headers first, and copies back only the header names listed in `IDENTITY_HEADERS`, lowercased, so a buggy authorizer cannot overwrite `host` or `authorization`. It fails closed: an authorizer that cannot be asked gives `503`.

### Requirements

- **Runtime** `cloudfront-js-2.0`. Network calls are not available with continuous deployment or the free pricing plan.
- **An origin on the same distribution** with the origin id `authorizer` (the origin's **Name** in the console; change `AUTHORIZER_ORIGIN_ID` at the top of `index.js` to use another). It can be the same origin as the content or a separate one with no cache behavior.
- **The origin contract**:

  | | |
  |---|---|
  | Request | `POST /authorize`, `content-type: application/json`, body `{"ip": "...", "uri": "...", "method": "GET", "headers": {"authorization": "...", "user-agent": "..."}}`. The viewer's own headers are not copied onto the call |
  | Answer | `200` with `{"allow": true, "headers": {"x-tenant": "acme", "x-role": "admin"}}`, or `{"allow": false}`. At most 10 KB |
  | Time | The whole answer within 1 second. This is fixed by the runtime and cannot be changed |

- **Lock the origin** so that only CloudFront can call it. Any origin type works. For a Lambda Web Function, use an `IamAuth` endpoint behind origin access control (OAC) that signs with `always-amz-auth`: CloudFront signs the `POST` with an unsigned payload, so the function needs no body hash. Make sure viewers cannot reach `/authorize` through a cache behavior.

### Deploy

Follow [Deploying a CloudFront function using the AWS CLI](../README.md#deploying-a-cloudfront-function-using-the-aws-cli) in the root README, with these values:

```
aws cloudfront create-function \
--name network-call-authorizer-headers \
--function-config Comment="Authorizer call with identity headers",Runtime=cloudfront-js-2.0 \
--function-code fileb://network-call-authorizer-headers/index.js
```

Then publish it with `aws cloudfront publish-function` and add it to the cache behavior you want to protect, with `"EventType": "viewer-request"`.

### How it fails

| What goes wrong | The viewer gets |
|---|---|
| The authorizer answers anything but exactly `allow: true` | `403`, `{"error":"forbidden"}` |
| The authorizer answers non-2xx | `503`, `x-authorizer-error: authorizer returned <status>`. A `403` usually means the call did not pass the origin's lock |
| `TypeError`, `TimeoutError` (no full answer within 1 second), `InternalError`, or a body that is not JSON | `503`, `x-authorizer-error: <name>: <message>` |

All denials carry `cache-control: no-store`.

A deployable version with the origin and infrastructure: <DEPLOYABLE_REPO_URL>/patterns/02-authorizer-headers/
