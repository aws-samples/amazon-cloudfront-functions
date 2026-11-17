## Network call: per-request authorization for agents

**CloudFront Functions event type: viewer request**

A client, for example an AI agent, sends a short-lived scoped token on every request. The token says who the client is, but not whether it may act on this resource right now. So this function POSTs `{ action, resource, token }` to an authorization service with one `cf.fetch` call and forwards the request only when the answer is `{ "allowed": true }`. `action` is `read` for `GET` and `HEAD` and `write` for every other method; `resource` is the URI.

Why a network call: the per-resource policy lives in the service and can change between two requests, which a token minted earlier cannot express. Because viewer request runs before the cache, denied requests never reach the origin, and allowed reads can still be cache hits. Keep the token out of the cache key, so one cached object serves every client the service allows; the function still runs on every request, so a revoked grant is refused on the next one.

A request with no `Authorization` header is answered `401` by the function, before any call, so anonymous traffic costs nothing at the service. The function fails closed: only exactly `allowed: true` passes, and a service that cannot be asked gives `503`. All denials carry `cache-control: no-store`.

### Requirements

- **Runtime** `cloudfront-js-2.0`. Network calls are not available with continuous deployment or the free pricing plan.
- **An origin on the same distribution** with the origin id `authz` (the origin's **Name** in the console; change `AUTHZ_ORIGIN_ID` at the top of `index.js` to use another). It can be the content origin or a separate origin with no cache behavior.
- **The origin contract**:

  | | |
  |---|---|
  | Request | `POST /v1/check`, `content-type: application/json`, body `{"action": "read", "resource": "/orders/48291", "token": "Bearer ..."}`. The token is the viewer's `Authorization` header value, sent in the body: with origin access control, CloudFront signs the call and owns its `authorization` header. The viewer's own headers are not copied onto the call |
  | Answer | `200` with `{"allowed": true}` or `{"allowed": false}`. At most 10 KB |
  | Time | The whole answer within 1 second. This is fixed by the runtime and cannot be changed |

- **Lock the origin** so that only CloudFront can call it. Any origin type works. For a Lambda Web Function, use an `IamAuth` endpoint behind origin access control (OAC) that signs with `always-amz-auth`: CloudFront signs the `POST` with an unsigned payload, so the function needs no body hash. Make sure viewers cannot reach `/v1/check` through a cache behavior.

### Deploy

Follow [Deploying a CloudFront function using the AWS CLI](../README.md#deploying-a-cloudfront-function-using-the-aws-cli) in the root README, with these values:

```
aws cloudfront create-function \
--name network-call-agent-authz \
--function-config Comment="Per-request authorization call",Runtime=cloudfront-js-2.0 \
--function-code fileb://network-call-agent-authz/index.js
```

Then publish it with `aws cloudfront publish-function` and add it to the cache behavior you want to protect, with `"EventType": "viewer-request"`.

### How it fails

| What goes wrong | The viewer gets |
|---|---|
| No `Authorization` header | `401`, `{"error":"unauthorized"}`, `www-authenticate: Bearer`; no call |
| The service answers anything but exactly `allowed: true` | `403`, `{"error":"forbidden"}` |
| The service answers non-2xx | `503`, `x-agent-authz-error: authz returned <status>`. A `403` usually means the call did not pass the origin's lock |
| `TypeError`, `TimeoutError` (no full answer within 1 second), `InternalError`, or a body that is not JSON | `503`, `x-agent-authz-error: <name>: <message>` |

A deployable version with the origin and infrastructure: <DEPLOYABLE_REPO_URL>/patterns/09-agent-authz/
